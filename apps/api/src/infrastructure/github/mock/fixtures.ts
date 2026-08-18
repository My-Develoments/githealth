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
          vulnerabilitiesTotal: 20
        },
        governance: {
          branchProtectionCoverage: 100,
          reviewComplianceRate: 95
        },
        cicd: {
          ciSuccessRate: 96,
          deploymentFrequencyWeekly: 14
        },
        quality: {
          testCoverage: 91,
          dependencyFreshness: 88,
          issueHygiene: 86
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
          vulnerabilitiesTotal: 20
        },
        governance: {
          branchProtectionCoverage: 100,
          reviewComplianceRate: 91
        },
        cicd: {
          ciSuccessRate: 94,
          deploymentFrequencyWeekly: 16
        },
        quality: {
          testCoverage: 87,
          dependencyFreshness: 84,
          issueHygiene: 82
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
          vulnerabilitiesTotal: 20
        },
        governance: {
          branchProtectionCoverage: 78,
          reviewComplianceRate: 74
        },
        cicd: {
          ciSuccessRate: 76,
          deploymentFrequencyWeekly: 6
        },
        quality: {
          testCoverage: 68,
          dependencyFreshness: 63,
          issueHygiene: 58
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
          vulnerabilitiesTotal: 20
        },
        governance: {
          branchProtectionCoverage: 80,
          reviewComplianceRate: 77
        },
        cicd: {
          ciSuccessRate: 79,
          deploymentFrequencyWeekly: 4
        },
        quality: {
          testCoverage: 72,
          dependencyFreshness: 70,
          issueHygiene: 69
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
