import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GitHubHealthAdapterResult } from "./githubHealthDataAdapter";
import { useGitHubHealthData } from "./useGitHubHealthData";

vi.mock("./githubHealthDataAdapter", () => ({
  fetchGitHubHealthData: vi.fn()
}));

import { fetchGitHubHealthData } from "./githubHealthDataAdapter";

const mockedFetchGitHubHealthData = vi.mocked(fetchGitHubHealthData);

beforeEach(() => {
  mockedFetchGitHubHealthData.mockReset();
});

describe("useGitHubHealthData", () => {
  it("transitions from loading to ready when adapter succeeds", async () => {
    mockedFetchGitHubHealthData.mockResolvedValueOnce(successResult("ready"));

    const { result } = renderHook(() => useGitHubHealthData());

    expect(result.current.state).toBe("loading");

    await waitFor(() => {
      expect(result.current.state).toBe("ready");
    });

    expect(result.current.viewModels.commandCenter.score).toBe(87);
  });

  it("supports retry after error", async () => {
    mockedFetchGitHubHealthData
      .mockResolvedValueOnce(errorResult("UPSTREAM_UNAVAILABLE", "Network down", 0))
      .mockResolvedValueOnce(successResult("partial"));

    const { result } = renderHook(() => useGitHubHealthData());

    await waitFor(() => {
      expect(result.current.state).toBe("error");
    });

    act(() => {
      result.current.reload();
    });

    await waitFor(() => {
      expect(result.current.state).toBe("partial");
    });
  });
});

function successResult(state: "ready" | "partial" | "failed" | "empty"): GitHubHealthAdapterResult {
  return {
    state,
    data: {
      source: "mock",
      fetchStatus: state === "partial" ? "partial" : state === "failed" ? "failed" : "complete",
      adapterIssues: [],
      organization: {
        organizationId: "org-id",
        organizationName: "GitHealth Labs",
        overallScore: 87,
        categories: [
          { category: "security", score: 90, completeness: 1, metricsConsidered: 6, metricsMissing: 0 },
          { category: "governance", score: 86, completeness: 1, metricsConsidered: 6, metricsMissing: 0 },
          { category: "cicd", score: 84, completeness: 1, metricsConsidered: 6, metricsMissing: 0 },
          { category: "quality-maintenance", score: 88, completeness: 1, metricsConsidered: 6, metricsMissing: 0 }
        ],
        completeness: 1,
        repositoryCount: state === "empty" ? 0 : 1,
        positiveContributors: [],
        negativeContributors: [],
        recommendations: [],
        validationIssues: [],
        scoringVersion: "1.0.0",
        calculatedAt: new Date().toISOString()
      },
      repositories:
        state === "empty"
          ? []
          : [
              {
                repositoryId: "api-gateway",
                repositoryName: "api-gateway",
                importance: "high",
                overallScore: 87,
                categories: [
                  { category: "security", score: 90, completeness: 1, metricsConsidered: 6, metricsMissing: 0 },
                  { category: "governance", score: 86, completeness: 1, metricsConsidered: 6, metricsMissing: 0 },
                  { category: "cicd", score: 84, completeness: 1, metricsConsidered: 6, metricsMissing: 0 },
                  { category: "quality-maintenance", score: 88, completeness: 1, metricsConsidered: 6, metricsMissing: 0 }
                ],
                completeness: 1,
                positiveContributors: [],
                negativeContributors: [],
                recommendations: [],
                validationIssues: []
              }
            ]
    }
  };
}

function errorResult(code: string, message: string, status: number): GitHubHealthAdapterResult {
  return {
    state: "error",
    error: {
      code,
      message,
      status
    }
  };
}
