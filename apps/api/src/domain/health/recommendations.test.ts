import { describe, expect, it } from "vitest";
import { buildOrganizationRecommendations } from "./recommendations.js";
import type { RepositoryHealthScore } from "./types.js";

function repositoryScoreWithRecommendations(
  repositoryId: string,
  recommendations: RepositoryHealthScore["recommendations"]
): RepositoryHealthScore {
  return {
    repositoryId,
    repositoryName: repositoryId,
    importance: "medium",
    overallScore: 0,
    categories: [],
    completeness: 0,
    positiveContributors: [],
    negativeContributors: [],
    recommendations,
    validationIssues: []
  };
}

describe("buildOrganizationRecommendations", () => {
  it("retains highest-priority recommendation per actionKey", () => {
    const repositoryScores: RepositoryHealthScore[] = [
      repositoryScoreWithRecommendations("repo-a", [
        {
          id: "repo-a:pipeline-reliability",
          actionKey: "pipeline-reliability",
          category: "cicd",
          priority: "low",
          title: "A",
          description: "A"
        }
      ]),
      repositoryScoreWithRecommendations("repo-b", [
        {
          id: "repo-b:pipeline-reliability",
          actionKey: "pipeline-reliability",
          category: "cicd",
          priority: "high",
          title: "B",
          description: "B"
        }
      ])
    ];

    const output = buildOrganizationRecommendations(repositoryScores);
    expect(output).toHaveLength(1);
    expect(output[0]?.priority).toBe("high");
    expect(output[0]?.id).toBe("repo-b:pipeline-reliability");
  });

  it("sorts deterministically by priority then stable actionKey tiebreaker", () => {
    const repositoryScores: RepositoryHealthScore[] = [
      repositoryScoreWithRecommendations("repo-a", [
        {
          id: "repo-a:signal-completeness",
          actionKey: "signal-completeness",
          category: "repository-health",
          priority: "low",
          title: "Signal",
          description: "Signal"
        },
        {
          id: "repo-a:quality-coverage-improvement",
          actionKey: "quality-coverage-improvement",
          category: "quality-maintenance",
          priority: "medium",
          title: "Quality",
          description: "Quality"
        },
        {
          id: "repo-a:branch-protection-enforcement",
          actionKey: "branch-protection-enforcement",
          category: "governance",
          priority: "high",
          title: "Branch",
          description: "Branch"
        }
      ])
    ];

    const output = buildOrganizationRecommendations(repositoryScores);
    expect(output.map((value) => `${value.priority}:${value.actionKey}`)).toEqual([
      "high:branch-protection-enforcement",
      "medium:quality-coverage-improvement",
      "low:signal-completeness"
    ]);
  });
});
