import type { OrganizationInput, RepositoryInput } from "../../domain/health/types.js";

export type HealthScoringScenario = "baseline" | "mixed" | "critical-heavy" | "sparse" | "invalid";

type RepositoryFixture = Omit<RepositoryInput, "metrics"> & {
  metrics: RepositoryInput["metrics"];
};

const baselineRepositories: RepositoryFixture[] = [
  {
    id: "frontend-web",
    name: "frontend-web",
    importance: "important",
    metrics: {
      repo_signal_coverage: 96,
      repo_activity_recency_days: 1,
      security_alerts_open: 0,
      vuln_resolution_rate: 97,
      branch_protection_coverage: 100,
      review_compliance_rate: 94,
      ci_success_rate: 96,
      deployment_frequency_weekly: 14,
      test_coverage: 91,
      dependency_freshness: 88,
      issue_hygiene: 86
    }
  },
  {
    id: "api-gateway",
    name: "api-gateway",
    importance: "important",
    metrics: {
      repo_signal_coverage: 94,
      repo_activity_recency_days: 1,
      security_alerts_open: 2,
      vuln_resolution_rate: 92,
      branch_protection_coverage: 100,
      review_compliance_rate: 91,
      ci_success_rate: 94,
      deployment_frequency_weekly: 16,
      test_coverage: 87,
      dependency_freshness: 84,
      issue_hygiene: 82
    }
  },
  {
    id: "admin-panel",
    name: "admin-panel",
    importance: "medium",
    metrics: {
      repo_signal_coverage: 90,
      repo_activity_recency_days: 4,
      security_alerts_open: 8,
      vuln_resolution_rate: 71,
      branch_protection_coverage: 78,
      review_compliance_rate: 74,
      ci_success_rate: 76,
      deployment_frequency_weekly: 6,
      test_coverage: 68,
      dependency_freshness: 63,
      issue_hygiene: 58
    }
  },
  {
    id: "infra-tools",
    name: "infra-tools",
    importance: "support",
    metrics: {
      repo_signal_coverage: 82,
      repo_activity_recency_days: 7,
      security_alerts_open: 4,
      vuln_resolution_rate: 81,
      branch_protection_coverage: 80,
      review_compliance_rate: 77,
      ci_success_rate: 79,
      deployment_frequency_weekly: 4,
      test_coverage: 72,
      dependency_freshness: 70,
      issue_hygiene: 69
    }
  }
];

function cloneRepositories(repositories: RepositoryFixture[]): RepositoryInput[] {
  return repositories.map((repository) => ({
    ...repository,
    metrics: { ...repository.metrics }
  }));
}

function scenarioRepositories(scenario: HealthScoringScenario): RepositoryInput[] {
  const repositories = cloneRepositories(baselineRepositories);

  if (scenario === "baseline") {
    return repositories;
  }

  if (scenario === "mixed") {
    repositories[0].metrics.security_alerts_open = 1;
    repositories[1].metrics.test_coverage = 82;
    repositories[2].metrics.branch_protection_coverage = 70;
    repositories[3].metrics.repo_activity_recency_days = 11;
    return repositories;
  }

  if (scenario === "critical-heavy") {
    for (const repository of repositories) {
      repository.metrics.security_alerts_open = 12;
      repository.metrics.vuln_resolution_rate = 35;
      repository.metrics.branch_protection_coverage = 45;
      repository.metrics.ci_success_rate = 52;
      repository.metrics.test_coverage = 44;
      repository.metrics.dependency_freshness = 39;
      repository.metrics.issue_hygiene = 40;
      repository.metrics.repo_activity_recency_days = 17;
    }
    return repositories;
  }

  if (scenario === "sparse") {
    repositories[1].metrics.vuln_resolution_rate = undefined;
    repositories[1].metrics.branch_protection_coverage = undefined;
    repositories[2].metrics.ci_success_rate = undefined;
    repositories[2].metrics.test_coverage = undefined;
    repositories[3].metrics.repo_signal_coverage = undefined;
    repositories[3].metrics.deployment_frequency_weekly = undefined;
    return repositories;
  }

  repositories[0].metrics.security_alerts_open = -6;
  repositories[1].metrics.vuln_resolution_rate = 180;
  repositories[2].metrics.repo_activity_recency_days = 88;
  repositories[2].metrics.issue_hygiene = -20;
  repositories[3].metrics.deployment_frequency_weekly = 120;
  repositories[3].metrics.branch_protection_coverage = 140;
  return repositories;
}

export function getMockOrganizationInput(
  scenario: HealthScoringScenario = "baseline"
): OrganizationInput {
  return {
    id: `githealth-${scenario}`,
    name: "GitHealth Labs",
    repositories: scenarioRepositories(scenario)
  };
}

export function resolveScenario(input: string | undefined): HealthScoringScenario {
  if (!input) {
    return "baseline";
  }

  if (
    input === "baseline" ||
    input === "mixed" ||
    input === "critical-heavy" ||
    input === "sparse" ||
    input === "invalid"
  ) {
    return input;
  }

  return "baseline";
}
