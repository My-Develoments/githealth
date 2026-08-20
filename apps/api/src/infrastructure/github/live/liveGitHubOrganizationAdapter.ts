import type { GitHubOrganizationDataAdapter, GitHubOrganizationDataRequest } from "../../../application/githubOrganizationDataAdapter.js";
import { mapGitHubSignalsToNormalizedOrganization } from "../../../application/githubSignalMapper.js";
import type { GitHubAdapterIssue } from "../../../application/githubNormalizedModels.js";
import { GitHubAdapterError, normalizeGitHubHttpError } from "../errors.js";
import { resolveGitHubAccessToken } from "../appAuth.js";
import { getGitHubConfig, type GitHubConfig } from "../config.js";
import { runWithRateLimitRetry } from "../rateLimit.js";
import type {
  GitHubOrganizationSlice,
  GitHubRepositorySignalInput,
  GitHubRepositorySlice,
  GitHubWorkflowRunConclusion,
  GitHubWorkflowRunContext,
  GitHubWorkflowRunStatus,
  GitHubWorkflowTelemetrySlice
} from "../types.js";

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
  id?: number;
  name?: string;
  status?: string;
  conclusion?: string;
  event?: string;
  head_branch?: string;
  run_number?: number;
  html_url?: string;
  created_at?: string;
  updated_at?: string;
};

type WorkflowRunsResponse = {
  workflow_runs?: WorkflowRun[];
};

type DependabotAlert = {
  number: number;
  created_at?: string;
};

type CodeScanningAlert = {
  created_at?: string;
};

type PullRequest = {
  created_at?: string;
  draft?: boolean;
};

type IssueRecord = {
  created_at?: string;
  updated_at?: string;
  submitted_at?: string;
  pull_request?: { url?: string } | null;
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
  key: "dependabot-open" | "dependabot-fixed" | "workflow-runs" | "protection" | "code-scanning-alerts" | "pull-requests" | "issues";
  items?: DependabotAlert[] | WorkflowRun[] | CodeScanningAlert[] | PullRequest[] | IssueRecord[];
  data?: ProtectionResponse;
  issues: GitHubAdapterIssue[];
};

const GITHUB_PAGE_SIZE = 100;

function logGitHubUpstreamError(params: {
  status?: number;
  code: string;
  message: string;
  requestUrl: string;
}): void {
  const parsedUrl = (() => {
    try {
      return new URL(params.requestUrl);
    } catch {
      return undefined;
    }
  })();

  const shouldLog =
    params.code === "UPSTREAM_UNAVAILABLE" ||
    params.code === "AUTH_INVALID" ||
    params.code === "RATE_LIMITED" ||
    params.code === "INVALID_RESPONSE" ||
    parsedUrl?.pathname.startsWith("/orgs/") === true;

  if (!shouldLog) {
    return;
  }

  console.warn(
    JSON.stringify({
      event: "github_upstream_error",
      code: params.code,
      status: params.status,
      path: parsedUrl?.pathname,
      message: params.message
    })
  );
}

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

function averageDaysSince<T extends { created_at?: string }>(items: T[]): number | undefined {
  if (items.length === 0) {
    return undefined;
  }

  const ages = items
    .map((item) => daysSince(item.created_at))
    .filter((value): value is number => typeof value === "number");

  if (ages.length === 0) {
    return undefined;
  }

  return clamp(ages.reduce((sum, value) => sum + value, 0) / ages.length, 0, 3650);
}

function oldestDaysSince<T extends { created_at?: string; updated_at?: string; submitted_at?: string }>(items: T[]): number | undefined {
  if (items.length === 0) {
    return undefined;
  }

  const ages = items
    .map((item) => daysSince(item.created_at ?? item.updated_at ?? item.submitted_at))
    .filter((value): value is number => typeof value === "number");

  if (ages.length === 0) {
    return undefined;
  }

  return clamp(Math.max(...ages), 0, 3650);
}

function computeDependabotAlertAgeDays(alerts: DependabotAlert[] | undefined): number | undefined {
  if (!alerts || alerts.length === 0) {
    return undefined;
  }

  const datedAge = oldestDaysSince(alerts);
  return typeof datedAge === "number" ? datedAge : undefined;
}

function workflowFailureRate(runs: WorkflowRun[]): number | undefined {
  const completed = runs.filter(
    (run) => (run.status === "completed" || typeof run.status === "undefined") && typeof run.conclusion === "string"
  );
  if (completed.length === 0) {
    return undefined;
  }

  const failedRuns = completed.filter((run) => {
    const conclusion = toConclusion(run.conclusion);
    return conclusion === "failure" || conclusion === "timed_out" || conclusion === "startup_failure" || conclusion === "action_required";
  }).length;

  return clamp((failedRuns / completed.length) * 100, 0, 100);
}

function toStatus(value: string | undefined): GitHubWorkflowRunStatus {
  if (value === "queued" || value === "in_progress" || value === "completed" || value === "requested" || value === "waiting" || value === "pending") {
    return value;
  }

  return "unknown";
}

function toConclusion(value: string | undefined): GitHubWorkflowRunConclusion {
  if (
    value === "success" ||
    value === "failure" ||
    value === "cancelled" ||
    value === "timed_out" ||
    value === "action_required" ||
    value === "startup_failure" ||
    value === "neutral" ||
    value === "skipped" ||
    value === "stale"
  ) {
    return value;
  }

  return "unknown";
}

function buildWorkflowTelemetry(runs: WorkflowRun[]): GitHubWorkflowTelemetrySlice {
  const completed = runs.filter(
    (run) => (run.status === "completed" || typeof run.status === "undefined") && typeof run.conclusion === "string"
  );
  const successCount = completed.filter((run) => toConclusion(run.conclusion) === "success").length;
  const failureCount = completed.filter((run) => {
    const conclusion = toConclusion(run.conclusion);
    return conclusion === "failure" || conclusion === "timed_out" || conclusion === "startup_failure" || conclusion === "action_required";
  }).length;
  const consideredRuns = successCount + failureCount;

  const latestRunAt = runs
    .map((run) => toDate(run.created_at))
    .filter((value): value is number => typeof value === "number")
    .sort((left, right) => right - left)[0];

  const recentRuns: GitHubWorkflowRunContext[] = [...runs]
    .sort((left, right) => {
      const leftTs = toDate(left.created_at) ?? 0;
      const rightTs = toDate(right.created_at) ?? 0;
      return rightTs - leftTs;
    })
    .slice(0, 8)
    .map((run) => ({
      id: typeof run.id === "number" ? run.id : undefined,
      name: run.name?.trim() || "Unnamed workflow",
      status: toStatus(run.status),
      conclusion: run.conclusion ? toConclusion(run.conclusion) : undefined,
      event: run.event,
      branch: run.head_branch,
      runNumber: run.run_number,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
      url: run.html_url
    }));

  return {
    runSummary: {
      totalRuns: runs.length,
      completedRuns: completed.length,
      successCount,
      failureCount,
      successRate: consideredRuns > 0 ? clamp((successCount / consideredRuns) * 100, 0, 100) : undefined,
      failureRate: consideredRuns > 0 ? clamp((failureCount / consideredRuns) * 100, 0, 100) : undefined,
      latestRunAt: typeof latestRunAt === "number" ? new Date(latestRunAt).toISOString() : undefined
    },
    recentRuns
  };
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

      const normalizedError = normalizeGitHubHttpError(response.status, message, {
        headers: response.headers,
        message
      });

      logGitHubUpstreamError({
        status: response.status,
        code: normalizedError.code,
        message,
        requestUrl: url
      });

      throw normalizedError;
    }

    try {
      return {
        data: (await response.json()) as T,
        headers: response.headers
      };
    } catch {
      throw new GitHubAdapterError("INVALID_RESPONSE", "GitHub upstream returned an invalid JSON response.", 502, {
        upstreamStatus: response.status
      });
    }
  } catch (error) {
    if (error instanceof GitHubAdapterError) {
      throw error;
    }

    logGitHubUpstreamError({
      code: "UPSTREAM_UNAVAILABLE",
      message: "GitHub request failed.",
      requestUrl: url
    });

    throw new GitHubAdapterError("UPSTREAM_UNAVAILABLE", "GitHub request failed.", 503);
  } finally {
    clearTimeout(timeout);
  }
}
async function requestJsonWithRetry<T>(url: string, config: GitHubConfig): Promise<JsonResponse<T>> {
  return runWithRateLimitRetry(
    async () => requestJsonResponse<T>(url, await resolveGitHubAccessToken(config), config.timeoutMs),
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
    const extractedItems = extractItems(response.data);
    if (Array.isArray(extractedItems)) {
      items.push(...extractedItems);
    }
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
    if (
      error instanceof GitHubAdapterError &&
      error.code === "INVALID_RESPONSE" &&
      error.message.toLowerCase().includes("pagination using the `page` parameter is not supported")
    ) {
      try {
        const page = await requestJson<TPage>(url, config);
        const extractedItems = extractItems(page);
        return {
          items: Array.isArray(extractedItems) ? extractedItems : [],
          issues: []
        };
      } catch (fallbackError) {
        if (fallbackError instanceof GitHubAdapterError) {
          return {
            items: undefined,
            issues: [buildOptionalSignalIssue(fallbackError, signalName, repositoryId)]
          };
        }

        throw fallbackError;
      }
    }

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
  const workflowRunsPath = `${config.apiBaseUrl}/repos/${safeName(organization)}/${repoName}/actions/runs`;
  const codeScanningAlertsPath = `${config.apiBaseUrl}/repos/${safeName(organization)}/${repoName}/code-scanning/alerts?state=open`;
  const pullRequestsPath = `${config.apiBaseUrl}/repos/${safeName(organization)}/${repoName}/pulls?state=open&sort=created&direction=desc`;
  const issuesPath = `${config.apiBaseUrl}/repos/${safeName(organization)}/${repoName}/issues?state=open&sort=created&direction=asc`;

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
          (page) => (Array.isArray(page) ? page : page.workflow_runs ?? [])
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
      },
      async () => {
        const result = await requestOptionalPaginated<CodeScanningAlert[], CodeScanningAlert>(
          codeScanningAlertsPath,
          config,
          "Code scanning alerts",
          input.name,
          (page) => page
        );

        return {
          key: "code-scanning-alerts" as const,
          items: result.items,
          issues: result.issues
        };
      },
      async () => {
        const result = await requestOptionalPaginated<PullRequest[], PullRequest>(
          pullRequestsPath,
          config,
          "Pull requests",
          input.name,
          (page) => page
        );

        return {
          key: "pull-requests" as const,
          items: result.items,
          issues: result.issues
        };
      },
      async () => {
        const result = await requestOptionalPaginated<IssueRecord[], IssueRecord>(
          issuesPath,
          config,
          "Repository issues",
          input.name,
          (page) => page
        );

        return {
          key: "issues" as const,
          items: result.items,
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
  const codeScanningAlerts = signalResults.find((result) => result.key === "code-scanning-alerts")?.items as CodeScanningAlert[] | undefined;
  const openPullRequests = signalResults.find((result) => result.key === "pull-requests")?.items as PullRequest[] | undefined;
  const openIssues = signalResults.find((result) => result.key === "issues")?.items as IssueRecord[] | undefined;
  const protection = signalResults.find((result) => result.key === "protection")?.data;

  for (const result of signalResults) {
    issues.push(...result.issues);
  }

  const workflowStats = computeWorkflowStats(workflowRuns ?? []);
  const workflowTelemetry = buildWorkflowTelemetry(workflowRuns ?? []);

  let vulnerabilitiesTotal: number | undefined;
  let vulnerabilitiesResolved: number | undefined;

  if (dependabotOpen && dependabotFixed) {
    vulnerabilitiesResolved = dependabotFixed.length;
    vulnerabilitiesTotal = dependabotOpen.length + dependabotFixed.length;
  } else if (dependabotOpen && !dependabotFixed) {
    vulnerabilitiesResolved = undefined;
    vulnerabilitiesTotal = dependabotOpen.length;
  }

  const openIssuesOnly = (openIssues ?? []).filter((issue) => !issue.pull_request);
  const openPullRequestsOnly = (openPullRequests ?? []).filter((pullRequest) => !pullRequest.draft);
  const reviewQueueAgeDays = averageDaysSince(openPullRequestsOnly);
  const staleIssueAgeDays = oldestDaysSince(openIssuesOnly);
  const codeScanningAlertsOpen = protection && codeScanningAlerts ? codeScanningAlerts.length : undefined;
  const dependabotAlertAgeDays = computeDependabotAlertAgeDays(dependabotOpen);
  const workflowFailureRateValue = workflowFailureRate(workflowRuns ?? []);

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
        vulnerabilitiesTotal,
        codeScanningAlertsOpen
      },
      governance: {
        branchProtectionCoverage:
          typeof input.protected === "boolean"
            ? (input.protected ? 100 : 0)
            : undefined,
        reviewComplianceRate,
        pullRequestReviewQueueAgeDays: reviewQueueAgeDays
      },
      cicd: {
        ciSuccessRate: workflowStats.ciSuccessRate,
        deploymentFrequencyWeekly: workflowStats.deploymentFrequencyWeekly,
        workflowFailureRate: workflowFailureRateValue,
        workflowTelemetry
      },
      quality: {
        testCoverage: workflowStats.testCoverage,
        dependencyFreshness,
        issueHygiene,
        dependabotAlertAgeDays
      },
      repositoryHealth: {
        staleIssueAgeDays: openIssuesOnly.length > 0 ? staleIssueAgeDays : undefined
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

    const organizationSlug = safeName(request.organization);
    const orgPath = `${config.apiBaseUrl}/orgs/${organizationSlug}`;
    const reposPath = `${config.apiBaseUrl}/orgs/${organizationSlug}/repos?type=all`;

    let organization: GitHubOrganizationSlice | undefined = undefined;
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

    return mapGitHubSignalsToNormalizedOrganization(
      {
        organization: organization ?? {
          login: request.organization,
          name: request.organization
        },
        repositories: mappedRepos,
        calculatedAt: new Date().toISOString()
      },
      {
        adapterIssues,
        fetchStatus: adapterIssues.length > 0 ? "partial" : "complete"
      }
    );
  }
}
