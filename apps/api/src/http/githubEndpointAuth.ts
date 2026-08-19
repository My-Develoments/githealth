import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { getCurrentGitHubAppInstallationSession } from "../infrastructure/github/appAuth.js";
import { getGitHubConfig } from "../infrastructure/github/config.js";
import { GitHubAdapterError } from "../infrastructure/github/errors.js";
import { getApiProtectionConfig } from "../infrastructure/security/apiProtectionConfig.js";
import { sendApiError } from "./errorEnvelope.js";

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
  const { apiAuthToken } = getApiProtectionConfig();
  const authHeader = req.header("authorization");
  const parsed = extractBearerToken(authHeader);

  try {
    const config = getGitHubConfig();
    const requestSession = config.authProvider === "app"
      ? getCurrentGitHubAppInstallationSession(config)
      : undefined;

    if (config.authProvider === "app" && (requestSession || typeof config.app?.installationId === "number")) {
      next();
      return;
    }
  } catch (error) {
    if (error instanceof GitHubAdapterError && error.code === "AUTH_INVALID") {
      sendApiError(res, {
        status: 401,
        code: error.code,
        message: error.message
      });
      return;
    }

    if (!(error instanceof GitHubAdapterError)) {
      throw error;
    }
  }

  if (parsed.missing) {
    sendApiError(res, {
      status: 401,
      code: "AUTH_MISSING",
      message: "Missing Authorization bearer token."
    });
    return;
  }

  if (!parsed.token || !tokenMatches(apiAuthToken, parsed.token)) {
    sendApiError(res, {
      status: 401,
      code: "AUTH_INVALID",
      message: "Invalid Authorization bearer token."
    });
    return;
  }

  next();
}
