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
          validationIssues: [],
          cicdTelemetry: {
            ciSuccessRate: 85,
            deploymentFrequencyWeekly: 4.2,
            workflowFailureRate: 15,
            runSummary: {
              totalRuns: 3,
              completedRuns: 3,
              successCount: 2,
              failureCount: 1,
              successRate: 66.67,
              failureRate: 33.33,
              latestRunAt: "2026-02-05T10:45:00.000Z"
            },
            recentRuns: [
              {
                id: 1,
                name: "build",
                status: "completed",
                conclusion: "success",
                event: "push",
                branch: "main",
                runNumber: 22,
                createdAt: "2026-02-05T10:45:00.000Z"
              }
            ]
          }
        }
      ]
    };

    const mapped = mapGitHubHealthToViewModels(raw);

    expect(mapped.commandCenter.source).toBe("mock");
    expect(mapped.repositoryUniverse.source).toBe("mock");
    expect(mapped.commandCenter.score).toBe(89);
    expect(mapped.commandCenter.organization).toBe("GitHealth Labs");
    expect(mapped.commandCenter.categorySignals).toHaveLength(4);

    const qualitySignal = mapped.commandCenter.categorySignals.find((signal) => signal.key === "quality");
    expect(qualitySignal?.score).toBe(88);

    const apiGateway = mapped.repositoryUniverse.repositories.find((repository) => repository.id === "api-gateway");
    expect(apiGateway?.status).toBe("needs-attention");
    expect(apiGateway?.importance).toBe("important");
    expect(apiGateway?.cicdTelemetry?.runSummary.totalRuns).toBe(3);
    expect(apiGateway?.cicdTelemetry?.recentRuns[0]?.name).toBe("build");

    const metadataOnlyNode = mapped.repositoryUniverse.repositories.find((repository) => repository.id === "frontend-web");
    expect(metadataOnlyNode?.status).toBe("no-data");
    expect(metadataOnlyNode?.healthScore).toBe(0);
  });

  it("keeps low/zero scored repositories separate from missing-data repositories", () => {
    const mapped = mapGitHubHealthToViewModels({
      ...buildBaseRawData(),
      repositories: [
        buildRepository({
          repositoryId: "repo-zero",
          repositoryName: "repo-zero",
          overallScore: 0,
          completeness: 1,
          categories: [
            buildCategory("security", 0, 1, 2, 0),
            buildCategory("governance", 0, 1, 2, 0),
            buildCategory("cicd", 0, 1, 2, 0),
            buildCategory("quality-maintenance", 0, 1, 2, 0)
          ]
        }),
        buildRepository({
          repositoryId: "repo-missing",
          repositoryName: "repo-missing",
          overallScore: 0,
          completeness: 0,
          categories: [
            buildCategory("security", 0, 0, 0, 0),
            buildCategory("governance", 0, 0, 0, 0),
            buildCategory("cicd", 0, 0, 0, 0),
            buildCategory("quality-maintenance", 0, 0, 0, 0)
          ]
        })
      ]
    });

    const zeroScoreRepository = mapped.repositoryUniverse.repositories.find((repository) => repository.id === "repo-zero");
    const missingRepository = mapped.repositoryUniverse.repositories.find((repository) => repository.id === "repo-missing");

    expect(zeroScoreRepository?.status).toBe("critical");
    expect(missingRepository?.status).toBe("no-data");
    expect(missingRepository?.recommendations[0]).toContain("Data unavailable");
  });

  it("maps deterministic problem insights and fallback recommendations", () => {
    const mapped = mapGitHubHealthToViewModels({
      ...buildBaseRawData(),
      adapterIssues: [
        {
          code: "DATA_TRUNCATED",
          message: "Repository scan returned partial records.",
          repositoryId: "repo-insights"
        }
      ],
      repositories: [
        buildRepository({
          repositoryId: "repo-insights",
          repositoryName: "repo-insights",
          overallScore: 52,
          completeness: 1,
          categories: [
            buildCategory("security", 52, 1, 4, 0),
            buildCategory("governance", 82, 1, 4, 0),
            buildCategory("cicd", 78, 1, 4, 0),
            buildCategory("quality-maintenance", 80, 1, 4, 0)
          ],
          negativeContributors: [
            {
              metricKey: "security_alerts_open",
              metricLabel: "Open Security Alerts",
              category: "security",
              rationale: "Open alerts are above expected target."
            }
          ],
          validationIssues: [
            {
              scope: "repository",
              message: "Branch protection data is stale.",
              metricKey: "branch_protection_coverage",
              repositoryId: "repo-insights"
            }
          ],
          recommendations: []
        })
      ]
    });

    const repository = mapped.repositoryUniverse.repositories.find((value) => value.id === "repo-insights");
    expect(repository?.topProblems).toEqual([
      "Branch protection data is stale.",
      "Security score 52 is below target.",
      "CI / CD score 78 is below target."
    ]);
    expect(repository?.recommendations).toEqual([
      "Improve security controls to raise score above watch threshold.",
      "Improve ci / cd controls to raise score above watch threshold.",
      "Improve quality controls to raise score above watch threshold."
    ]);
  });

  it("uses API recommendations first and keeps deterministic ordering", () => {
    const mapped = mapGitHubHealthToViewModels({
      ...buildBaseRawData(),
      repositories: [
        buildRepository({
          repositoryId: "repo-recommendations",
          repositoryName: "repo-recommendations",
          overallScore: 70,
          completeness: 1,
          recommendations: [
            {
              actionKey: "quality-improvement",
              category: "quality-maintenance",
              title: "Raise Test Coverage",
              description: "Increase automated test depth.",
              priority: "medium"
            },
            {
              actionKey: "branch-protection-enforcement",
              category: "governance",
              title: "Strengthen Branch Protection",
              description: "Require checks and approvals.",
              priority: "high"
            },
            {
              actionKey: "security-alert-burn-down",
              category: "security",
              title: "Reduce Open Security Alerts",
              description: "Patch critical dependencies first.",
              priority: "high"
            }
          ]
        })
      ]
    });

    const repository = mapped.repositoryUniverse.repositories.find((value) => value.id === "repo-recommendations");
    expect(repository?.recommendations).toEqual([
      "Strengthen Branch Protection: Require checks and approvals.",
      "Reduce Open Security Alerts: Patch critical dependencies first.",
      "Raise Test Coverage: Increase automated test depth."
    ]);
  });

  it("does not inject static repository metadata or topology in live mode", () => {
    const mapped = mapGitHubHealthToViewModels({
      ...buildBaseRawData(),
      source: "live",
      repositories: [
        buildRepository({
          repositoryId: "live-repo",
          repositoryName: "live-repo"
        })
      ]
    });

    expect(mapped.repositoryUniverse.repositories).toHaveLength(1);

    const repository = mapped.repositoryUniverse.repositories[0];
    expect(repository.id).toBe("live-repo");
    expect(repository.operationalDataAvailable).toBe(false);
    expect(repository.trendDataAvailable).toBe(false);
    expect(repository.lastActivity).toBe("Unavailable");
    expect(repository.trend).toEqual([]);

    expect(mapped.repositoryUniverse.connections).toEqual([]);
    expect(mapped.repositoryUniverse.activity).toEqual([]);
  });

  it("keeps explicit mock mode demo support", () => {
    const mapped = mapGitHubHealthToViewModels({
      ...buildBaseRawData(),
      source: "mock",
      repositories: [
        buildRepository({
          repositoryId: "api-gateway",
          repositoryName: "api-gateway"
        })
      ]
    });

    const repository = mapped.repositoryUniverse.repositories.find((value) => value.id === "api-gateway");
    expect(repository?.operationalDataAvailable).toBe(true);
    expect(repository?.trendDataAvailable).toBe(true);
    expect(mapped.repositoryUniverse.connections.length).toBeGreaterThan(0);
    expect(mapped.repositoryUniverse.activity.length).toBeGreaterThan(0);
  });
});

function buildCategory(
  category: "security" | "governance" | "cicd" | "quality-maintenance",
  score: number,
  completeness: number,
  metricsConsidered: number,
  metricsMissing: number
) {
  return {
    category,
    score,
    completeness,
    metricsConsidered,
    metricsMissing
  };
}

function buildRepository(overrides: Partial<GitHubHealthRawData["repositories"][number]>): GitHubHealthRawData["repositories"][number] {
  return {
    repositoryId: "repo",
    repositoryName: "repo",
    importance: "high",
    overallScore: 82,
    categories: [
      buildCategory("security", 82, 1, 6, 0),
      buildCategory("governance", 81, 1, 6, 0),
      buildCategory("cicd", 85, 1, 6, 0),
      buildCategory("quality-maintenance", 80, 1, 6, 0)
    ],
    completeness: 1,
    positiveContributors: [],
    negativeContributors: [],
    recommendations: [],
    validationIssues: [],
    ...overrides
  };
}

function buildBaseRawData(): GitHubHealthRawData {
  return {
    source: "mock",
    fetchStatus: "complete",
    adapterIssues: [],
    organization: {
      organizationId: "org-id",
      organizationName: "GitHealth Labs",
      overallScore: 89,
      categories: [
        buildCategory("security", 92, 1, 6, 0),
        buildCategory("governance", 87, 1, 6, 0),
        buildCategory("cicd", 84, 1, 6, 0),
        buildCategory("quality-maintenance", 88, 1, 6, 0)
      ],
      completeness: 1,
      repositoryCount: 1,
      positiveContributors: [],
      negativeContributors: [],
      recommendations: [],
      validationIssues: [],
      scoringVersion: "1.0.0",
      calculatedAt: new Date().toISOString()
    },
    repositories: []
  };
}
