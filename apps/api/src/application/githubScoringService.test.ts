import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveGitHubOrganizationAdapter } from "../infrastructure/github/live/liveGitHubOrganizationAdapter.js";
import {
  getGitHubOrganizationScore,
  getGitHubRepositoryScoreById,
  getGitHubRepositoryScores,
  getGitHubScoreCacheStatistics,
  resetGitHubScoreCache
} from "./githubScoringService.js";
import type { GitHubNormalizedOrganization } from "./githubNormalizedModels.js";

describe("githubScoringService", () => {
  const previousToken = process.env.GITHUB_TOKEN;
  const previousRetries = process.env.GITHUB_MAX_RETRIES;
  const previousCacheTtlMs = process.env.GITHUB_SCORE_CACHE_TTL_MS;

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    resetGitHubScoreCache();

    if (typeof previousToken === "undefined") {
      delete process.env.GITHUB_TOKEN;
    } else {
      process.env.GITHUB_TOKEN = previousToken;
    }

    if (typeof previousRetries === "undefined") {
      delete process.env.GITHUB_MAX_RETRIES;
    } else {
      process.env.GITHUB_MAX_RETRIES = previousRetries;
    }

    if (typeof previousCacheTtlMs === "undefined") {
      delete process.env.GITHUB_SCORE_CACHE_TTL_MS;
    } else {
      process.env.GITHUB_SCORE_CACHE_TTL_MS = previousCacheTtlMs;
    }
  });

  it("returns deterministic organization score from mock source", async () => {
    const result = await getGitHubOrganizationScore("githealth-labs", "mock");

    expect(result.source).toBe("mock");
    expect(result.fetchStatus).toBe("complete");
    expect(result.organization.organizationId).toBe("githealth-labs");
    expect(result.organization.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.organization.overallScore).toBeLessThanOrEqual(100);
  });

  it("defaults to live source when source is omitted", async () => {
    delete process.env.GITHUB_TOKEN;

    await expect(getGitHubOrganizationScore("githealth-labs")).rejects.toThrow(
      "GITHUB_TOKEN is required for live GitHub source."
    );
  });

  it("keeps explicit live source behavior when source is provided", async () => {
    delete process.env.GITHUB_TOKEN;

    await expect(getGitHubOrganizationScore("githealth-labs", "live")).rejects.toThrow(
      "GITHUB_TOKEN is required for live GitHub source."
    );
  });

  it("returns repository scores from mock source", async () => {
    const result = await getGitHubRepositoryScores("githealth-labs", "mock");

    expect(result.source).toBe("mock");
    expect(result.repositories.length).toBeGreaterThan(0);
    expect(result.repositories[0]).not.toHaveProperty("_internal");
  });

  it("returns single repository score by id", async () => {
    const found = await getGitHubRepositoryScoreById("githealth-labs", "frontend-web", "mock");
    const missing = await getGitHubRepositoryScoreById("githealth-labs", "does-not-exist", "mock");

    expect(found.repository?.repositoryId).toBe("frontend-web");
    expect(found.repository?.cicdTelemetry?.runSummary.totalRuns).toBe(4);
    expect(found.repository?.cicdTelemetry?.recentRuns[0]?.name).toBe("build-and-test");
    expect(missing.repository).toBeNull();
  });

  it("returns a stable failed score response when required live collection fails", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_MAX_RETRIES = "0";

    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: "Server error" }), {
      status: 500,
      headers: {
        "content-type": "application/json"
      }
    }));

    const result = await getGitHubOrganizationScore("org", "live");

    expect(result.source).toBe("live");
    expect(result.fetchStatus).toBe("failed");
    expect(result.organization.organizationId).toBe("org");
    expect(result.organization.overallScore).toBe(0);
    expect(result.adapterIssues).toEqual([
      {
        code: "UPSTREAM_UNAVAILABLE",
        message: "Required organization collection failed: GitHub upstream is unavailable."
      }
    ]);
  });

  it("records live cache hits, misses, size, and ttl metadata", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_SCORE_CACHE_TTL_MS = "15000";

    const fetchOrganizationData = vi.spyOn(LiveGitHubOrganizationAdapter.prototype, "fetchOrganizationData");
    fetchOrganizationData.mockImplementation(async (request) => buildLiveNormalizedOrganization(request.organization));

    const first = await getGitHubOrganizationScore("cache-org", "live");
    const second = await getGitHubOrganizationScore("cache-org", "live");

    expect(fetchOrganizationData).toHaveBeenCalledTimes(1);
    expect(first.organization.organizationId).toBe("cache-org");
    expect(second.organization.organizationId).toBe("cache-org");

    expect(getGitHubScoreCacheStatistics()).toEqual({
      strategy: "in-memory",
      ttlMs: 15000,
      hits: 1,
      misses: 1,
      size: 1
    });
  });

  it("expires live organization score cache entries after the configured ttl", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_SCORE_CACHE_TTL_MS = "30000";

    const fetchOrganizationData = vi.spyOn(LiveGitHubOrganizationAdapter.prototype, "fetchOrganizationData");
    fetchOrganizationData.mockResolvedValue(buildLiveNormalizedOrganization("cache-org"));

    const first = await getGitHubOrganizationScore("cache-org", "live");
    const second = await getGitHubOrganizationScore("cache-org", "live");

    expect(fetchOrganizationData).toHaveBeenCalledTimes(1);
    expect(first.organization.organizationId).toBe("cache-org");
    expect(second.organization.organizationId).toBe("cache-org");

    vi.setSystemTime(new Date("2026-01-01T00:00:31.000Z"));

    await getGitHubOrganizationScore("cache-org", "live");
    expect(fetchOrganizationData).toHaveBeenCalledTimes(2);

    expect(getGitHubScoreCacheStatistics()).toMatchObject({
      hits: 1,
      misses: 2,
      size: 1
    });
  });

  it("isolates live cache entries across organization keys", async () => {
    process.env.GITHUB_TOKEN = "test-token";

    const fetchOrganizationData = vi.spyOn(LiveGitHubOrganizationAdapter.prototype, "fetchOrganizationData");
    fetchOrganizationData.mockImplementation(async (request) => buildLiveNormalizedOrganization(request.organization));

    const first = await getGitHubOrganizationScore("cache-org-a", "live");
    const second = await getGitHubOrganizationScore("cache-org-b", "live");
    const third = await getGitHubOrganizationScore("cache-org-a", "live");

    expect(fetchOrganizationData).toHaveBeenCalledTimes(2);
    expect(first.organization.organizationId).toBe("cache-org-a");
    expect(second.organization.organizationId).toBe("cache-org-b");
    expect(third.organization.organizationId).toBe("cache-org-a");

    expect(getGitHubScoreCacheStatistics()).toMatchObject({
      hits: 1,
      misses: 2,
      size: 2
    });
  });

  it("does not cache non-complete live score responses", async () => {
    process.env.GITHUB_TOKEN = "test-token";

    const fetchOrganizationData = vi.spyOn(LiveGitHubOrganizationAdapter.prototype, "fetchOrganizationData");
    fetchOrganizationData.mockResolvedValue(buildLiveNormalizedOrganization("partial-org", "partial"));

    const first = await getGitHubOrganizationScore("partial-org", "live");
    const second = await getGitHubOrganizationScore("partial-org", "live");

    expect(fetchOrganizationData).toHaveBeenCalledTimes(2);
    expect(first.fetchStatus).toBe("partial");
    expect(second.fetchStatus).toBe("partial");
    expect(getGitHubScoreCacheStatistics()).toEqual({
      strategy: "in-memory",
      ttlMs: 30000,
      hits: 0,
      misses: 2,
      size: 0
    });
  });
});

function buildLiveNormalizedOrganization(
  organizationId: string,
  fetchStatus: "complete" | "partial" | "failed" = "complete"
): GitHubNormalizedOrganization {
  return {
    organizationId,
    organizationName: "Org",
    repositories: [],
    issues: [],
    fetchStatus,
    calculatedAt: "2026-01-01T00:00:00.000Z"
  };
}
