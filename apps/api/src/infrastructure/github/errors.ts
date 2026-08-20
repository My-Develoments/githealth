import type { GitHubAdapterIssueCode } from "../../application/githubNormalizedModels.js";

export class GitHubAdapterError extends Error {
  readonly code: GitHubAdapterIssueCode;
  readonly status: number;
  readonly upstreamStatus?: number;
  readonly organization?: string;

  constructor(
    code: GitHubAdapterIssueCode,
    message: string,
    status = 500,
    metadata?: {
      upstreamStatus?: number;
      organization?: string;
    }
  ) {
    super(message);
    this.name = "GitHubAdapterError";
    this.code = code;
    this.status = status;
    this.upstreamStatus = metadata?.upstreamStatus;
    this.organization = metadata?.organization;
  }
}

type ErrorContext = {
  message?: string;
  headers?: {
    get: (name: string) => string | null;
  };
};

function isRateLimit403(context?: ErrorContext): boolean {
  const message = context?.message?.toLowerCase() ?? "";
  const remaining = context?.headers?.get("x-ratelimit-remaining");
  const retryAfter = context?.headers?.get("retry-after");

  return (
    remaining === "0" ||
    retryAfter != null ||
    message.includes("secondary rate limit") ||
    message.includes("rate limit exceeded") ||
    message.includes("abuse detection")
  );
}

export function normalizeGitHubHttpError(
  status: number,
  fallbackMessage: string,
  context?: ErrorContext
): GitHubAdapterError {
  if (status === 401) {
    return new GitHubAdapterError("AUTH_INVALID", "GitHub authentication failed.", 401, {
      upstreamStatus: status
    });
  }

  if (status === 403) {
    if (isRateLimit403(context)) {
      return new GitHubAdapterError("RATE_LIMITED", "GitHub rate limit exceeded.", 429, {
        upstreamStatus: status
      });
    }

    return new GitHubAdapterError("PERMISSION_DENIED", "GitHub access forbidden for requested organization.", 403, {
      upstreamStatus: status
    });
  }

  if (status === 404) {
    return new GitHubAdapterError("NOT_FOUND", "GitHub organization or repository not found.", 404, {
      upstreamStatus: status
    });
  }

  if (status === 429) {
    return new GitHubAdapterError("RATE_LIMITED", "GitHub rate limit exceeded.", 429, {
      upstreamStatus: status
    });
  }

  if (status >= 500) {
    return new GitHubAdapterError("UPSTREAM_UNAVAILABLE", "GitHub upstream is unavailable.", 503, {
      upstreamStatus: status
    });
  }

  return new GitHubAdapterError("INVALID_RESPONSE", fallbackMessage, 502, {
    upstreamStatus: status
  });
}
