import { createCipheriv, createDecipheriv, createHash, createPrivateKey, randomBytes, sign } from "node:crypto";
import { getAuthStore } from "../auth/authStore.js";
import type { GitHubConfig } from "./config.js";
import { getGitHubAppRuntimeConfig } from "./config.js";
import {
  getAuthenticatedAppContextFromRequestStore,
  getAuthenticatedWorkspaceId,
  getGitHubAppSessionToken
} from "../../http/requestContext.js";
import { GitHubAdapterError, normalizeGitHubHttpError } from "./errors.js";
import { decryptSecret } from "../security/secretsCrypto.js";

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

export type GitHubAppInstallation = {
  installationId: number;
  organization: string;
  targetType: string;
};

export type GitHubAppInstallationSession = GitHubAppInstallation & {
  issuedAtMs: number;
  expiresAtMs: number;
};

const INSTALLATION_TOKEN_EXPIRY_SKEW_MS = 60_000;
const INSTALLATION_SESSION_TOKEN_TTL_MS = 60 * 60 * 1000;
const INSTALLATION_SESSION_TOKEN_PREFIX = "ghias1";
const appInstallationTokenCache = new Map<string, AppTokenCacheEntry>();
const installationTokenProvider = createInstallationTokenProvider();

function toBase64Url(value: string): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function toBase64UrlBuffer(value: Buffer): string {
  return value
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64Url(value: string): Buffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = padded.length % 4;
  const normalized = remainder === 0 ? padded : `${padded}${"=".repeat(4 - remainder)}`;
  return Buffer.from(normalized, "base64");
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
      let message = "Failed to create GitHub App installation token.";

      try {
        const payload = (await response.json()) as { message?: string };
        if (typeof payload.message === "string" && payload.message.trim().length > 0) {
          message = payload.message;
        }
      } catch {
        // Keep fallback message when response body is not valid JSON.
      }

      throw normalizeGitHubHttpError(response.status, message, {
        headers: response.headers,
        message
      });
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

function getAppConfig(config: GitHubConfig) {
  if (config.authProvider !== "app" || !config.app) {
    throw new GitHubAdapterError("AUTH_MISSING", "GitHub App configuration is unavailable.", 500);
  }

  return config.app;
}

function buildInstallationSessionKey(config: GitHubConfig): Buffer {
  const appConfig = getAppConfig(config);
  return createHash("sha256").update(appConfig.appId).update(":").update(appConfig.privateKey).digest();
}

function buildInstallationSessionToken(session: GitHubAppInstallationSession, config: GitHubConfig): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", buildInstallationSessionKey(config), iv);
  const payload = Buffer.from(JSON.stringify(session), "utf8");
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    INSTALLATION_SESSION_TOKEN_PREFIX,
    toBase64UrlBuffer(iv),
    toBase64UrlBuffer(encrypted),
    toBase64UrlBuffer(authTag)
  ].join(".");
}

function parseInstallationSessionToken(token: string, config: GitHubConfig, nowMs: number): GitHubAppInstallationSession {
  const [prefix, ivEncoded, payloadEncoded, authTagEncoded] = token.split(".");
  if (
    prefix !== INSTALLATION_SESSION_TOKEN_PREFIX ||
    !ivEncoded ||
    !payloadEncoded ||
    !authTagEncoded
  ) {
    throw new GitHubAdapterError("AUTH_INVALID", "GitHub App installation session is invalid or expired.", 401);
  }

  try {
    const decipher = createDecipheriv("aes-256-gcm", buildInstallationSessionKey(config), fromBase64Url(ivEncoded));
    decipher.setAuthTag(fromBase64Url(authTagEncoded));
    const decrypted = Buffer.concat([decipher.update(fromBase64Url(payloadEncoded)), decipher.final()]);
    const payload = JSON.parse(decrypted.toString("utf8")) as Partial<GitHubAppInstallationSession>;

    if (
      !Number.isInteger(payload.installationId) ||
      (payload.installationId as number) <= 0 ||
      typeof payload.organization !== "string" ||
      payload.organization.trim().length === 0 ||
      typeof payload.targetType !== "string" ||
      payload.targetType.trim().length === 0 ||
      !Number.isInteger(payload.issuedAtMs) ||
      !Number.isInteger(payload.expiresAtMs)
    ) {
      throw new Error("Invalid payload");
    }

    if ((payload.expiresAtMs as number) <= nowMs) {
      throw new GitHubAdapterError("AUTH_INVALID", "GitHub App installation session is invalid or expired.", 401);
    }

    return {
      installationId: payload.installationId as number,
      organization: payload.organization.trim(),
      targetType: payload.targetType.trim(),
      issuedAtMs: payload.issuedAtMs as number,
      expiresAtMs: payload.expiresAtMs as number
    };
  } catch (error) {
    if (error instanceof GitHubAdapterError) {
      throw error;
    }

    throw new GitHubAdapterError("AUTH_INVALID", "GitHub App installation session is invalid or expired.", 401);
  }
}

async function requestGitHubAppJson<T>(
  config: GitHubConfig,
  path: string,
  method: "GET" | "POST" = "GET"
): Promise<T> {
  const appConfig = getAppConfig(config);
  const jwt = createAppJwt(appConfig.appId, appConfig.privateKey, Date.now());
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.apiBaseUrl}${path}`, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${jwt}`
      },
      signal: controller.signal
    });

    if (!response.ok) {
      let message = "GitHub App request failed.";

      try {
        const payload = (await response.json()) as { message?: string };
        if (typeof payload.message === "string" && payload.message.trim().length > 0) {
          message = payload.message;
        }
      } catch {
        // Keep fallback message when error payload is not valid JSON.
      }

      throw normalizeGitHubHttpError(response.status, message, {
        headers: response.headers,
        message
      });
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof GitHubAdapterError) {
      throw error;
    }

    throw new GitHubAdapterError("UPSTREAM_UNAVAILABLE", "GitHub App request failed.", 503);
  } finally {
    clearTimeout(timeout);
  }
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

export async function fetchGitHubAppInstallation(
  config: GitHubConfig,
  installationId: number
): Promise<GitHubAppInstallation> {
  const payload = await requestGitHubAppJson<{
    id?: number;
    target_type?: string;
    account?: { login?: string };
  }>(config, `/app/installations/${installationId}`);

  if (
    !Number.isInteger(payload.id) ||
    typeof payload.target_type !== "string" ||
    typeof payload.account?.login !== "string" ||
    payload.account.login.trim().length === 0
  ) {
    throw new GitHubAdapterError("INVALID_RESPONSE", "GitHub App installation response was invalid.", 502);
  }

  const resolvedInstallationId = payload.id as number;

  return {
    installationId: resolvedInstallationId,
    organization: payload.account.login.trim(),
    targetType: payload.target_type.trim()
  };
}

export function createGitHubAppInstallationSession(
  config: GitHubConfig,
  installation: GitHubAppInstallation,
  dependencies: Partial<AppTokenDependencies> = {}
): string {
  const now = dependencies.now ?? (() => Date.now());
  const issuedAtMs = now();

  return buildInstallationSessionToken(
    {
      ...installation,
      issuedAtMs,
      expiresAtMs: issuedAtMs + INSTALLATION_SESSION_TOKEN_TTL_MS
    },
    config
  );
}

export function parseGitHubAppInstallationSession(
  config: GitHubConfig,
  token: string,
  dependencies: Partial<AppTokenDependencies> = {}
): GitHubAppInstallationSession {
  const now = dependencies.now ?? (() => Date.now());
  return parseInstallationSessionToken(token, config, now());
}

export function getCurrentGitHubAppInstallationSession(
  config: GitHubConfig,
  dependencies: Partial<AppTokenDependencies> = {}
): GitHubAppInstallationSession | undefined {
  const token = getGitHubAppSessionToken();
  if (!token) {
    return undefined;
  }

  return parseGitHubAppInstallationSession(config, token, dependencies);
}

export async function resolveGitHubAccessToken(config: GitHubConfig): Promise<string> {
  const appRuntimeConfig = getGitHubAppRuntimeConfig();
  const workspaceId = getAuthenticatedWorkspaceId();
  const authenticatedApp = getAuthenticatedAppContextFromRequestStore();
  const authStore = getAuthStore();
  await authStore.initialize();
  const workspaceConnection = workspaceId
    ? await authStore.findWorkspaceGitHubConnection(workspaceId)
    : undefined;
  const oauthConnection = workspaceId && authenticatedApp
    ? await authStore.findWorkspaceGitHubOAuthConnection(workspaceId, authenticatedApp.user.id)
    : undefined;

  if (config.authProvider === "oauth") {
    if (!config.oauth) {
      throw new GitHubAdapterError("AUTH_MISSING", "GitHub OAuth configuration is unavailable.", 503);
    }

    if (!workspaceId || !authenticatedApp || !oauthConnection) {
      throw new GitHubAdapterError("AUTH_MISSING", "GitHub OAuth connection is required for live GitHub source.", 401);
    }

    try {
      return decryptSecret(
        {
          ciphertext: oauthConnection.accessTokenCiphertext,
          iv: oauthConnection.accessTokenIv,
          tag: oauthConnection.accessTokenTag
        },
        config.oauth.tokenEncryptionKey
      );
    } catch {
      throw new GitHubAdapterError("AUTH_INVALID", "Stored GitHub OAuth token could not be decrypted.", 401);
    }
  }

  if (workspaceConnection && !appRuntimeConfig?.app) {
    throw new GitHubAdapterError(
      "AUTH_MISSING",
      "Workspace GitHub App connection exists but GitHub App runtime configuration is unavailable.",
      503
    );
  }

  if (appRuntimeConfig?.app && workspaceConnection) {
    return installationTokenProvider.getToken({
      apiBaseUrl: appRuntimeConfig.apiBaseUrl,
      appId: appRuntimeConfig.app.appId,
      privateKey: appRuntimeConfig.app.privateKey,
      installationId: workspaceConnection.installationId,
      timeoutMs: appRuntimeConfig.timeoutMs
    });
  }

  if (appRuntimeConfig?.app) {
    const appConfig = appRuntimeConfig.app;
    const installationId = appConfig.installationId ?? getCurrentGitHubAppInstallationSession(appRuntimeConfig)?.installationId;
    if (!installationId) {
      throw new GitHubAdapterError(
        "AUTH_MISSING",
        "GitHub App installation is not connected. Complete GitHub App installation to continue.",
        401
      );
    }

    return installationTokenProvider.getToken({
      apiBaseUrl: appRuntimeConfig.apiBaseUrl,
      appId: appConfig.appId,
      privateKey: appConfig.privateKey,
      installationId,
      timeoutMs: appRuntimeConfig.timeoutMs
    });
  }

  if (config.authProvider === "pat" && config.token) {
    return config.token;
  }

  throw new GitHubAdapterError("AUTH_MISSING", "GITHUB_TOKEN is required for live GitHub source.", 401);
}
