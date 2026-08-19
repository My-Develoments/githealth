import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveGitHubOrganizationAdapter } from "./liveGitHubOrganizationAdapter.js";

function restoreEnv(name: string, previous: string | undefined): void {
  if (typeof previous === "undefined") {
    delete process.env[name];
    return;
  }

  process.env[name] = previous;
}

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...(headers ?? {})
    }
  });
}

describe("LiveGitHubOrganizationAdapter", () => {
  const previousToken = process.env.GITHUB_TOKEN;
  const previousRetryDelay = process.env.GITHUB_RETRY_BASE_DELAY_MS;
  const previousMaxRetries = process.env.GITHUB_MAX_RETRIES;
  const previousMaxPages = process.env.GITHUB_MAX_PAGINATION_PAGES;
  const previousRepoConcurrency = process.env.GITHUB_REPOSITORY_CONCURRENCY;
  const previousSignalConcurrency = process.env.GITHUB_SIGNAL_CONCURRENCY;

  afterEach(() => {
    vi.restoreAllMocks();
    restoreEnv("GITHUB_TOKEN", previousToken);
    restoreEnv("GITHUB_RETRY_BASE_DELAY_MS", previousRetryDelay);
    restoreEnv("GITHUB_MAX_RETRIES", previousMaxRetries);
    restoreEnv("GITHUB_MAX_PAGINATION_PAGES", previousMaxPages);
    restoreEnv("GITHUB_REPOSITORY_CONCURRENCY", previousRepoConcurrency);
    restoreEnv("GITHUB_SIGNAL_CONCURRENCY", previousSignalConcurrency);
  });

  it("ingests security/governance/cicd/quality/review signals in live mode", async () => {
    process.env.GITHUB_TOKEN = "test-token";

    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ login: "org", name: "Org" }))
      .mockResolvedValueOnce(jsonResponse([
        {
          name: "repo-a",
          pushed_at: "2026-01-01T00:00:00.000Z",
          archived: false,
          protected: true,
          open_issues_count: 3,
          default_branch: "main"
        }
      ]))
      .mockResolvedValueOnce(jsonResponse([{ number: 1 }, { number: 2 }]))
      .mockResolvedValueOnce(jsonResponse([{ number: 3 }, { number: 4 }, { number: 5 }]))
      .mockResolvedValueOnce(jsonResponse({
        workflow_runs: [
          { name: "test", conclusion: "success", created_at: "2026-01-01T00:00:00.000Z" },
          { name: "build", conclusion: "success", created_at: "2026-01-02T00:00:00.000Z" }
        ]
      }))
      .mockResolvedValueOnce(jsonResponse({
        required_pull_request_reviews: {
          required_approving_review_count: 2
        }
      }));

    const adapter = new LiveGitHubOrganizationAdapter();
    const result = await adapter.fetchOrganizationData({
      organization: "org",
      source: "live"
    });

    expect(result.fetchStatus).toBe("complete");
    expect(result.issues).toHaveLength(0);
    const metrics = result.repositories[0]?.metrics;
    expect(metrics?.security_alerts_open).toBe(2);
    expect(metrics?.code_scanning_alerts_open).toBe(0);
    expect(metrics?.vuln_resolution_rate).toBe(60);
    expect(metrics?.branch_protection_coverage).toBe(100);
    expect(metrics?.review_compliance_rate).toBe(100);
    expect(metrics?.pull_request_review_queue_age_days).toBeUndefined();
    expect(metrics?.ci_success_rate).toBe(100);
    expect(metrics?.deployment_frequency_weekly).toBeGreaterThan(0);
    expect(metrics?.workflow_failure_rate).toBe(0);
    expect(metrics?.test_coverage).toBe(100);
    expect(metrics?.dependency_freshness).toBeDefined();
    expect(metrics?.issue_hygiene).toBeDefined();
    expect(metrics?.dependabot_alert_age_days).toBeUndefined();
    expect(metrics?.stale_issue_age_days).toBeUndefined();
    expect(result.repositories[0]?.cicdTelemetry?.runSummary.totalRuns).toBe(2);
    expect(result.repositories[0]?.cicdTelemetry?.runSummary.successCount).toBe(2);
    expect(result.repositories[0]?.cicdTelemetry?.recentRuns[0]?.name).toBe("build");
  });

  it("keeps branch protection undefined when upstream value is unknown", async () => {
    process.env.GITHUB_TOKEN = "test-token";

    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ login: "org", name: "Org" }))
      .mockResolvedValueOnce(jsonResponse([
        {
          name: "repo-b",
          pushed_at: "2026-01-01T00:00:00.000Z",
          archived: false,
          open_issues_count: 1,
          default_branch: "main"
        }
      ]))
      .mockResolvedValueOnce(jsonResponse([], 200))
      .mockResolvedValueOnce(jsonResponse({ message: "Resource not accessible by integration" }, 403))
      .mockResolvedValueOnce(jsonResponse({ workflow_runs: [] }, 200))
      .mockResolvedValueOnce(jsonResponse({ message: "Resource not accessible by integration" }, 403));

    const adapter = new LiveGitHubOrganizationAdapter();
    const result = await adapter.fetchOrganizationData({
      organization: "org",
      source: "live"
    });

    expect(result.fetchStatus).toBe("partial");
    const metrics = result.repositories[0]?.metrics;
    expect(metrics?.branch_protection_coverage).toBeUndefined();
    expect(metrics?.review_compliance_rate).toBeUndefined();
    expect(metrics?.vuln_resolution_rate).toBeUndefined();
    expect(metrics?.code_scanning_alerts_open).toBeUndefined();
    expect(metrics?.pull_request_review_queue_age_days).toBeUndefined();
    expect(metrics?.workflow_failure_rate).toBeUndefined();
    expect(metrics?.dependabot_alert_age_days).toBeUndefined();
    expect(metrics?.stale_issue_age_days).toBeUndefined();
    expect(result.issues.some((issue) => issue.code === "PERMISSION_DENIED")).toBe(true);
    expect(result.issues.some((issue) => issue.message.includes("Vulnerability resolved count is unavailable."))).toBe(true);
  });

  it("fetches multiple repository pages without truncation", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_REPOSITORY_CONCURRENCY = "1";
    process.env.GITHUB_SIGNAL_CONCURRENCY = "1";

    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ login: "org", name: "Org" }))
      .mockResolvedValueOnce(jsonResponse([
        {
          name: "repo-a",
          pushed_at: "2026-01-01T00:00:00.000Z",
          archived: false,
          protected: true,
          open_issues_count: 2,
          default_branch: "main"
        }
      ], 200, {
        link: '<https://api.github.com/orgs/org/repos?type=all&page=2&per_page=100>; rel="next"'
      }))
      .mockResolvedValueOnce(jsonResponse([
        {
          name: "repo-b",
          pushed_at: "2026-01-02T00:00:00.000Z",
          archived: false,
          protected: true,
          open_issues_count: 1,
          default_branch: "main"
        }
      ]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ workflow_runs: [] }))
      .mockResolvedValueOnce(jsonResponse({ required_pull_request_reviews: { required_approving_review_count: 1 } }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ workflow_runs: [] }))
      .mockResolvedValueOnce(jsonResponse({ required_pull_request_reviews: { required_approving_review_count: 1 } }));

    const adapter = new LiveGitHubOrganizationAdapter();
    const result = await adapter.fetchOrganizationData({ organization: "org", source: "live" });

    expect(result.fetchStatus).toBe("complete");
    expect(result.repositories.map((repository) => repository.name)).toEqual(["repo-a", "repo-b"]);
    expect(result.issues.some((issue) => issue.code === "DATA_TRUNCATED")).toBe(false);
  });

  it("fetches multiple dependabot pages and multiple workflow pages", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_REPOSITORY_CONCURRENCY = "1";
    process.env.GITHUB_SIGNAL_CONCURRENCY = "1";

    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ login: "org", name: "Org" }))
      .mockResolvedValueOnce(jsonResponse([
        {
          name: "repo-a",
          pushed_at: "2026-01-01T00:00:00.000Z",
          archived: false,
          protected: true,
          open_issues_count: 2,
          default_branch: "main"
        }
      ]))
      .mockResolvedValueOnce(jsonResponse([{ number: 1 }, { number: 2 }], 200, {
        link: '<https://api.github.com/repos/org/repo-a/dependabot/alerts?state=open&page=2&per_page=100>; rel="next"'
      }))
      .mockResolvedValueOnce(jsonResponse([{ number: 3 }]))
      .mockResolvedValueOnce(jsonResponse([{ number: 4 }], 200, {
        link: '<https://api.github.com/repos/org/repo-a/dependabot/alerts?state=fixed&page=2&per_page=100>; rel="next"'
      }))
      .mockResolvedValueOnce(jsonResponse([{ number: 5 }]))
      .mockResolvedValueOnce(jsonResponse({
        workflow_runs: [
          { name: "test", conclusion: "success", created_at: "2026-01-01T00:00:00.000Z" },
          { name: "build", conclusion: "success", created_at: "2026-01-02T00:00:00.000Z" }
        ]
      }, 200, {
        link: '<https://api.github.com/repos/org/repo-a/actions/runs?page=2&per_page=100>; rel="next"'
      }))
      .mockResolvedValueOnce(jsonResponse({
        workflow_runs: [
          { name: "integration", conclusion: "success", created_at: "2026-01-03T00:00:00.000Z" }
        ]
      }))
      .mockResolvedValueOnce(jsonResponse({ required_pull_request_reviews: { required_approving_review_count: 2 } }));

    const adapter = new LiveGitHubOrganizationAdapter();
    const result = await adapter.fetchOrganizationData({ organization: "org", source: "live" });

    const metrics = result.repositories[0]?.metrics;
    expect(metrics?.security_alerts_open).toBe(3);
    expect(metrics?.vuln_resolution_rate).toBe(40);
    expect(metrics?.ci_success_rate).toBe(100);
    expect(metrics?.deployment_frequency_weekly).toBeGreaterThan(0);
    expect(metrics?.test_coverage).toBe(100);
  });

  it("emits truncation issue when pagination safety limit is reached", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_MAX_PAGINATION_PAGES = "1";
    process.env.GITHUB_REPOSITORY_CONCURRENCY = "1";
    process.env.GITHUB_SIGNAL_CONCURRENCY = "1";

    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ login: "org", name: "Org" }))
      .mockResolvedValueOnce(jsonResponse([
        {
          name: "repo-a",
          pushed_at: "2026-01-01T00:00:00.000Z",
          archived: false,
          protected: true,
          open_issues_count: 2,
          default_branch: "main"
        }
      ], 200, {
        link: '<https://api.github.com/orgs/org/repos?type=all&page=2&per_page=100>; rel="next"'
      }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ workflow_runs: [] }))
      .mockResolvedValueOnce(jsonResponse({ required_pull_request_reviews: { required_approving_review_count: 1 } }));

    const adapter = new LiveGitHubOrganizationAdapter();
    const result = await adapter.fetchOrganizationData({ organization: "org", source: "live" });

    expect(result.fetchStatus).toBe("partial");
    expect(result.issues.some((issue) => issue.code === "DATA_TRUNCATED" && issue.message.includes("Organization repositories"))).toBe(true);
  });

  it("limits concurrent signal requests when concurrency is configured", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_REPOSITORY_CONCURRENCY = "1";
    process.env.GITHUB_SIGNAL_CONCURRENCY = "1";

    let activeSignals = 0;
    let maxActiveSignals = 0;
    let released = false;
    let releaseGate: (() => void) | undefined;
    let signalStartedResolve: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      releaseGate = () => {
        released = true;
        resolve();
      };
    });
    const signalStarted = new Promise<void>((resolve) => {
      signalStartedResolve = resolve;
    });

    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes("/orgs/org") && !url.includes("/repos?")) {
        return jsonResponse({ login: "org", name: "Org" });
      }

      if (url.includes("/orgs/org/repos")) {
        return jsonResponse([
          {
            name: "repo-a",
            pushed_at: "2026-01-01T00:00:00.000Z",
            archived: false,
            protected: true,
            open_issues_count: 2,
            default_branch: "main"
          },
          {
            name: "repo-b",
            pushed_at: "2026-01-02T00:00:00.000Z",
            archived: false,
            protected: true,
            open_issues_count: 1,
            default_branch: "main"
          }
        ]);
      }

      activeSignals += 1;
      maxActiveSignals = Math.max(maxActiveSignals, activeSignals);
  signalStartedResolve?.();
  signalStartedResolve = undefined;
      await gate;
      activeSignals -= 1;

      if (url.includes("/actions/runs")) {
        return jsonResponse({ workflow_runs: [] });
      }

      if (url.includes("/branches/")) {
        return jsonResponse({ required_pull_request_reviews: { required_approving_review_count: 1 } });
      }

      return jsonResponse([]);
    });

    vi.stubGlobal("fetch", fetchMock);

    const adapter = new LiveGitHubOrganizationAdapter();
    const resultPromise = adapter.fetchOrganizationData({ organization: "org", source: "live" });

    await signalStarted;
    expect(maxActiveSignals).toBe(1);

    releaseGate?.();
    const result = await resultPromise;
    expect(released).toBe(true);
    expect(result.repositories).toHaveLength(2);
  });

  it("limits concurrent repository enrichments when repository concurrency is configured", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_REPOSITORY_CONCURRENCY = "1";
    process.env.GITHUB_SIGNAL_CONCURRENCY = "4";

    const activeRepositorySignals = new Map<string, number>();
    let maxActiveRepositories = 0;
    let releaseGate: (() => void) | undefined;
    let repositoryStartedResolve: (() => void) | undefined;

    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });

    const repositoryStarted = new Promise<void>((resolve) => {
      repositoryStartedResolve = resolve;
    });

    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes("/orgs/org") && !url.includes("/repos?")) {
        return jsonResponse({ login: "org", name: "Org" });
      }

      if (url.includes("/orgs/org/repos")) {
        return jsonResponse([
          {
            name: "repo-a",
            pushed_at: "2026-01-01T00:00:00.000Z",
            archived: false,
            protected: true,
            open_issues_count: 2,
            default_branch: "main"
          },
          {
            name: "repo-b",
            pushed_at: "2026-01-02T00:00:00.000Z",
            archived: false,
            protected: true,
            open_issues_count: 1,
            default_branch: "main"
          }
        ]);
      }

      const match = url.match(/\/repos\/org\/([^/]+)\//);
      const repositoryId = match?.[1];
      if (!repositoryId) {
        throw new Error(`Unexpected URL: ${url}`);
      }

      activeRepositorySignals.set(repositoryId, (activeRepositorySignals.get(repositoryId) ?? 0) + 1);
      maxActiveRepositories = Math.max(maxActiveRepositories, activeRepositorySignals.size);
      repositoryStartedResolve?.();
      repositoryStartedResolve = undefined;

      await gate;

      const nextCount = (activeRepositorySignals.get(repositoryId) ?? 1) - 1;
      if (nextCount <= 0) {
        activeRepositorySignals.delete(repositoryId);
      } else {
        activeRepositorySignals.set(repositoryId, nextCount);
      }

      if (url.includes("/actions/runs")) {
        return jsonResponse({ workflow_runs: [] });
      }

      if (url.includes("/branches/")) {
        return jsonResponse({ required_pull_request_reviews: { required_approving_review_count: 1 } });
      }

      return jsonResponse([]);
    });

    vi.stubGlobal("fetch", fetchMock);

    const adapter = new LiveGitHubOrganizationAdapter();
    const resultPromise = adapter.fetchOrganizationData({ organization: "org", source: "live" });

    await repositoryStarted;
    expect(maxActiveRepositories).toBe(1);

    releaseGate?.();

    const result = await resultPromise;
    expect(result.repositories).toHaveLength(2);
    expect(maxActiveRepositories).toBe(1);
  });

  it("returns failed when required organization collection fails with upstream error", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_MAX_RETRIES = "0";

    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Server error" }, 500));

    const adapter = new LiveGitHubOrganizationAdapter();
    const result = await adapter.fetchOrganizationData({ organization: "org", source: "live" });

    expect(result.fetchStatus).toBe("failed");
    expect(result.repositories).toHaveLength(0);
    expect(result.issues).toEqual([
      {
        code: "UPSTREAM_UNAVAILABLE",
        message: "Required organization collection failed: GitHub upstream is unavailable."
      }
    ]);
  });

  it("returns failed when required repository collection fails with upstream error", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_MAX_RETRIES = "0";

    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ login: "org", name: "Org" }))
      .mockResolvedValueOnce(jsonResponse({ message: "Server error" }, 500));

    const adapter = new LiveGitHubOrganizationAdapter();
    const result = await adapter.fetchOrganizationData({ organization: "org", source: "live" });

    expect(result.fetchStatus).toBe("failed");
    expect(result.repositories).toHaveLength(0);
    expect(result.issues).toEqual([
      {
        code: "UPSTREAM_UNAVAILABLE",
        message: "Required repositories collection failed: GitHub upstream is unavailable."
      }
    ]);
  });

  it("classifies secondary throttling 403 as RATE_LIMITED", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_MAX_RETRIES = "0";

    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { message: "You have exceeded a secondary rate limit." },
        403,
        { "x-ratelimit-remaining": "0" }
      )
    );

    const adapter = new LiveGitHubOrganizationAdapter();
    await expect(adapter.fetchOrganizationData({ organization: "org", source: "live" })).rejects.toMatchObject({
      code: "RATE_LIMITED"
    });
  });

  it("URL-encodes organization slug in upstream paths", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_MAX_RETRIES = "0";

    const seenUrls: string[] = [];
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      seenUrls.push(url);

      return jsonResponse({ message: "Not found" }, 404);
    });

    vi.stubGlobal("fetch", fetchMock);

    const adapter = new LiveGitHubOrganizationAdapter();
    await expect(adapter.fetchOrganizationData({ organization: "org/with/slash", source: "live" })).rejects.toMatchObject({
      code: "NOT_FOUND"
    });

    expect(seenUrls[0]).toContain("/orgs/org%2Fwith%2Fslash");
  });

  it("collects deeper optional signals when GitHub provides them", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_REPOSITORY_CONCURRENCY = "1";
    process.env.GITHUB_SIGNAL_CONCURRENCY = "1";

    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ login: "org", name: "Org" }))
      .mockResolvedValueOnce(jsonResponse([
        {
          name: "repo-a",
          pushed_at: "2026-01-01T00:00:00.000Z",
          archived: false,
          protected: true,
          open_issues_count: 2,
          default_branch: "main"
        }
      ]))
      .mockResolvedValueOnce(jsonResponse([{ number: 1, created_at: "2025-12-01T00:00:00.000Z" }]))
      .mockResolvedValueOnce(jsonResponse([{ number: 2, created_at: "2025-12-02T00:00:00.000Z" }]))
      .mockResolvedValueOnce(jsonResponse([
        { name: "build", conclusion: "failure", created_at: "2026-01-02T00:00:00.000Z" },
        { name: "test", conclusion: "success", created_at: "2026-01-03T00:00:00.000Z" }
      ]))
      .mockResolvedValueOnce(jsonResponse({ required_pull_request_reviews: { required_approving_review_count: 1 } }))
      .mockResolvedValueOnce(jsonResponse([
        { created_at: "2025-12-20T00:00:00.000Z" },
        { created_at: "2025-12-25T00:00:00.000Z" }
      ]))
      .mockResolvedValueOnce(jsonResponse([
        { created_at: "2025-12-18T00:00:00.000Z", draft: false },
        { created_at: "2025-12-24T00:00:00.000Z", draft: false }
      ]))
      .mockResolvedValueOnce(jsonResponse([
        { created_at: "2025-12-10T00:00:00.000Z" },
        { created_at: "2025-12-14T00:00:00.000Z", pull_request: { url: "x" } }
      ]));

    const adapter = new LiveGitHubOrganizationAdapter();
    const result = await adapter.fetchOrganizationData({ organization: "org", source: "live" });

    const metrics = result.repositories[0]?.metrics;
    expect(metrics?.code_scanning_alerts_open).toBe(2);
    expect(metrics?.pull_request_review_queue_age_days).toBeGreaterThan(0);
    expect(metrics?.workflow_failure_rate).toBe(50);
    expect(metrics?.dependabot_alert_age_days).toBeGreaterThan(0);
    expect(metrics?.stale_issue_age_days).toBeGreaterThan(0);
  });
});
