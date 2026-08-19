import { createPrivateKey, sign } from "node:crypto";
import type { GitHubConfig } from "./config.js";
import { GitHubAdapterError } from "./errors.js";

type CachedInstallationToken = {
  token: string;
  expiresAtMs: number;
};

type AppTokenCacheEntry = {
  value: CachedInstallationToken;
};

type AppTokenDependencies = {
  now: () => number;
};

const INSTALLATION_TOKEN_EXPIRY_SKEW_MS = 60_000;
const appInstallationTokenCache = new Map<string, AppTokenCacheEntry>();
const installationTokenProvider = createInstallationTokenProvider();

function toBase64Url(value: string): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function parseExpiryTimestamp(value: string): number {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    throw new GitHubAdapterError("INVALID_RESPONSE", "GitHub App installation token expiry is invalid.", 502);
  }

  return timestamp;
}

function parseGitHubAppPrivateKey(privateKey: string) {
  try {
    return createPrivateKey(privateKey);
  } catch {
    throw new GitHubAdapterError("INVALID_RESPONSE", "Invalid GITHUB_APP_PRIVATE_KEY value.", 500);
  }
}

function createAppJwt(appId: string, privateKey: string, nowMs: number): string {
  const issuedAtSeconds = Math.floor(nowMs / 1000) - 60;
  const expiresAtSeconds = issuedAtSeconds + 9 * 60;

  const header = toBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = toBase64Url(
    JSON.stringify({
      iat: issuedAtSeconds,
      exp: expiresAtSeconds,
      iss: appId
    })
  );

  const signingInput = `${header}.${payload}`;
  const keyObject = parseGitHubAppPrivateKey(privateKey);
  const signature = sign("RSA-SHA256", Buffer.from(signingInput), keyObject)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${signingInput}.${signature}`;
}

type CreateInstallationTokenInput = {
  apiBaseUrl: string;
  appId: string;
  privateKey: string;
  installationId: number;
  timeoutMs: number;
};

async function requestInstallationToken(input: CreateInstallationTokenInput, nowMs: number): Promise<CachedInstallationToken> {
  const jwt = createAppJwt(input.appId, input.privateKey, nowMs);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const response = await fetch(
      `${input.apiBaseUrl}/app/installations/${input.installationId}/access_tokens`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${jwt}`
        },
        signal: controller.signal
      }
    );

    if (!response.ok) {
      throw new GitHubAdapterError("UPSTREAM_UNAVAILABLE", "Failed to create GitHub App installation token.", 503);
    }

    const payload = (await response.json()) as { token?: string; expires_at?: string };
    if (typeof payload.token !== "string" || payload.token.trim().length === 0 || typeof payload.expires_at !== "string") {
      throw new GitHubAdapterError("INVALID_RESPONSE", "GitHub App installation token response was invalid.", 502);
    }

    return {
      token: payload.token,
      expiresAtMs: parseExpiryTimestamp(payload.expires_at)
    };
  } catch (error) {
    if (error instanceof GitHubAdapterError) {
      throw error;
    }

    throw new GitHubAdapterError("UPSTREAM_UNAVAILABLE", "GitHub App authentication request failed.", 503);
  } finally {
    clearTimeout(timeout);
  }
}

function buildCacheKey(apiBaseUrl: string, appId: string, installationId: number): string {
  return `${apiBaseUrl}:${appId}:${installationId}`;
}

export function resetGitHubAppInstallationTokenCache(): void {
  appInstallationTokenCache.clear();
}

export function createInstallationTokenProvider(dependencies: Partial<AppTokenDependencies> = {}) {
  const now = dependencies.now ?? (() => Date.now());

  return {
    async getToken(input: CreateInstallationTokenInput): Promise<string> {
      const cacheKey = buildCacheKey(input.apiBaseUrl, input.appId, input.installationId);
      const timestamp = now();

      const existing = appInstallationTokenCache.get(cacheKey);
      if (existing && existing.value.expiresAtMs - INSTALLATION_TOKEN_EXPIRY_SKEW_MS > timestamp) {
        return existing.value.token;
      }

      const fresh = await requestInstallationToken(input, timestamp);
      appInstallationTokenCache.set(cacheKey, { value: fresh });
      return fresh.token;
    }
  };
}

export async function resolveGitHubAccessToken(config: GitHubConfig): Promise<string> {
  if (config.authProvider === "pat") {
    if (config.token) {
      return config.token;
    }

    throw new GitHubAdapterError("AUTH_MISSING", "GITHUB_TOKEN is required for live GitHub source.", 401);
  }

  const appConfig = config.app;
  if (!appConfig) {
    throw new GitHubAdapterError("AUTH_MISSING", "GitHub App configuration is unavailable.", 500);
  }

  if (!appConfig.installationId) {
    throw new GitHubAdapterError(
      "AUTH_MISSING",
      "GitHub App installation is not connected. Complete app installation and set GITHUB_APP_INSTALLATION_ID.",
      401
    );
  }

  return installationTokenProvider.getToken({
    apiBaseUrl: config.apiBaseUrl,
    appId: appConfig.appId,
    privateKey: appConfig.privateKey,
    installationId: appConfig.installationId,
    timeoutMs: config.timeoutMs
  });
}
