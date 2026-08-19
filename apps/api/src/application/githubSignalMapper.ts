import type { RepositoryImportance, RepositoryMetricInput } from "../domain/health/types.js";
import type {
  FetchStatus,
  GitHubAdapterIssue,
  GitHubNormalizedOrganization,
  GitHubNormalizedRepository
} from "./githubNormalizedModels.js";
import type {
  GitHubOrganizationSignalInput,
  GitHubRepositorySignalInput
} from "../infrastructure/github/types.js";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function daysSince(isoDate: string | undefined): number | undefined {
  if (!isoDate) {
    return undefined;
  }

  const now = Date.now();
  const input = new Date(isoDate).getTime();
  if (Number.isNaN(input)) {
    return undefined;
  }

  const days = Math.floor((now - input) / (1000 * 60 * 60 * 24));
  return clamp(days, 0, 365);
}

function deriveImportance(input: GitHubRepositorySignalInput): RepositoryImportance {
  if (input.repository.importance) {
    return input.repository.importance;
  }

  if (input.repository.archived) {
    return "support";
  }

  const name = input.repository.name.toLowerCase();
  if (name.includes("infra") || name.includes("tool") || name.includes("ops")) {
    return "support";
  }

  if (name.includes("api") || name.includes("web") || name.includes("core")) {
    return "important";
  }

  return "medium";
}

function computeVulnResolutionRate(
  repository: GitHubRepositorySignalInput
): { value: number | undefined; missingResolved: boolean } {
  if (typeof repository.security?.vulnerabilitiesTotal !== "number") {
    return { value: undefined, missingResolved: false };
  }

  const total = repository.security.vulnerabilitiesTotal;
  const resolved = repository.security.vulnerabilitiesResolved;

  if (typeof resolved !== "number") {
    return { value: undefined, missingResolved: true };
  }

  if (total <= 0) {
    return { value: 100, missingResolved: false };
  }

  return {
    value: clamp((resolved / total) * 100, 0, 100),
    missingResolved: false
  };
}

function computeSignalCoverage(metrics: RepositoryMetricInput, explicitCoverage?: number): number {
  if (typeof explicitCoverage === "number") {
    return clamp(explicitCoverage, 0, 100);
  }

  const keys: Array<keyof RepositoryMetricInput> = [
    "repo_activity_recency_days",
    "security_alerts_open",
    "vuln_resolution_rate",
    "branch_protection_coverage",
    "review_compliance_rate",
    "ci_success_rate",
    "deployment_frequency_weekly",
    "test_coverage",
    "dependency_freshness",
    "issue_hygiene"
  ];

  const available = keys.filter((key) => typeof metrics[key] === "number").length;
  return Math.round((available / keys.length) * 100);
}

function mapRepository(input: GitHubRepositorySignalInput): GitHubNormalizedRepository {
  const vulnerabilityResolution = computeVulnResolutionRate(input);

  const metrics: RepositoryMetricInput = {
    repo_activity_recency_days:
      typeof input.activityRecencyDays === "number"
        ? clamp(input.activityRecencyDays, 0, 365)
        : daysSince(input.repository.pushedAt),
    security_alerts_open: input.security?.openAlerts,
    code_scanning_alerts_open: input.security?.codeScanningAlertsOpen,
    vuln_resolution_rate: vulnerabilityResolution.value,
    branch_protection_coverage: input.governance?.branchProtectionCoverage,
    review_compliance_rate: input.governance?.reviewComplianceRate,
    pull_request_review_queue_age_days: input.governance?.pullRequestReviewQueueAgeDays,
    ci_success_rate: input.cicd?.ciSuccessRate,
    deployment_frequency_weekly: input.cicd?.deploymentFrequencyWeekly,
    workflow_failure_rate: input.cicd?.workflowFailureRate,
    test_coverage: input.quality?.testCoverage,
    dependency_freshness: input.quality?.dependencyFreshness,
    dependabot_alert_age_days: input.quality?.dependabotAlertAgeDays,
    issue_hygiene: input.quality?.issueHygiene,
    stale_issue_age_days: input.repositoryHealth?.staleIssueAgeDays
  };

  metrics.repo_signal_coverage = computeSignalCoverage(metrics, input.signalCoverage);

  const issues: GitHubAdapterIssue[] = [];
  if (metrics.repo_activity_recency_days === undefined) {
    issues.push({
      code: "MAPPER_DATA_MISSING",
      message: "Repository activity recency is unavailable.",
      repositoryId: input.repository.name
    });
  }

  if (vulnerabilityResolution.missingResolved) {
    issues.push({
      code: "MAPPER_DATA_MISSING",
      message: "Vulnerability resolved count is unavailable.",
      repositoryId: input.repository.name
    });
  }

  return {
    id: input.repository.name,
    name: input.repository.name,
    importance: deriveImportance(input),
    metrics,
    cicdTelemetry: input.cicd?.workflowTelemetry,
    issues
  };
}

export function mapGitHubSignalsToNormalizedOrganization(
  input: GitHubOrganizationSignalInput,
  options?: {
    adapterIssues?: GitHubAdapterIssue[];
    fetchStatus?: FetchStatus;
  }
): GitHubNormalizedOrganization {
  const repositories = input.repositories.map(mapRepository);
  const issues = [
    ...(options?.adapterIssues ?? []),
    ...repositories.flatMap((repository) => repository.issues)
  ];

  const fetchStatus = options?.fetchStatus === "failed"
    ? "failed"
    : issues.length > 0 || options?.fetchStatus === "partial"
      ? "partial"
      : "complete";

  return {
    organizationId: input.organization.login,
    organizationName: input.organization.name ?? input.organization.login,
    repositories,
    issues,
    fetchStatus,
    calculatedAt: input.calculatedAt
  };
}
