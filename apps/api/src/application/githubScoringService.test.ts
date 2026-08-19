import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getGitHubOrganizationScore,
  getGitHubRepositoryScoreById,
  getGitHubRepositoryScores
} from "./githubScoringService.js";

describe("githubScoringService", () => {
  const previousToken = process.env.GITHUB_TOKEN;
  const previousRetries = process.env.GITHUB_MAX_RETRIES;

  afterEach(() => {
    vi.restoreAllMocks();

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
});
