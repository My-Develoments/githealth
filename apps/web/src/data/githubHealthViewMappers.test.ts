import { describe, expect, it } from "vitest";
import { mapGitHubHealthToViewModels } from "./githubHealthViewMappers";
import type { GitHubHealthRawData } from "./githubHealthDataAdapter";

describe("mapGitHubHealthToViewModels", () => {
  it("maps organization and repository scores into command center and universe models", () => {
    const raw: GitHubHealthRawData = {
      source: "mock",
      fetchStatus: "complete",
      adapterIssues: [],
      organization: {
        organizationId: "org-id",
        organizationName: "GitHealth Labs",
        overallScore: 89,
        categories: [
          { category: "security", score: 92, completeness: 1, metricsConsidered: 6, metricsMissing: 0 },
          { category: "governance", score: 87, completeness: 1, metricsConsidered: 6, metricsMissing: 0 },
          { category: "cicd", score: 84, completeness: 1, metricsConsidered: 6, metricsMissing: 0 },
          { category: "quality-maintenance", score: 88, completeness: 1, metricsConsidered: 6, metricsMissing: 0 }
        ],
        completeness: 1,
        repositoryCount: 2,
        positiveContributors: [],
        negativeContributors: [],
        recommendations: [
          {
            actionKey: "enable-codeql",
            category: "security",
            title: "Enable CodeQL",
            description: "Enable advanced code scanning.",
            priority: "high"
          }
        ],
        validationIssues: [],
        scoringVersion: "1.0.0",
        calculatedAt: new Date().toISOString()
      },
      repositories: [
        {
          repositoryId: "api-gateway",
          repositoryName: "api-gateway",
          importance: "high",
          overallScore: 82,
          categories: [
            { category: "security", score: 82, completeness: 1, metricsConsidered: 6, metricsMissing: 0 },
            { category: "governance", score: 81, completeness: 1, metricsConsidered: 6, metricsMissing: 0 },
            { category: "cicd", score: 85, completeness: 1, metricsConsidered: 6, metricsMissing: 0 },
            { category: "quality-maintenance", score: 80, completeness: 1, metricsConsidered: 6, metricsMissing: 0 }
          ],
          completeness: 1,
          positiveContributors: [],
          negativeContributors: [],
          recommendations: [
            {
              actionKey: "stabilize-ci",
              category: "cicd",
              title: "Stabilize CI",
              description: "Reduce flaky tests.",
              priority: "medium"
            }
          ],
          validationIssues: []
        }
      ]
    };

    const mapped = mapGitHubHealthToViewModels(raw);

    expect(mapped.commandCenter.score).toBe(89);
    expect(mapped.commandCenter.organization).toBe("GitHealth Labs");
    expect(mapped.commandCenter.categorySignals).toHaveLength(4);

    const qualitySignal = mapped.commandCenter.categorySignals.find((signal) => signal.key === "quality");
    expect(qualitySignal?.score).toBe(88);

    const apiGateway = mapped.repositoryUniverse.repositories.find((repository) => repository.id === "api-gateway");
    expect(apiGateway?.status).toBe("needs-attention");
    expect(apiGateway?.importance).toBe("important");

    const metadataOnlyNode = mapped.repositoryUniverse.repositories.find((repository) => repository.id === "frontend-web");
    expect(metadataOnlyNode?.status).toBe("no-data");
    expect(metadataOnlyNode?.healthScore).toBe(0);
  });
});
