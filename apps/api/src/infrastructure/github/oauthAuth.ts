import { createHash, randomBytes } from "node:crypto";
import { getAuthStore } from "../auth/authStore.js";
import type { GitHubConfig } from "./config.js";
import { GitHubAdapterError, normalizeGitHubHttpError } from "./errors.js";
import { encryptSecret } from "../security/secretsCrypto.js";
import { getApiProtectionConfig } from "../security/apiProtectionConfig.js";

type GitHubOAuthTokenResponse = {
  access_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GitHubOAuthUserResponse = {
  id?: number;
  login?: string;
};

type GitHubOAuthOrganizationResponse = {
  login?: string;
};

export type StartGitHubOAuthResult = {
  connectUrl: string;
};

export type CompleteGitHubOAuthResult = {
  githubUserId: string;
  githubLogin: string;
  accessTokenCiphertext: string;
  accessTokenIv: string;
  accessTokenTag: string;
  scopes: string[];
  selectedOrganization?: string;
  organizationOptions: string[];
};

function requireOAuthConfig(config: GitHubConfig): NonNullable<GitHubConfig["oauth"]> {
  if (config.authProvider !== "oauth" || !config.oauth) {
    throw new GitHubAdapterError("INVALID_RESPONSE", "GitHub OAuth mode is not configured.", 500);
  }

  return config.oauth;
}

function hashState(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}

function parseScopes(rawScope: string | undefined): string[] {
  if (!rawScope) {
    return [];
  }

  return [...new Set(rawScope.split(/[\s,]+/).map((scope) => scope.trim()).filter((scope) => scope.length > 0))];
}

async function exchangeAuthorizationCode(config: GitHubConfig, state: string, code: string): Promise<{ accessToken: string; scopes: string[] }> {
  const oauth = requireOAuthConfig(config);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(oauth.tokenUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "content-type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: oauth.clientId,
        client_secret: oauth.clientSecret,
        code,
        redirect_uri: oauth.redirectUri,
        state
      }).toString(),
      signal: controller.signal
    });

    let payload: GitHubOAuthTokenResponse;

    try {
      payload = (await response.json()) as GitHubOAuthTokenResponse;
    } catch {
      throw new GitHubAdapterError("INVALID_RESPONSE", "GitHub OAuth token response is invalid JSON.", 502, {
        upstreamStatus: response.status
      });
    }

    if (!response.ok || payload.error) {
      const message = payload.error_description?.trim() || payload.error?.trim() || "GitHub OAuth token exchange failed.";
      const normalized = normalizeGitHubHttpError(response.status || 502, message, {
        message
      });
      throw new GitHubAdapterError(normalized.code, normalized.message, normalized.status, {
        upstreamStatus: normalized.upstreamStatus
      });
    }

    const accessToken = payload.access_token?.trim();
    if (!accessToken) {
      throw new GitHubAdapterError("INVALID_RESPONSE", "GitHub OAuth token response did not include an access token.", 502, {
        upstreamStatus: response.status
      });
    }

    return {
      accessToken,
      scopes: parseScopes(payload.scope)
    };
  } catch (error) {
    if (error instanceof GitHubAdapterError) {
      throw error;
    }

    throw new GitHubAdapterError("UPSTREAM_UNAVAILABLE", "GitHub OAuth token exchange request failed.", 503);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAuthenticatedGitHubUser(config: GitHubConfig, accessToken: string): Promise<{ githubUserId: string; githubLogin: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.apiBaseUrl}/user`, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`
      },
      signal: controller.signal
    });

    let payload: GitHubOAuthUserResponse;

    try {
      payload = (await response.json()) as GitHubOAuthUserResponse;
    } catch {
      throw new GitHubAdapterError("INVALID_RESPONSE", "GitHub user response is invalid JSON.", 502, {
        upstreamStatus: response.status
      });
    }

    if (!response.ok) {
      const normalized = normalizeGitHubHttpError(response.status, "Failed to fetch authenticated GitHub user.", {
        message: "Failed to fetch authenticated GitHub user."
      });
      throw new GitHubAdapterError(normalized.code, normalized.message, normalized.status, {
        upstreamStatus: normalized.upstreamStatus
      });
    }

    const githubUserId = Number.isInteger(payload.id) ? String(payload.id) : "";
    const githubLogin = payload.login?.trim() ?? "";

    if (!githubUserId || !githubLogin) {
      throw new GitHubAdapterError("INVALID_RESPONSE", "GitHub user response did not include required identity fields.", 502, {
        upstreamStatus: response.status
      });
    }

    return {
      githubUserId,
      githubLogin
    };
  } catch (error) {
    if (error instanceof GitHubAdapterError) {
      throw error;
    }

    throw new GitHubAdapterError("UPSTREAM_UNAVAILABLE", "GitHub user info request failed.", 503);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAuthenticatedGitHubOrganizations(config: GitHubConfig, accessToken: string): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.apiBaseUrl}/user/orgs?per_page=100`, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`
      },
      signal: controller.signal
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as GitHubOAuthOrganizationResponse[];
    if (!Array.isArray(payload)) {
      return [];
    }

    return payload
      .map((entry) => entry.login?.trim())
      .filter((login): login is string => typeof login === "string" && login.length > 0);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function resolveSelectedOrganization(githubOrganizations: string[]): string | undefined {
  const { allowedGitHubOrgs, allowedGitHubOrgSet } = getApiProtectionConfig();
  if (allowedGitHubOrgs.length === 0 || githubOrganizations.length === 0) {
    return undefined;
  }

  for (const organization of githubOrganizations) {
    if (allowedGitHubOrgSet.has(organization.trim().toLowerCase())) {
      return organization;
    }
  }

  return undefined;
}

function resolveAllowlistedOrganizations(githubOrganizations: string[]): string[] {
  const { allowedGitHubOrgSet } = getApiProtectionConfig();
  if (allowedGitHubOrgSet.size === 0 || githubOrganizations.length === 0) {
    return [];
  }

  const unique = new Set<string>();
  for (const organization of githubOrganizations) {
    if (allowedGitHubOrgSet.has(organization.trim().toLowerCase())) {
      unique.add(organization);
    }
  }

  return [...unique];
}

export async function resolveAllowlistedOrganizationForOAuthToken(
  config: GitHubConfig,
  accessToken: string
): Promise<string | undefined> {
  const githubOrganizations = await fetchAuthenticatedGitHubOrganizations(config, accessToken);
  return resolveSelectedOrganization(githubOrganizations);
}

export async function startGitHubOAuthFlow(
  config: GitHubConfig
): Promise<StartGitHubOAuthResult> {
  const oauth = requireOAuthConfig(config);
  const authStore = getAuthStore();
  await authStore.initialize();

  const state = randomBytes(32).toString("base64url");
  const now = Date.now();

  await authStore.createGitHubOAuthPendingState({
    stateHash: hashState(state),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + oauth.stateTtlMs).toISOString()
  });

  const authorizeUrl = new URL(oauth.authorizeBaseUrl);
  authorizeUrl.searchParams.set("client_id", oauth.clientId);
  authorizeUrl.searchParams.set("redirect_uri", oauth.redirectUri);
  authorizeUrl.searchParams.set("scope", oauth.scopes.join(" "));
  authorizeUrl.searchParams.set("state", state);

  return {
    connectUrl: authorizeUrl.toString()
  };
}

export async function completeGitHubOAuthCallback(
  config: GitHubConfig,
  state: string,
  code: string
): Promise<CompleteGitHubOAuthResult> {
  const oauth = requireOAuthConfig(config);
  const authStore = getAuthStore();
  await authStore.initialize();

  const storedState = await authStore.consumeGitHubOAuthPendingState(hashState(state));
  if (!storedState) {
    throw new GitHubAdapterError("AUTH_INVALID", "GitHub OAuth state is invalid or expired.", 401);
  }

  if (new Date(storedState.expiresAt).getTime() <= Date.now()) {
    throw new GitHubAdapterError("AUTH_INVALID", "GitHub OAuth state is expired. Please retry connection.", 401);
  }

  const { accessToken, scopes } = await exchangeAuthorizationCode(config, state, code);
  const githubUser = await fetchAuthenticatedGitHubUser(config, accessToken);
  const githubOrganizations = await fetchAuthenticatedGitHubOrganizations(config, accessToken);
  const selectedOrganization = resolveSelectedOrganization(githubOrganizations);
  const organizationOptions = resolveAllowlistedOrganizations(githubOrganizations);
  const encrypted = encryptSecret(accessToken, oauth.tokenEncryptionKey);

  return {
    githubUserId: githubUser.githubUserId,
    githubLogin: githubUser.githubLogin,
    accessTokenCiphertext: encrypted.ciphertext,
    accessTokenIv: encrypted.iv,
    accessTokenTag: encrypted.tag,
    scopes,
    selectedOrganization,
    organizationOptions
  };
}
