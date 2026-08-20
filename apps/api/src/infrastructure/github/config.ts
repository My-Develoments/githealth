import { createPrivateKey } from "node:crypto";
import { GitHubAdapterError } from "./errors.js";

export type GitHubAuthProvider = "pat" | "app" | "oauth";
export type GitHubAuthMode = "local_pat" | "github_app" | "github_oauth";

export type GitHubAppConfig = {
  appId: string;
  privateKey: string;
  clientId?: string;
  clientSecret?: string;
  installationId?: number;
  installUrl?: string;
  onboardingRedirectUrl?: string;
};

export type GitHubConfig = {
  authProvider: GitHubAuthProvider;
  authMode: GitHubAuthMode;
  token?: string;
  app?: GitHubAppConfig;
  oauth?: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    frontendRedirectUrl: string;
    scopes: string[];
    stateTtlMs: number;
    tokenEncryptionKey: string;
    authorizeBaseUrl: string;
    tokenUrl: string;
  };
  apiBaseUrl: string;
  timeoutMs: number;
  maxRetries: number;
  retryBaseDelayMs: number;
  maxPaginationPages: number;
  repositoryConcurrency: number;
  signalConcurrency: number;
};

function hasAnyGitHubAppEnvConfigured(): boolean {
  const keys = [
    "GITHUB_APP_ID",
    "GITHUB_APP_PRIVATE_KEY",
    "GITHUB_APP_INSTALLATION_ID",
    "GITHUB_APP_INSTALL_URL",
    "GITHUB_APP_ONBOARDING_REDIRECT_URL"
  ] as const;

  return keys.some((key) => {
    const value = process.env[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}

function hasAnyGitHubOAuthEnvConfigured(): boolean {
  const keys = [
    "GITHUB_OAUTH_CLIENT_ID",
    "GITHUB_OAUTH_CLIENT_SECRET",
    "GITHUB_OAUTH_REDIRECT_URI",
    "GITHUB_OAUTH_TOKEN_ENCRYPTION_KEY"
  ] as const;

  return keys.some((key) => {
    const value = process.env[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}

function normalizeGitHubAuthProvider(rawValue: string | undefined): GitHubAuthProvider {
  const normalized = typeof rawValue === "string" ? rawValue.trim().toLowerCase() : "";
  if (normalized.length === 0 || normalized === "pat") {
    return "pat";
  }

  if (normalized === "app") {
    return "app";
  }

  if (normalized === "oauth") {
    return "oauth";
  }

  throw new GitHubAdapterError("INVALID_RESPONSE", "Invalid GITHUB_AUTH_PROVIDER value.", 500);
}

function parsePositiveInteger(rawValue: string | undefined, envName: string, fallback: number): number {
  const normalized = parseOptionalString(rawValue);
  if (!normalized) {
    return fallback;
  }

  const value = Number(normalized);
  if (!Number.isInteger(value) || value <= 0) {
    throw new GitHubAdapterError("INVALID_RESPONSE", `Invalid ${envName} value.`, 500);
  }

  return value;
}

function parseRequiredString(rawValue: string | undefined, envName: string): string {
  const normalized = typeof rawValue === "string" ? rawValue.trim() : "";
  if (normalized.length === 0) {
    throw new GitHubAdapterError("INVALID_RESPONSE", `Invalid ${envName} value.`, 500);
  }

  return normalized;
}

function parseOptionalString(rawValue: string | undefined): string | undefined {
  if (typeof rawValue !== "string") {
    return undefined;
  }

  const normalized = rawValue.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function parseOptionalPositiveInteger(rawValue: string | undefined, envName: string): number | undefined {
  const normalized = parseOptionalString(rawValue);
  if (!normalized) {
    return undefined;
  }

  const value = Number(normalized);
  if (!Number.isInteger(value) || value <= 0) {
    throw new GitHubAdapterError("INVALID_RESPONSE", `Invalid ${envName} value.`, 500);
  }

  return value;
}

function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, "\n");
}

function validatePrivateKey(privateKey: string): string {
  try {
    createPrivateKey(privateKey);
  } catch {
    throw new GitHubAdapterError("INVALID_RESPONSE", "Invalid GITHUB_APP_PRIVATE_KEY value.", 500);
  }

  return privateKey;
}

function parseOptionalHttpUrl(rawValue: string | undefined, envName: string): string | undefined {
  const normalized = parseOptionalString(rawValue);
  if (!normalized) {
    return undefined;
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("Unsupported protocol");
    }

    return parsed.toString();
  } catch {
    throw new GitHubAdapterError("INVALID_RESPONSE", `Invalid ${envName} value.`, 500);
  }
}

function buildGitHubAppConfig(): GitHubAppConfig {
  const appId = parseRequiredString(process.env.GITHUB_APP_ID, "GITHUB_APP_ID");
  const privateKey = validatePrivateKey(
    normalizePrivateKey(parseRequiredString(process.env.GITHUB_APP_PRIVATE_KEY, "GITHUB_APP_PRIVATE_KEY"))
  );
  const installationId = parseOptionalPositiveInteger(
    process.env.GITHUB_APP_INSTALLATION_ID,
    "GITHUB_APP_INSTALLATION_ID"
  );
  const installUrl = parseOptionalHttpUrl(process.env.GITHUB_APP_INSTALL_URL, "GITHUB_APP_INSTALL_URL");

  if (!installationId && !installUrl) {
    throw new GitHubAdapterError(
      "INVALID_RESPONSE",
      "GitHub App mode requires GITHUB_APP_INSTALLATION_ID or GITHUB_APP_INSTALL_URL.",
      500
    );
  }

  return {
    appId,
    privateKey,
    clientId: parseOptionalString(process.env.GITHUB_APP_CLIENT_ID),
    clientSecret: parseOptionalString(process.env.GITHUB_APP_CLIENT_SECRET),
    installationId,
    installUrl,
    onboardingRedirectUrl: parseOptionalHttpUrl(
      process.env.GITHUB_APP_ONBOARDING_REDIRECT_URL,
      "GITHUB_APP_ONBOARDING_REDIRECT_URL"
    )
  };
}

function parseScopes(rawValue: string | undefined): string[] {
  const normalized = parseOptionalString(rawValue);
  if (!normalized) {
    return ["read:org", "repo"];
  }

  return [...new Set(normalized.split(",").map((scope) => scope.trim()).filter((scope) => scope.length > 0))];
}

function buildGitHubOAuthConfig() {
  const clientId = parseRequiredString(process.env.GITHUB_OAUTH_CLIENT_ID, "GITHUB_OAUTH_CLIENT_ID");
  const clientSecret = parseRequiredString(process.env.GITHUB_OAUTH_CLIENT_SECRET, "GITHUB_OAUTH_CLIENT_SECRET");
  const redirectUri = parseOptionalHttpUrl(process.env.GITHUB_OAUTH_REDIRECT_URI, "GITHUB_OAUTH_REDIRECT_URI");
  if (!redirectUri) {
    throw new GitHubAdapterError("INVALID_RESPONSE", "Invalid GITHUB_OAUTH_REDIRECT_URI value.", 500);
  }

  const frontendRedirectUrl =
    parseOptionalHttpUrl(process.env.GITHUB_OAUTH_FRONTEND_REDIRECT_URL, "GITHUB_OAUTH_FRONTEND_REDIRECT_URL") ??
    parseOptionalHttpUrl(process.env.GITHUB_APP_ONBOARDING_REDIRECT_URL, "GITHUB_APP_ONBOARDING_REDIRECT_URL");

  if (!frontendRedirectUrl) {
    throw new GitHubAdapterError(
      "INVALID_RESPONSE",
      "GitHub OAuth mode requires GITHUB_OAUTH_FRONTEND_REDIRECT_URL.",
      500
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    frontendRedirectUrl,
    scopes: parseScopes(process.env.GITHUB_OAUTH_SCOPES),
    stateTtlMs: parsePositiveInteger(process.env.GITHUB_OAUTH_STATE_TTL_MS, "GITHUB_OAUTH_STATE_TTL_MS", 600000),
    tokenEncryptionKey: parseRequiredString(
      process.env.GITHUB_OAUTH_TOKEN_ENCRYPTION_KEY,
      "GITHUB_OAUTH_TOKEN_ENCRYPTION_KEY"
    ),
    authorizeBaseUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token"
  };
}

export function getGitHubConfig(): GitHubConfig {
  const authProvider = normalizeGitHubAuthProvider(process.env.GITHUB_AUTH_PROVIDER);

  const rawToken = process.env.GITHUB_TOKEN;
  const token = typeof rawToken === "string" && rawToken.trim().length > 0
    ? rawToken.trim()
    : undefined;

  const rawApiBaseUrl = process.env.GITHUB_API_BASE_URL ?? "https://api.github.com";
  let apiBaseUrl: string;

  try {
    const parsed = new URL(rawApiBaseUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("Unsupported protocol");
    }
    apiBaseUrl = parsed.toString().replace(/\/$/, "");
  } catch {
    throw new GitHubAdapterError("INVALID_RESPONSE", "Invalid GITHUB_API_BASE_URL value.", 500);
  }

  const timeoutMs = Number(process.env.GITHUB_REQUEST_TIMEOUT_MS ?? 8000);
  const maxRetries = Number(process.env.GITHUB_MAX_RETRIES ?? 2);
  const retryBaseDelayMs = Number(process.env.GITHUB_RETRY_BASE_DELAY_MS ?? 100);
  const maxPaginationPages = Number(process.env.GITHUB_MAX_PAGINATION_PAGES ?? 3);
  const repositoryConcurrency = Number(process.env.GITHUB_REPOSITORY_CONCURRENCY ?? 4);
  const signalConcurrency = Number(process.env.GITHUB_SIGNAL_CONCURRENCY ?? 2);

  if (Number.isNaN(timeoutMs) || timeoutMs <= 0) {
    throw new GitHubAdapterError("INVALID_RESPONSE", "Invalid GITHUB_REQUEST_TIMEOUT_MS value.", 500);
  }

  if (Number.isNaN(maxRetries) || maxRetries < 0) {
    throw new GitHubAdapterError("INVALID_RESPONSE", "Invalid GITHUB_MAX_RETRIES value.", 500);
  }

  if (Number.isNaN(retryBaseDelayMs) || retryBaseDelayMs <= 0) {
    throw new GitHubAdapterError("INVALID_RESPONSE", "Invalid GITHUB_RETRY_BASE_DELAY_MS value.", 500);
  }

  if (Number.isNaN(maxPaginationPages) || maxPaginationPages <= 0) {
    throw new GitHubAdapterError("INVALID_RESPONSE", "Invalid GITHUB_MAX_PAGINATION_PAGES value.", 500);
  }

  if (Number.isNaN(repositoryConcurrency) || repositoryConcurrency <= 0) {
    throw new GitHubAdapterError("INVALID_RESPONSE", "Invalid GITHUB_REPOSITORY_CONCURRENCY value.", 500);
  }

  if (Number.isNaN(signalConcurrency) || signalConcurrency <= 0) {
    throw new GitHubAdapterError("INVALID_RESPONSE", "Invalid GITHUB_SIGNAL_CONCURRENCY value.", 500);
  }

  const app = authProvider === "app" ? buildGitHubAppConfig() : undefined;
  const oauth = authProvider === "oauth" ? buildGitHubOAuthConfig() : undefined;
  const authMode: GitHubAuthMode =
    authProvider === "oauth" ? "github_oauth" : authProvider === "app" ? "github_app" : "local_pat";

  return {
    authProvider,
    authMode,
    token,
    app,
    oauth,
    apiBaseUrl,
    timeoutMs,
    maxRetries,
    retryBaseDelayMs,
    maxPaginationPages,
    repositoryConcurrency,
    signalConcurrency
  };
}

export function getOptionalGitHubAppConfig(): GitHubAppConfig | undefined {
  if (!hasAnyGitHubAppEnvConfigured()) {
    return undefined;
  }

  return buildGitHubAppConfig();
}

export function getOptionalGitHubOAuthConfig(): NonNullable<GitHubConfig["oauth"]> | undefined {
  if (!hasAnyGitHubOAuthEnvConfigured()) {
    return undefined;
  }

  return buildGitHubOAuthConfig();
}

export function getGitHubAppRuntimeConfig(): GitHubConfig | undefined {
  const baseConfig = getGitHubConfig();
  const appConfig = baseConfig.authProvider === "app" ? baseConfig.app : getOptionalGitHubAppConfig();

  if (!appConfig) {
    return undefined;
  }

  return {
    ...baseConfig,
    authProvider: "app",
    authMode: "github_app",
    app: appConfig
  };
}
