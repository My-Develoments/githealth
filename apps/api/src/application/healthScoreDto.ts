import type {
  HealthCategoryKey,
  OrganizationHealthScore,
  RecommendationPriority,
  RepositoryHealthScore,
  ValidationIssue
} from "../domain/health/types.js";
import type { GitHubNormalizedRepository } from "./githubNormalizedModels.js";

export type ApiValidationIssue = {
  scope: ValidationIssue["scope"];
  message: string;
  metricKey?: string;
  repositoryId?: string;
};

export type ApiRecommendation = {
  actionKey: string;
  category: HealthCategoryKey;
  title: string;
  description: string;
  priority: RecommendationPriority;
};

export type ApiScoreContributor = {
  metricKey: string;
  metricLabel: string;
  category: HealthCategoryKey;
  rationale: string;
};

export type ApiCategoryScore = {
  category: HealthCategoryKey;
  score: number;
  completeness: number;
  metricsConsidered: number;
  metricsMissing: number;
};

export type ApiWorkflowRunStatus =
  | "queued"
  | "in_progress"
  | "completed"
  | "requested"
  | "waiting"
  | "pending"
  | "unknown";

export type ApiWorkflowRunConclusion =
  | "success"
  | "failure"
  | "cancelled"
  | "timed_out"
  | "action_required"
  | "startup_failure"
  | "neutral"
  | "skipped"
  | "stale"
  | "unknown";

export type ApiWorkflowRunContext = {
  id?: number;
  name: string;
  status: ApiWorkflowRunStatus;
  conclusion?: ApiWorkflowRunConclusion;
  event?: string;
  branch?: string;
  runNumber?: number;
  createdAt?: string;
  updatedAt?: string;
  url?: string;
};

export type ApiRepositoryCicdTelemetry = {
  ciSuccessRate?: number;
  deploymentFrequencyWeekly?: number;
  workflowFailureRate?: number;
  runSummary: {
    totalRuns: number;
    completedRuns: number;
    successCount: number;
    failureCount: number;
    successRate?: number;
    failureRate?: number;
    latestRunAt?: string;
  };
  recentRuns: ApiWorkflowRunContext[];
};

export type ApiRepositoryScore = {
  repositoryId: string;
  repositoryName: string;
  importance: RepositoryHealthScore["importance"];
  overallScore: number;
  categories: ApiCategoryScore[];
  completeness: number;
  positiveContributors: ApiScoreContributor[];
  negativeContributors: ApiScoreContributor[];
  recommendations: ApiRecommendation[];
  validationIssues: ApiValidationIssue[];
  cicdTelemetry?: ApiRepositoryCicdTelemetry;
};

export type ApiOrganizationScore = {
  organizationId: string;
  organizationName: string;
  overallScore: number;
  categories: ApiCategoryScore[];
  completeness: number;
  repositoryCount: number;
  positiveContributors: ApiScoreContributor[];
  negativeContributors: ApiScoreContributor[];
  recommendations: ApiRecommendation[];
  validationIssues: ApiValidationIssue[];
  scoringVersion: string;
  calculatedAt: string;
};

function mapValidationIssue(issue: ValidationIssue): ApiValidationIssue {
  return {
    scope: issue.scope,
    message: issue.message,
    metricKey: issue.metricKey,
    repositoryId: issue.repositoryId
  };
}

function mapCategoryScores(source: RepositoryHealthScore["categories"] | OrganizationHealthScore["categories"]): ApiCategoryScore[] {
  return source.map((category) => ({
    category: category.category,
    score: category.score,
    completeness: category.completeness,
    metricsConsidered: category.metricsConsidered,
    metricsMissing: category.metricsMissing
  }));
}

function mapContributors(source: RepositoryHealthScore["positiveContributors"] | OrganizationHealthScore["positiveContributors"]): ApiScoreContributor[] {
  return source.map((value) => ({
    metricKey: value.metricKey,
    metricLabel: value.metricLabel,
    category: value.category,
    rationale: value.rationale
  }));
}

function mapRecommendations(source: RepositoryHealthScore["recommendations"] | OrganizationHealthScore["recommendations"]): ApiRecommendation[] {
  return source.map((value) => ({
    actionKey: value.actionKey,
    category: value.category,
    title: value.title,
    description: value.description,
    priority: value.priority
  }));
}

function mapRepositoryCicdTelemetry(repository: GitHubNormalizedRepository | undefined): ApiRepositoryCicdTelemetry | undefined {
  if (!repository) {
    return undefined;
  }

  const runSummary = repository.cicdTelemetry?.runSummary;
  const recentRuns = repository.cicdTelemetry?.recentRuns;

  if (!runSummary && (!recentRuns || recentRuns.length === 0)) {
    return undefined;
  }

  return {
    ciSuccessRate: typeof repository.metrics.ci_success_rate === "number" ? repository.metrics.ci_success_rate : undefined,
    deploymentFrequencyWeekly:
      typeof repository.metrics.deployment_frequency_weekly === "number"
        ? repository.metrics.deployment_frequency_weekly
        : undefined,
    workflowFailureRate:
      typeof repository.metrics.workflow_failure_rate === "number"
        ? repository.metrics.workflow_failure_rate
        : undefined,
    runSummary: {
      totalRuns: runSummary?.totalRuns ?? 0,
      completedRuns: runSummary?.completedRuns ?? 0,
      successCount: runSummary?.successCount ?? 0,
      failureCount: runSummary?.failureCount ?? 0,
      successRate: runSummary?.successRate,
      failureRate: runSummary?.failureRate,
      latestRunAt: runSummary?.latestRunAt
    },
    recentRuns: recentRuns ?? []
  };
}

export function toApiRepositoryScore(source: RepositoryHealthScore, repository?: GitHubNormalizedRepository): ApiRepositoryScore {
  return {
    repositoryId: source.repositoryId,
    repositoryName: source.repositoryName,
    importance: source.importance,
    overallScore: source.overallScore,
    categories: mapCategoryScores(source.categories),
    completeness: source.completeness,
    positiveContributors: mapContributors(source.positiveContributors),
    negativeContributors: mapContributors(source.negativeContributors),
    recommendations: mapRecommendations(source.recommendations),
    validationIssues: source.validationIssues.map(mapValidationIssue),
    cicdTelemetry: mapRepositoryCicdTelemetry(repository)
  };
}

export function toApiOrganizationScore(source: OrganizationHealthScore): ApiOrganizationScore {
  return {
    organizationId: source.organizationId,
    organizationName: source.organizationName,
    overallScore: source.overallScore,
    categories: mapCategoryScores(source.categories),
    completeness: source.completeness,
    repositoryCount: source.repositoryCount,
    positiveContributors: mapContributors(source.positiveContributors),
    negativeContributors: mapContributors(source.negativeContributors),
    recommendations: mapRecommendations(source.recommendations),
    validationIssues: source.validationIssues.map(mapValidationIssue),
    scoringVersion: source.scoringVersion,
    calculatedAt: source.calculatedAt
  };
}
