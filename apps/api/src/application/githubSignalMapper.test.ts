import { describe, expect, it } from "vitest";
import { mapGitHubSignalsToNormalizedOrganization } from "./githubSignalMapper.js";

describe("mapGitHubSignalsToNormalizedOrganization", () => {
  it("maps all signal families to scoring metrics", () => {
    const result = mapGitHubSignalsToNormalizedOrganization({
      organization: {
        login: "org-a",
        name: "Org A"
      },
      repositories: [
        {
          repository: {
            name: "repo-a",
            pushedAt: "2026-01-01T00:00:00.000Z",
            importance: "important"
          },
          security: {
            openAlerts: 3,
            vulnerabilitiesResolved: 17,
            vulnerabilitiesTotal: 20,
            codeScanningAlertsOpen: 2
          },
          governance: {
            branchProtectionCoverage: 95,
            reviewComplianceRate: 92,
            pullRequestReviewQueueAgeDays: 3
          },
          cicd: {
            ciSuccessRate: 94,
            deploymentFrequencyWeekly: 8,
            workflowFailureRate: 6
          },
          quality: {
            testCoverage: 88,
            dependencyFreshness: 80,
            issueHygiene: 79,
            dependabotAlertAgeDays: 5
          },
          repositoryHealth: {
            staleIssueAgeDays: 9
          },
          signalCoverage: 98,
          activityRecencyDays: 2
        }
      ]
    });

    expect(result.repositories).toHaveLength(1);
    const metrics = result.repositories[0]?.metrics;
    expect(metrics?.repo_signal_coverage).toBe(98);
    expect(metrics?.repo_activity_recency_days).toBe(2);
    expect(metrics?.security_alerts_open).toBe(3);
    expect(metrics?.code_scanning_alerts_open).toBe(2);
    expect(metrics?.vuln_resolution_rate).toBe(85);
    expect(metrics?.branch_protection_coverage).toBe(95);
    expect(metrics?.review_compliance_rate).toBe(92);
    expect(metrics?.pull_request_review_queue_age_days).toBe(3);
    expect(metrics?.ci_success_rate).toBe(94);
    expect(metrics?.deployment_frequency_weekly).toBe(8);
    expect(metrics?.workflow_failure_rate).toBe(6);
    expect(metrics?.test_coverage).toBe(88);
    expect(metrics?.dependency_freshness).toBe(80);
    expect(metrics?.issue_hygiene).toBe(79);
    expect(metrics?.dependabot_alert_age_days).toBe(5);
    expect(metrics?.stale_issue_age_days).toBe(9);
    expect(result.fetchStatus).toBe("complete");
  });

  it("marks partial when required activity signal is missing", () => {
    const result = mapGitHubSignalsToNormalizedOrganization({
      organization: {
        login: "org-b"
      },
      repositories: [
        {
          repository: {
            name: "repo-b"
          }
        }
      ]
    });

    expect(result.fetchStatus).toBe("partial");
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.repositories[0]?.metrics.repo_activity_recency_days).toBeUndefined();
    expect(result.repositories[0]?.metrics.repo_signal_coverage).toBeGreaterThanOrEqual(0);
    expect(result.repositories[0]?.metrics.repo_signal_coverage).toBeLessThanOrEqual(100);
  });

  it("keeps vulnerabilities metric undefined when resolved count is unavailable", () => {
    const result = mapGitHubSignalsToNormalizedOrganization({
      organization: {
        login: "org-c"
      },
      repositories: [
        {
          repository: {
            name: "repo-c",
            pushedAt: "2026-01-01T00:00:00.000Z"
          },
          security: {
            openAlerts: 4,
            vulnerabilitiesTotal: 20
          }
        }
      ]
    });

    const repository = result.repositories[0];
    expect(repository?.metrics.vuln_resolution_rate).toBeUndefined();
    expect(result.issues.some((issue) => issue.message.includes("Vulnerability resolved count is unavailable"))).toBe(true);
  });

  it("keeps missing security/governance/cicd/quality metrics undefined", () => {
    const result = mapGitHubSignalsToNormalizedOrganization({
      organization: {
        login: "org-d"
      },
      repositories: [
        {
          repository: {
            name: "repo-d",
            pushedAt: "2026-01-01T00:00:00.000Z",
            importance: "medium"
          }
        }
      ]
    });

    const metrics = result.repositories[0]?.metrics;
    expect(metrics?.security_alerts_open).toBeUndefined();
    expect(metrics?.code_scanning_alerts_open).toBeUndefined();
    expect(metrics?.branch_protection_coverage).toBeUndefined();
    expect(metrics?.review_compliance_rate).toBeUndefined();
    expect(metrics?.pull_request_review_queue_age_days).toBeUndefined();
    expect(metrics?.ci_success_rate).toBeUndefined();
    expect(metrics?.deployment_frequency_weekly).toBeUndefined();
    expect(metrics?.workflow_failure_rate).toBeUndefined();
    expect(metrics?.test_coverage).toBeUndefined();
    expect(metrics?.dependency_freshness).toBeUndefined();
    expect(metrics?.issue_hygiene).toBeUndefined();
    expect(metrics?.dependabot_alert_age_days).toBeUndefined();
    expect(metrics?.stale_issue_age_days).toBeUndefined();
  });

  it("marks partial when adapter issues are present even if repository mapping succeeded", () => {
    const result = mapGitHubSignalsToNormalizedOrganization({
      organization: {
        login: "org-e"
      },
      repositories: [
        {
          repository: {
            name: "repo-e",
            pushedAt: "2026-01-01T00:00:00.000Z",
            importance: "important"
          }
        }
      ]
    }, {
      adapterIssues: [
        {
          code: "UPSTREAM_UNAVAILABLE",
          message: "Workflow runs are unavailable.",
          repositoryId: "repo-e"
        }
      ],
      fetchStatus: "partial"
    });

    expect(result.fetchStatus).toBe("partial");
    expect(result.issues.some((issue) => issue.message === "Workflow runs are unavailable.")).toBe(true);
  });

  it("returns complete for a successfully fetched organization with zero repositories", () => {
    const result = mapGitHubSignalsToNormalizedOrganization({
      organization: {
        login: "org-empty",
        name: "Org Empty"
      },
      repositories: []
    });

    expect(result.fetchStatus).toBe("complete");
    expect(result.repositories).toHaveLength(0);
    expect(result.issues).toHaveLength(0);
  });

  it("returns failed when required collection failure is provided by the adapter", () => {
    const result = mapGitHubSignalsToNormalizedOrganization({
      organization: {
        login: "org-failed",
        name: "Org Failed"
      },
      repositories: []
    }, {
      adapterIssues: [
        {
          code: "UPSTREAM_UNAVAILABLE",
          message: "Required organization collection failed: GitHub upstream is unavailable."
        }
      ],
      fetchStatus: "failed"
    });

    expect(result.fetchStatus).toBe("failed");
    expect(result.issues).toHaveLength(1);
  });
});
