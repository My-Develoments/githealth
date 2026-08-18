import { GitHubAdapterError } from "./errors.js";

export type GitHubConfig = {
  token?: string;
  apiBaseUrl: string;
  timeoutMs: number;
  maxRetries: number;
  retryBaseDelayMs: number;
  maxPaginationPages: number;
  repositoryConcurrency: number;
  signalConcurrency: number;
};

export function getGitHubConfig(): GitHubConfig {
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

  return {
    token,
    apiBaseUrl,
    timeoutMs,
    maxRetries,
    retryBaseDelayMs,
    maxPaginationPages,
    repositoryConcurrency,
    signalConcurrency
  };
}
