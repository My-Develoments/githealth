import type { GitHubOrganizationDataAdapter, GitHubOrganizationDataRequest } from "../../../application/githubOrganizationDataAdapter.js";
import { mapGitHubSignalsToNormalizedOrganization } from "../../../application/githubSignalMapper.js";
import type { GitHubAdapterIssue } from "../../../application/githubNormalizedModels.js";
import { GitHubAdapterError, normalizeGitHubHttpError } from "../errors.js";
import { getGitHubConfig, type GitHubConfig } from "../config.js";
import { runWithRateLimitRetry } from "../rateLimit.js";
import type { GitHubOrganizationSlice, GitHubRepositorySignalInput, GitHubRepositorySlice } from "../types.js";

type RepositoryListItem = {
  name: string;
  pushed_at?: string;
  archived?: boolean;
  protected?: boolean;
  open_issues_count?: number;
  default_branch?: string;
};

type ProtectionResponse = {
  required_pull_request_reviews?: {
    required_approving_review_count?: number;
  } | null;
};

type WorkflowRun = {
  name?: string;
  conclusion?: string;
  created_at?: string;
};

type WorkflowRunsResponse = {
  workflow_runs?: WorkflowRun[];
};

type DependabotAlert = {
  number: number;
};

type JsonResponse<T> = {
  data: T;
  headers: Headers;
};

type PaginationResult<T> = {
  items: T[];
  truncated: boolean;
};

type RepositoryMappingResult = {
  repository: GitHubRepositorySignalInput;
  issues: GitHubAdapterIssue[];
};

type SignalTaskResult = {
  key: "dependabot-open" | "dependabot-fixed" | "workflow-runs" | "protection";
  items?: DependabotAlert[] | WorkflowRun[];
  data?: ProtectionResponse;
  issues: GitHubAdapterIssue[];
};

const GITHUB_PAGE_SIZE = 100;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function daysSince(isoDate: string | undefined): number | undefined {
  if (!isoDate) {
    return undefined;
  }

  const now = Date.now();
  const input = new Date(isoDate).getTime();
  if (Number.isNaN(input)) {
    return undefined;
  }

  return Math.max(0, Math.floor((now - input) / (1000 * 60 * 60 * 24)));
}

function toDate(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? undefined : timestamp;
}

function safeName(value: string): string {
  return encodeURIComponent(value);
}

function withPagination(url: string, page: number, perPage: number): string {
  const parsed = new URL(url);
  parsed.searchParams.set("page", String(page));
  parsed.searchParams.set("per_page", String(perPage));
  return parsed.toString();
}

function getNextLink(headers: Headers): string | undefined {
  const linkHeader = headers.get("link");
  if (!linkHeader) {
    return undefined;
  }

  for (const part of linkHeader.split(",")) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match?.[2] === "next") {
      return match[1];
    }
  }

  return undefined;
}

async function runWithConcurrencyLimit<TInput, TOutput>(
  items: TInput[],
  limit: number,
  worker: (item: TInput, index: number) => Promise<TOutput>
): Promise<TOutput[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<TOutput>(items.length);
  let nextIndex = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex] as TInput, currentIndex);
    }
  });

  await Promise.all(runners);
  return results;
}

async function requestJsonResponse<T>(url: string, token: string, timeoutMs: number): Promise<JsonResponse<T>> {
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
        if (typeof payload.message === "string" && payload.message.length > 0) {
          message = payload.message;
        }
      } catch {
        // Keep fallback message when error payload is not JSON.
      }

      throw normalizeGitHubHttpError(response.status, message, {
        headers: response.headers,
        message
      });
    }

    return {
      data: (await response.json()) as T,
      headers: response.headers
    };
  } catch (error) {
    if (error instanceof GitHubAdapterError) {
      throw error;
    }

    throw new GitHubAdapterError("UPSTREAM_UNAVAILABLE", "GitHub request failed.", 503);
  } finally {
    clearTimeout(timeout);
  }
}

async function requestJsonWithRetry<T>(url: string, config: GitHubConfig): Promise<JsonResponse<T>> {
  return runWithRateLimitRetry(
    () => requestJsonResponse<T>(url, config.token as string, config.timeoutMs),
    {
      maxRetries: config.maxRetries,
      baseDelayMs: config.retryBaseDelayMs
    }
  );
}

async function requestJson<T>(url: string, config: GitHubConfig): Promise<T> {
  const response = await requestJsonWithRetry<T>(url, config);
  return response.data;
}

async function requestPaginated<TPage, TItem>(
  url: string,
  config: GitHubConfig,
  extractItems: (page: TPage) => TItem[]
): Promise<PaginationResult<TItem>> {
  const items: TItem[] = [];
  let page = 1;
  let nextUrl: string | undefined = withPagination(url, page, GITHUB_PAGE_SIZE);

  while (nextUrl && page <= config.maxPaginationPages) {
    const response = await requestJsonWithRetry<TPage>(nextUrl, config);
    items.push(...extractItems(response.data));
    nextUrl = getNextLink(response.headers);
    page += 1;
  }

  return {
    items,
    truncated: Boolean(nextUrl)
  };
}

function buildOptionalSignalIssue(
  error: GitHubAdapterError,
  signalName: string,
  repositoryId: string
): GitHubAdapterIssue {
  return {
    code: error.code,
    message: `${signalName} is unavailable: ${error.message}`,
    repositoryId
  };
}

function buildTruncationIssue(
  signalName: string,
  maxPages: number,
  repositoryId?: string
): GitHubAdapterIssue {
  return {
    code: "DATA_TRUNCATED",
    message: `${signalName} was truncated after reaching the ${maxPages}-page safety limit.`,
    repositoryId
  };
}

function buildRequiredCollectionIssue(
  error: GitHubAdapterError,
  scope: "organization" | "repositories",
  _organizationId: string
): GitHubAdapterIssue {
  return {
    code: error.code,
    message: `Required ${scope} collection failed: ${error.message}`
  };
}

function shouldNormalizeRequiredCollectionFailure(error: unknown): error is GitHubAdapterError {
  return (
    error instanceof GitHubAdapterError &&
    (error.code === "UPSTREAM_UNAVAILABLE" || error.code === "INVALID_RESPONSE")
  );
}

function toFailedNormalizedOrganization(
  request: GitHubOrganizationDataRequest,
  issue: GitHubAdapterIssue,
  organization?: GitHubOrganizationSlice
) {
  return mapGitHubSignalsToNormalizedOrganization(
    {
      organization: organization ?? {
        login: request.organization,
        name: request.organization
      },
      repositories: [],
      calculatedAt: new Date().toISOString()
    },
    {
      adapterIssues: [issue],
      fetchStatus: "failed"
    }
  );
}

async function requestOptionalJson<T>(
  url: string,
  config: GitHubConfig,
  signalName: string,
  repositoryId: string
): Promise<{ data: T | undefined; issues: GitHubAdapterIssue[] }> {
  try {
    return {
      data: await requestJson<T>(url, config),
      issues: []
    };
  } catch (error) {
    if (error instanceof GitHubAdapterError) {
      return {
        data: undefined,
        issues: [buildOptionalSignalIssue(error, signalName, repositoryId)]
      };
    }

    throw error;
  }
}

async function requestOptionalPaginated<TPage, TItem>(
  url: string,
  config: GitHubConfig,
  signalName: string,
  repositoryId: string,
  extractItems: (page: TPage) => TItem[]
): Promise<{ items: TItem[] | undefined; issues: GitHubAdapterIssue[] }> {
  try {
    const result = await requestPaginated<TPage, TItem>(url, config, extractItems);
    return {
      items: result.items,
      issues: result.truncated
        ? [buildTruncationIssue(signalName, config.maxPaginationPages, repositoryId)]
        : []
    };
  } catch (error) {
    if (error instanceof GitHubAdapterError) {
      return {
        items: undefined,
        issues: [buildOptionalSignalIssue(error, signalName, repositoryId)]
      };
    }

    throw error;
  }
}

function computeWorkflowStats(runs: WorkflowRun[]): {
  ciSuccessRate: number | undefined;
  deploymentFrequencyWeekly: number | undefined;
  testCoverage: number | undefined;
} {
  if (runs.length === 0) {
    return {
      ciSuccessRate: undefined,
      deploymentFrequencyWeekly: undefined,
      testCoverage: undefined
    };
  }

  const successfulRuns = runs.filter((run) => run.conclusion === "success").length;
  const ciSuccessRate = clamp((successfulRuns / runs.length) * 100, 0, 100);

  const datedRuns = runs
    .map((run) => toDate(run.created_at))
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => a - b);

  let deploymentFrequencyWeekly: number | undefined;
  if (datedRuns.length > 1) {
    const spanDays = Math.max(1, Math.ceil((datedRuns[datedRuns.length - 1] - datedRuns[0]) / (1000 * 60 * 60 * 24)));
    deploymentFrequencyWeekly = clamp((runs.length / spanDays) * 7, 0, 30);
  } else if (datedRuns.length === 1) {
    deploymentFrequencyWeekly = Math.min(runs.length, 30);
  }

  const testRuns = runs.filter((run) => {
    const name = run.name?.toLowerCase() ?? "";
    return name.includes("test") || name.includes("unit") || name.includes("integration");
  });

  let testCoverage: number | undefined;
  if (testRuns.length > 0) {
    const successfulTests = testRuns.filter((run) => run.conclusion === "success").length;
    testCoverage = clamp((successfulTests / testRuns.length) * 100, 0, 100);
  }

  return {
    ciSuccessRate,
    deploymentFrequencyWeekly,
    testCoverage
  };
}

async function mapRepositorySlice(
  input: GitHubRepositorySlice,
  organization: string,
  defaultBranch: string | undefined,
  config: GitHubConfig
): Promise<RepositoryMappingResult> {
  const repoName = safeName(input.name);
  const issues: GitHubAdapterIssue[] = [];

  const dependabotOpenPath = `${config.apiBaseUrl}/repos/${safeName(organization)}/${repoName}/dependabot/alerts?state=open`;
  const dependabotFixedPath = `${config.apiBaseUrl}/repos/${safeName(organization)}/${repoName}/dependabot/alerts?state=fixed`;
  const workflowRunsPath = `${config.apiBaseUrl}/repos/${safeName(organization)}/${repoName}/actions/runs?status=completed`;

  const protectionPath = defaultBranch
    ? `${config.apiBaseUrl}/repos/${safeName(organization)}/${repoName}/branches/${safeName(defaultBranch)}/protection`
    : undefined;

  const signalResults = await runWithConcurrencyLimit<() => Promise<SignalTaskResult>, SignalTaskResult>(
    [
      async () => {
        const result = await requestOptionalPaginated<DependabotAlert[], DependabotAlert>(
          dependabotOpenPath,
          config,
          "Dependabot open alerts",
          input.name,
          (page) => page
        );

        return {
          key: "dependabot-open",
          items: result.items,
          issues: result.issues
        };
      },
      async () => {
        const result = await requestOptionalPaginated<DependabotAlert[], DependabotAlert>(
          dependabotFixedPath,
          config,
          "Dependabot fixed alerts",
          input.name,
          (page) => page
        );

        return {
          key: "dependabot-fixed",
          items: result.items,
          issues: result.issues
        };
      },
      async () => {
        const result = await requestOptionalPaginated<WorkflowRunsResponse, WorkflowRun>(
          workflowRunsPath,
          config,
          "Workflow runs",
          input.name,
          (page) => page.workflow_runs ?? []
        );

        return {
          key: "workflow-runs",
          items: result.items,
          issues: result.issues
        };
      },
      async () => {
        if (!protectionPath) {
          return {
            key: "protection" as const,
            data: undefined,
            issues: []
          };
        }

        const result = await requestOptionalJson<ProtectionResponse>(
          protectionPath,
          config,
          "Branch protection settings",
          input.name
        );

        return {
          key: "protection" as const,
          data: result.data,
          issues: result.issues
        };
      }
    ],
    config.signalConcurrency,
    (task) => task()
  );

  const dependabotOpen = signalResults.find((result) => result.key === "dependabot-open")?.items as DependabotAlert[] | undefined;
  const dependabotFixed = signalResults.find((result) => result.key === "dependabot-fixed")?.items as DependabotAlert[] | undefined;
  const workflowRuns = signalResults.find((result) => result.key === "workflow-runs")?.items as WorkflowRun[] | undefined;
  const protection = signalResults.find((result) => result.key === "protection")?.data;

  for (const result of signalResults) {
    issues.push(...result.issues);
  }

  const workflowStats = computeWorkflowStats(workflowRuns ?? []);

  let vulnerabilitiesTotal: number | undefined;
  let vulnerabilitiesResolved: number | undefined;

  if (dependabotOpen && dependabotFixed) {
    vulnerabilitiesResolved = dependabotFixed.length;
    vulnerabilitiesTotal = dependabotOpen.length + dependabotFixed.length;
  } else if (dependabotOpen && !dependabotFixed) {
    vulnerabilitiesResolved = undefined;
    vulnerabilitiesTotal = dependabotOpen.length;
  }

  const openIssueCount = input.openIssuesCount;
  const pushRecencyDays = daysSince(input.pushedAt);

  const dependencyFreshness = typeof pushRecencyDays === "number"
    ? clamp(100 - (pushRecencyDays / 180) * 100, 0, 100)
    : undefined;

  const issueHygiene = typeof openIssueCount === "number"
    ? clamp(100 - openIssueCount * 4, 0, 100)
    : undefined;

  let reviewComplianceRate: number | undefined;
  if (protection?.required_pull_request_reviews) {
    const approvals = protection.required_pull_request_reviews.required_approving_review_count;
    if (typeof approvals === "number") {
      reviewComplianceRate = clamp(60 + approvals * 20, 0, 100);
    } else {
      reviewComplianceRate = 80;
    }
  }

  return {
    repository: {
      repository: {
        name: input.name,
        pushedAt: input.pushedAt,
        archived: input.archived,
        protected: input.protected,
        openIssuesCount: input.openIssuesCount,
        importance: input.importance
      },
      security: {
        openAlerts: dependabotOpen?.length,
        vulnerabilitiesResolved,
        vulnerabilitiesTotal
      },
      governance: {
        branchProtectionCoverage:
          typeof input.protected === "boolean"
            ? (input.protected ? 100 : 0)
            : undefined,
        reviewComplianceRate
      },
      cicd: {
        ciSuccessRate: workflowStats.ciSuccessRate,
        deploymentFrequencyWeekly: workflowStats.deploymentFrequencyWeekly
      },
      quality: {
        testCoverage: workflowStats.testCoverage,
        dependencyFreshness,
        issueHygiene
      }
    },
    issues
  };
}

function mapBaseRepositorySlice(input: RepositoryListItem): GitHubRepositorySlice {
  return {
    name: input.name,
    pushedAt: input.pushed_at,
    archived: input.archived,
    protected: input.protected,
    openIssuesCount: input.open_issues_count
  };
}

export class LiveGitHubOrganizationAdapter implements GitHubOrganizationDataAdapter {
  async fetchOrganizationData(request: GitHubOrganizationDataRequest) {
    const config = getGitHubConfig();
    if (!config.token) {
      throw new GitHubAdapterError("AUTH_MISSING", "GITHUB_TOKEN is required for live GitHub source.", 401);
    }

    const orgPath = `${config.apiBaseUrl}/orgs/${request.organization}`;
    const reposPath = `${config.apiBaseUrl}/orgs/${request.organization}/repos?type=all`;

    let organization: GitHubOrganizationSlice;
    try {
      organization = await requestJson<GitHubOrganizationSlice>(orgPath, config);
    } catch (error) {
      if (shouldNormalizeRequiredCollectionFailure(error)) {
        return toFailedNormalizedOrganization(
          request,
          buildRequiredCollectionIssue(error, "organization", request.organization)
        );
      }

      throw error;
    }

    let repositoryPage: PaginationResult<RepositoryListItem>;
    try {
      repositoryPage = await requestPaginated<RepositoryListItem[], RepositoryListItem>(
        reposPath,
        config,
        (page) => page
      );
    } catch (error) {
      if (shouldNormalizeRequiredCollectionFailure(error)) {
        return toFailedNormalizedOrganization(
          request,
          buildRequiredCollectionIssue(error, "repositories", request.organization),
          organization
        );
      }

      throw error;
    }

    const adapterIssues: GitHubAdapterIssue[] = [];
    if (repositoryPage.truncated) {
      adapterIssues.push(buildTruncationIssue("Organization repositories", config.maxPaginationPages));
    }

    const selected = repositoryPage.items.filter((repository) => !request.repository || repository.name === request.repository);

    const mappedRepositories = await runWithConcurrencyLimit(
      selected,
      config.repositoryConcurrency,
      (repository) =>
        mapRepositorySlice(
          mapBaseRepositorySlice(repository),
          request.organization,
          repository.default_branch,
          config
        )
    );

    const mappedRepos = mappedRepositories.map((value) => value.repository);
    for (const value of mappedRepositories) {
      adapterIssues.push(...value.issues);
    }

    return mapGitHubSignalsToNormalizedOrganization({
      organization,
      repositories: mappedRepos,
      calculatedAt: new Date().toISOString()
    }, {
      adapterIssues,
      fetchStatus: adapterIssues.length > 0 ? "partial" : "complete"
    });
  }
}
