import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchGitHubHealthData } from "./githubHealthDataAdapter";
import type {
  ApiOrganizationScore,
  ApiRepositoryScore,
  GitHubOrganizationScoreResponse,
  GitHubRepositoryScoresResponse
} from "./githubHealthContracts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchGitHubHealthData", () => {
  it("preserves live source when API returns failed fetchStatus", async () => {
    mockFetchSequence([
      jsonResponse(buildOrganizationResponse("failed", "live", [{ code: "UPSTREAM_UNAVAILABLE", message: "GitHub upstream is unavailable." }])),
      jsonResponse(buildRepositoryResponse("complete", [buildRepository("api-gateway", 86)], "live", []))
    ]);

    const result = await fetchGitHubHealthData();

    expect(result.state).toBe("failed");
    if (result.state === "error") {
      throw new Error("Expected success result");
    }
    expect(result.data.source).toBe("live");
    expect(result.data.fetchStatus).toBe("failed");
    expect(result.data.adapterIssues).toEqual([
      {
        code: "UPSTREAM_UNAVAILABLE",
        message: "GitHub upstream is unavailable."
      }
    ]);
  });

  it("preserves explicit mock source from API responses", async () => {
    mockFetchSequence([
      jsonResponse(buildOrganizationResponse("complete", "mock")),
      jsonResponse(buildRepositoryResponse("complete", [buildRepository("api-gateway", 91)], "mock"))
    ]);

    const result = await fetchGitHubHealthData();

    expect(result.state).toBe("ready");
    if (result.state === "error") {
      throw new Error("Expected success result");
    }
    expect(result.data.source).toBe("mock");
  });

  it("returns ready state for complete responses with repositories", async () => {
    mockFetchSequence([
      jsonResponse(buildOrganizationResponse("complete")),
      jsonResponse(buildRepositoryResponse("complete", [buildRepository("api-gateway", 91)]))
    ]);

    const result = await fetchGitHubHealthData();

    expect(result.state).toBe("ready");
    if (result.state === "error") {
      throw new Error("Expected success result");
    }
    expect(result.data.fetchStatus).toBe("complete");
    expect(result.data.repositories).toHaveLength(1);
  });

  it("returns partial state when any endpoint is partial", async () => {
    mockFetchSequence([
      jsonResponse(buildOrganizationResponse("complete")),
      jsonResponse(buildRepositoryResponse("partial", [buildRepository("api-gateway", 86)]))
    ]);

    const result = await fetchGitHubHealthData();

    expect(result.state).toBe("partial");
    if (result.state === "error") {
      throw new Error("Expected success result");
    }
    expect(result.data.fetchStatus).toBe("partial");
  });

  it("returns failed state when any endpoint is failed", async () => {
    mockFetchSequence([
      jsonResponse(buildOrganizationResponse("failed")),
      jsonResponse(buildRepositoryResponse("complete", [buildRepository("api-gateway", 86)]))
    ]);

    const result = await fetchGitHubHealthData();

    expect(result.state).toBe("failed");
    if (result.state === "error") {
      throw new Error("Expected success result");
    }
    expect(result.data.fetchStatus).toBe("failed");
  });

  it("returns empty state when complete response has no repositories", async () => {
    mockFetchSequence([
      jsonResponse(buildOrganizationResponse("complete")),
      jsonResponse(buildRepositoryResponse("complete", []))
    ]);

    const result = await fetchGitHubHealthData();

    expect(result.state).toBe("empty");
    if (result.state === "error") {
      throw new Error("Expected success result");
    }
    expect(result.data.repositories).toHaveLength(0);
  });

  it("returns error state for non-2xx responses", async () => {
    mockFetchSequence([
      jsonResponse(buildOrganizationResponse("complete"), 403, {
        code: "PERMISSION_DENIED",
        message: "Forbidden"
      }),
      jsonResponse(buildRepositoryResponse("complete", [buildRepository("api-gateway", 90)]))
    ]);

    const result = await fetchGitHubHealthData();

    expect(result.state).toBe("error");
    if (result.state !== "error") {
      throw new Error("Expected error result");
    }
    expect(result.error.code).toBe("PERMISSION_DENIED");
    expect(result.error.status).toBe(403);
  });
});

function mockFetchSequence(responses: Response[]): void {
  const fetchMock = vi.fn();
  responses.forEach((response) => {
    fetchMock.mockResolvedValueOnce(response);
  });
  vi.stubGlobal("fetch", fetchMock);
}

function jsonResponse(payload: unknown, status = 200, errorPayload?: { code: string; message: string }): Response {
  if (status >= 400 && errorPayload) {
    return new Response(JSON.stringify(errorPayload), {
      status,
      headers: {
        "content-type": "application/json"
      }
    });
  }

  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

function buildOrganizationResponse(
  fetchStatus: GitHubOrganizationScoreResponse["fetchStatus"],
  source: GitHubOrganizationScoreResponse["source"] = "mock",
  adapterIssues: GitHubOrganizationScoreResponse["adapterIssues"] = []
): GitHubOrganizationScoreResponse {
  return {
    source,
    fetchStatus,
    adapterIssues,
    organization: {
      organizationId: "org-id",
      organizationName: "GitHealth Labs",
      overallScore: 87,
      categories: [
        { category: "security", score: 90, completeness: 1, metricsConsidered: 6, metricsMissing: 0 },
        { category: "governance", score: 88, completeness: 1, metricsConsidered: 6, metricsMissing: 0 },
        { category: "cicd", score: 84, completeness: 1, metricsConsidered: 6, metricsMissing: 0 },
        { category: "quality-maintenance", score: 86, completeness: 1, metricsConsidered: 6, metricsMissing: 0 }
      ],
      completeness: 1,
      repositoryCount: 1,
      positiveContributors: [],
      negativeContributors: [],
      recommendations: [],
      validationIssues: [],
      scoringVersion: "1.0.0",
      calculatedAt: new Date().toISOString()
    } satisfies ApiOrganizationScore
  };
}

function buildRepositoryResponse(
  fetchStatus: GitHubRepositoryScoresResponse["fetchStatus"],
  repositories: ApiRepositoryScore[],
  source: GitHubRepositoryScoresResponse["source"] = "mock",
  adapterIssues: GitHubRepositoryScoresResponse["adapterIssues"] = []
): GitHubRepositoryScoresResponse {
  return {
    source,
    fetchStatus,
    adapterIssues,
    repositories
  };
}

function buildRepository(id: string, score: number): ApiRepositoryScore {
  return {
    repositoryId: id,
    repositoryName: id,
    importance: "high",
    overallScore: score,
    categories: [
      { category: "security", score, completeness: 1, metricsConsidered: 6, metricsMissing: 0 },
      { category: "governance", score, completeness: 1, metricsConsidered: 6, metricsMissing: 0 },
      { category: "cicd", score, completeness: 1, metricsConsidered: 6, metricsMissing: 0 },
      { category: "quality-maintenance", score, completeness: 1, metricsConsidered: 6, metricsMissing: 0 }
    ],
    completeness: 1,
    positiveContributors: [],
    negativeContributors: [],
    recommendations: [],
    validationIssues: []
  };
}
