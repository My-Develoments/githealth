import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { getCurrentGitHubAppInstallationSession } from "../infrastructure/github/appAuth.js";
import { getAuthStore } from "../infrastructure/auth/authStore.js";
import { resolveAuthenticatedSession } from "../application/authService.js";
import { getGitHubAppRuntimeConfig, getGitHubConfig } from "../infrastructure/github/config.js";
import { GitHubAdapterError } from "../infrastructure/github/errors.js";
import { getApiProtectionConfig } from "../infrastructure/security/apiProtectionConfig.js";
import { sendApiError } from "./errorEnvelope.js";
import {
  getAuthenticatedAppContextFromRequestStore,
  getAuthenticatedWorkspaceId,
  readCookieValue,
  setAuthenticatedAppContext
} from "./requestContext.js";

const AUTH_SESSION_COOKIE = "githealth_auth_session";

type GitHubEndpointAuthFailure = {
  status: number;
  code: string;
  message: string;
};

function extractBearerToken(header: string | undefined): { token?: string; missing: boolean } {
  if (typeof header !== "string" || header.trim().length === 0) {
    return { missing: true };
  }

  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { missing: false };
  }

  const token = match[1]?.trim();
  if (!token) {
    return { missing: false };
  }

  return {
    token,
    missing: false
  };
}

function digestToken(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function tokenMatches(expected: string, actual: string): boolean {
  const expectedDigest = digestToken(expected);
  const actualDigest = digestToken(actual);
  return timingSafeEqual(expectedDigest, actualDigest);
}

export function githubEndpointAuth(req: Request, res: Response, next: NextFunction): void {
  void resolveGitHubEndpointAuthFailure(req)
    .then((failure) => {
      if (!failure) {
        next();
        return;
      }

      sendApiError(res, failure);
    })
    .catch(next);
}

export async function resolveGitHubEndpointAuthFailure(req: Request): Promise<GitHubEndpointAuthFailure | null> {
  const { apiAuthToken, internalServiceTokenBypassEnabled } = getApiProtectionConfig();
  const authHeader = req.header("authorization");
  const parsed = extractBearerToken(authHeader);

  try {
    const config = getGitHubConfig();
    const appRuntimeConfig = getGitHubAppRuntimeConfig();
    let workspaceId = getAuthenticatedWorkspaceId();

    // Support cookie-authenticated requests even when route middleware ordering changes.
    if (!workspaceId) {
      const sessionToken = readCookieValue(req.header("cookie"), AUTH_SESSION_COOKIE);
      if (sessionToken) {
        const authenticated = await resolveAuthenticatedSession(sessionToken);
        if (authenticated) {
          setAuthenticatedAppContext(authenticated);
          workspaceId = authenticated.workspace.id;
        }
      }
    }

    const authStore = getAuthStore();
    await authStore.initialize();
    const authenticatedAppContext = getAuthenticatedAppContextFromRequestStore();
    const workspaceConnection = workspaceId
      ? await authStore.findWorkspaceGitHubConnection(workspaceId)
      : undefined;
    const oauthConnection = workspaceId && authenticatedAppContext
      ? await authStore.findWorkspaceGitHubOAuthConnection(workspaceId, authenticatedAppContext.user.id)
      : undefined;
    const requestSession =
      config.authProvider !== "oauth" &&
      appRuntimeConfig?.app &&
      !workspaceConnection &&
      typeof appRuntimeConfig.app.installationId !== "number"
        ? getCurrentGitHubAppInstallationSession(appRuntimeConfig)
        : undefined;

    if (
      appRuntimeConfig?.app &&
      (workspaceConnection || requestSession || typeof appRuntimeConfig.app.installationId === "number")
    ) {
      return null;
    }

    if (workspaceId) {
      if (config.authProvider === "oauth") {
        if (oauthConnection) {
          return null;
        }

        return {
          status: 401,
          code: "AUTH_MISSING",
          message: "GitHub OAuth connection is not configured for this workspace user."
        };
      }

      if (appRuntimeConfig?.app) {
        return {
          status: 401,
          code: "AUTH_MISSING",
          message: "GitHub App installation is not connected for this workspace."
        };
      }

      if (config.authProvider === "pat") {
        if (config.token) {
          return null;
        }

        return {
          status: 401,
          code: "AUTH_MISSING",
          message: "Server-side GITHUB_TOKEN is not configured."
        };
      }

      return {
        status: 503,
        code: "INVALID_RESPONSE",
        message: "GitHub App onboarding is not configured for this environment."
      };
    }
  } catch (error) {
    if (error instanceof GitHubAdapterError) {
      return {
        status: error.status,
        code: error.code,
        message: error.message
      };
    }

    throw error;
  }

  if (
    internalServiceTokenBypassEnabled &&
    !parsed.missing &&
    parsed.token &&
    tokenMatches(apiAuthToken, parsed.token)
  ) {
    return null;
  }

  if (parsed.missing) {
    return {
      status: 401,
      code: "AUTH_MISSING",
      message: "Missing Authorization bearer token."
    };
  }

  if (!parsed.token || !tokenMatches(apiAuthToken, parsed.token)) {
    return {
      status: 401,
      code: "AUTH_INVALID",
      message: "Invalid Authorization bearer token."
    };
  }

  return null;
}
