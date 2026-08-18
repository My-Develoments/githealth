import {
  requestJson,
  type GitHubHealthApiError
} from "./githubHealthApiClient";
import { resolveGitHubHealthConfig } from "./githubHealthConfig";
import type {
  GitHubAdapterIssue,
  GitHubFetchStatus,
  GitHubHealthIntegrationState,
  GitHubOrganizationScoreResponse,
  GitHubRepositoryScoresResponse,
  GitHubSource
} from "./githubHealthContracts";

export type GitHubHealthRawData = {
  source: GitHubSource;
  organization: GitHubOrganizationScoreResponse["organization"];
  repositories: GitHubRepositoryScoresResponse["repositories"];
  fetchStatus: GitHubFetchStatus;
  adapterIssues: GitHubAdapterIssue[];
};

export type GitHubHealthAdapterSuccess = {
  state: Exclude<GitHubHealthIntegrationState, "loading" | "error">;
  data: GitHubHealthRawData;
};

export type GitHubHealthAdapterFailure = {
  state: "error";
  error: {
    message: string;
    code: string;
    status: number;
  };
};

export type GitHubHealthAdapterResult = GitHubHealthAdapterSuccess | GitHubHealthAdapterFailure;

export async function fetchGitHubHealthData(signal?: AbortSignal): Promise<GitHubHealthAdapterResult> {
  const config = resolveGitHubHealthConfig();
  const organizationUrl = buildEndpoint(config.apiBaseUrl, "/health-score/github/organization", config.organization, config.source);
  const repositoriesUrl = buildEndpoint(config.apiBaseUrl, "/health-score/github/repositories", config.organization, config.source);

  try {
    const [organizationResponse, repositoriesResponse] = await Promise.all([
      requestJson<GitHubOrganizationScoreResponse>(organizationUrl, { signal }),
      requestJson<GitHubRepositoryScoresResponse>(repositoriesUrl, { signal })
    ]);

    const fetchStatus = mergeFetchStatus(organizationResponse.fetchStatus, repositoriesResponse.fetchStatus);
    const repositories = repositoriesResponse.repositories;

    const data: GitHubHealthRawData = {
      source: organizationResponse.source,
      organization: organizationResponse.organization,
      repositories,
      fetchStatus,
      adapterIssues: mergeAdapterIssues(organizationResponse.adapterIssues, repositoriesResponse.adapterIssues)
    };

    return {
      state: resolveState(fetchStatus, repositories.length),
      data
    };
  } catch (error) {
    const apiError = error as GitHubHealthApiError;
    return {
      state: "error",
      error: {
        message: apiError.message || "Unable to load GitHub health data.",
        code: apiError.code || "UPSTREAM_UNAVAILABLE",
        status: Number.isFinite(apiError.status) ? apiError.status : 0
      }
    };
  }
}

function buildEndpoint(apiBaseUrl: string, path: string, org: string, source: GitHubSource): string {
  const url = new URL(`${apiBaseUrl}${path}`, window.location.origin);
  url.searchParams.set("org", org);
  url.searchParams.set("source", source);
  return url.toString();
}

function mergeFetchStatus(left: GitHubFetchStatus, right: GitHubFetchStatus): GitHubFetchStatus {
  if (left === "failed" || right === "failed") {
    return "failed";
  }
  if (left === "partial" || right === "partial") {
    return "partial";
  }
  return "complete";
}

function mergeAdapterIssues(left: GitHubAdapterIssue[], right: GitHubAdapterIssue[]): GitHubAdapterIssue[] {
  const combined = [...left, ...right];
  const seen = new Set<string>();

  return combined.filter((issue) => {
    const key = `${issue.code}:${issue.repositoryId ?? "org"}:${issue.message}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function resolveState(fetchStatus: GitHubFetchStatus, repositoryCount: number): Exclude<GitHubHealthIntegrationState, "loading" | "error"> {
  if (fetchStatus === "failed") {
    return "failed";
  }
  if (fetchStatus === "partial") {
    return "partial";
  }
  if (repositoryCount === 0) {
    return "empty";
  }
  return "ready";
}
