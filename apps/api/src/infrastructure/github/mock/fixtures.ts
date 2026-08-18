import type { GitHubOrganizationSignalInput } from "../types.js";

type MockFixture = Record<string, GitHubOrganizationSignalInput>;

const FIXTURES: MockFixture = {
  "githealth-labs": {
    organization: {
      login: "githealth-labs",
      name: "GitHealth Labs"
    },
    calculatedAt: "2026-01-01T00:00:00.000Z",
    repositories: [
      {
        repository: {
          name: "frontend-web",
          pushedAt: "2025-12-31T00:00:00.000Z",
          importance: "important"
        },
        security: {
          openAlerts: 1,
          vulnerabilitiesResolved: 19,
          vulnerabilitiesTotal: 20,
          codeScanningAlertsOpen: 0
        },
        governance: {
          branchProtectionCoverage: 100,
          reviewComplianceRate: 95,
          pullRequestReviewQueueAgeDays: 2
        },
        cicd: {
          ciSuccessRate: 96,
          deploymentFrequencyWeekly: 14,
          workflowFailureRate: 4
        },
        quality: {
          testCoverage: 91,
          dependencyFreshness: 88,
          issueHygiene: 86,
          dependabotAlertAgeDays: 4
        },
        repositoryHealth: {
          staleIssueAgeDays: 3
        },
        signalCoverage: 96,
        activityRecencyDays: 1
      },
      {
        repository: {
          name: "api-gateway",
          pushedAt: "2025-12-31T00:00:00.000Z",
          importance: "important"
        },
        security: {
          openAlerts: 2,
          vulnerabilitiesResolved: 18,
          vulnerabilitiesTotal: 20,
          codeScanningAlertsOpen: 1
        },
        governance: {
          branchProtectionCoverage: 100,
          reviewComplianceRate: 91,
          pullRequestReviewQueueAgeDays: 1
        },
        cicd: {
          ciSuccessRate: 94,
          deploymentFrequencyWeekly: 16,
          workflowFailureRate: 6
        },
        quality: {
          testCoverage: 87,
          dependencyFreshness: 84,
          issueHygiene: 82,
          dependabotAlertAgeDays: 5
        },
        repositoryHealth: {
          staleIssueAgeDays: 5
        },
        signalCoverage: 94,
        activityRecencyDays: 1
      },
      {
        repository: {
          name: "admin-panel",
          pushedAt: "2025-12-28T00:00:00.000Z",
          importance: "medium"
        },
        security: {
          openAlerts: 8,
          vulnerabilitiesResolved: 14,
          vulnerabilitiesTotal: 20,
          codeScanningAlertsOpen: 4
        },
        governance: {
          branchProtectionCoverage: 78,
          reviewComplianceRate: 74,
          pullRequestReviewQueueAgeDays: 7
        },
        cicd: {
          ciSuccessRate: 76,
          deploymentFrequencyWeekly: 6,
          workflowFailureRate: 24
        },
        quality: {
          testCoverage: 68,
          dependencyFreshness: 63,
          issueHygiene: 58,
          dependabotAlertAgeDays: 14
        },
        repositoryHealth: {
          staleIssueAgeDays: 18
        },
        signalCoverage: 90,
        activityRecencyDays: 4
      },
      {
        repository: {
          name: "infra-tools",
          pushedAt: "2025-12-25T00:00:00.000Z",
          importance: "support"
        },
        security: {
          openAlerts: 4,
          vulnerabilitiesResolved: 16,
          vulnerabilitiesTotal: 20,
          codeScanningAlertsOpen: 2
        },
        governance: {
          branchProtectionCoverage: 80,
          reviewComplianceRate: 77,
          pullRequestReviewQueueAgeDays: 4
        },
        cicd: {
          ciSuccessRate: 79,
          deploymentFrequencyWeekly: 4,
          workflowFailureRate: 18
        },
        quality: {
          testCoverage: 72,
          dependencyFreshness: 70,
          issueHygiene: 69,
          dependabotAlertAgeDays: 9
        },
        repositoryHealth: {
          staleIssueAgeDays: 11
        },
        signalCoverage: 82,
        activityRecencyDays: 7
      }
    ]
  }
};

export function getMockGitHubFixture(organization: string): GitHubOrganizationSignalInput {
  return FIXTURES[organization] ?? {
    organization: {
      login: organization,
      name: organization
    },
    calculatedAt: "2026-01-01T00:05:00.000Z",
    repositories: []
  };
}
