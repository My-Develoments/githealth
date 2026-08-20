import { resolveGitHubAccessToken } from "./appAuth.js";
import { getGitHubConfig } from "./config.js";
import { GitHubAdapterError, normalizeGitHubHttpError } from "./errors.js";

type GitHubUserResponse = {
  login?: string;
};

type GitHubOrganizationResponse = {
  login?: string;
};

type GitHubRepositorySummary = {
  name?: string;
};

export type GitHubLiveAccessValidationResult = {
  organization: string;
  authenticatedLogin: string;
  repositoryCountSample: number;
};

function logGitHubAccessValidationError(params: {
  code: string;
  message: string;
  status?: number;
  upstreamStatus?: number;
  organization?: string;
  requestUrl?: string;
}): void {
  const parsedUrl = (() => {
    if (!params.requestUrl) {
      return undefined;
    }

    try {
      return new URL(params.requestUrl);
    } catch {
      return undefined;
    }
  })();

  console.warn(
    JSON.stringify({
      event: "github_access_validation_error",
      code: params.code,
      status: params.status,
      upstreamStatus: params.upstreamStatus,
      organization: params.organization,
      path: parsedUrl?.pathname,
      message: params.message
    })
  );
}

function encodeSegment(value: string): string {
  return encodeURIComponent(value.trim());
}

async function requestGitHubJson<T>(
  url: string,
  token: string,
  timeoutMs: number,
  organization?: string
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`
      },
      signal: controller.signal
    });

    if (!response.ok) {
      let message = "Unexpected GitHub response.";

      try {
        const payload = (await response.json()) as { message?: string };
        if (typeof payload.message === "string" && payload.message.trim().length > 0) {
          message = payload.message;
        }
      } catch {
        // Keep generic message when payload cannot be parsed.
      }

      const normalized = normalizeGitHubHttpError(response.status, message, {
        headers: response.headers,
        message
      });
      logGitHubAccessValidationError({
        code: normalized.code,
        status: normalized.status,
        upstreamStatus: normalized.upstreamStatus,
        organization,
        requestUrl: url,
        message
      });
      throw new GitHubAdapterError(normalized.code, normalized.message, normalized.status, {
        upstreamStatus: normalized.upstreamStatus,
        organization
      });
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new GitHubAdapterError(
        "INVALID_RESPONSE",
        "GitHub upstream returned an invalid JSON response.",
        502,
        {
          upstreamStatus: response.status,
          organization
        }
      );
    }
  } catch (error) {
    if (error instanceof GitHubAdapterError) {
      throw error;
    }

    logGitHubAccessValidationError({
      code: "UPSTREAM_UNAVAILABLE",
      status: 503,
      organization,
      requestUrl: url,
      message: "GitHub request failed."
    });

    throw new GitHubAdapterError("UPSTREAM_UNAVAILABLE", "GitHub request failed.", 503, {
      organization
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function validateGitHubLiveAccessForOrganization(
  organization: string
): Promise<GitHubLiveAccessValidationResult> {
  const normalizedOrganization = organization.trim();
  if (normalizedOrganization.length === 0) {
    throw new GitHubAdapterError("INVALID_RESPONSE", "Organization is required for GitHub validation.", 500);
  }

  const config = getGitHubConfig();
  const token = await resolveGitHubAccessToken(config);

  const user = await requestGitHubJson<GitHubUserResponse>(
    `${config.apiBaseUrl}/user`,
    token,
    config.timeoutMs,
    normalizedOrganization
  );

  const userLogin = user.login?.trim();
  if (!userLogin) {
    throw new GitHubAdapterError("INVALID_RESPONSE", "GitHub user response did not include a login.", 502, {
      organization: normalizedOrganization,
      upstreamStatus: 200
    });
  }

  const org = await requestGitHubJson<GitHubOrganizationResponse>(
    `${config.apiBaseUrl}/orgs/${encodeSegment(normalizedOrganization)}`,
    token,
    config.timeoutMs,
    normalizedOrganization
  );

  const orgLogin = org.login?.trim();
  if (!orgLogin) {
    throw new GitHubAdapterError("INVALID_RESPONSE", "GitHub organization response did not include a login.", 502, {
      organization: normalizedOrganization,
      upstreamStatus: 200
    });
  }

  const repositories = await requestGitHubJson<GitHubRepositorySummary[]>(
    `${config.apiBaseUrl}/orgs/${encodeSegment(normalizedOrganization)}/repos?type=all&per_page=1`,
    token,
    config.timeoutMs,
    normalizedOrganization
  );

  if (!Array.isArray(repositories)) {
    throw new GitHubAdapterError("INVALID_RESPONSE", "GitHub repositories response was not an array.", 502, {
      organization: normalizedOrganization,
      upstreamStatus: 200
    });
  }

  return {
    organization: normalizedOrganization,
    authenticatedLogin: userLogin,
    repositoryCountSample: repositories.length
  };
}
