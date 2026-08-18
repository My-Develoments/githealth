import type {
  HealthCategoryKey,
  OrganizationHealthScore,
  RecommendationPriority,
  RepositoryHealthScore,
  ValidationIssue
} from "../domain/health/types.js";

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

export function toApiRepositoryScore(source: RepositoryHealthScore): ApiRepositoryScore {
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
    validationIssues: source.validationIssues.map(mapValidationIssue)
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
