export type HealthCategoryKey = "repository-health" | "security" | "governance" | "cicd" | "quality-maintenance";

export type MetricDirection = "higher-is-better" | "lower-is-better";

export type RepositoryImportance = "important" | "medium" | "support";

export type RecommendationPriority = "high" | "medium" | "low";

export type HealthMetricDefinition = {
  key: string;
  label: string;
  category: HealthCategoryKey;
  weight: number;
  min: number;
  max: number;
  direction: MetricDirection;
};

export type RepositoryMetricInput = Record<string, number | null | undefined>;

export type RepositoryInput = {
  id: string;
  name: string;
  importance: RepositoryImportance;
  metrics: RepositoryMetricInput;
};

export type OrganizationInput = {
  id: string;
  name: string;
  repositories: RepositoryInput[];
};

export type ValidationIssue = {
  scope: "metric" | "repository" | "organization";
  code: string;
  message: string;
  metricKey?: string;
  repositoryId?: string;
};

export type MetricNormalizationResult = {
  value: number | null;
  missing: boolean;
  invalid: boolean;
  issues: ValidationIssue[];
};

export type ScoreContribution = {
  metricKey: string;
  metricLabel: string;
  category: HealthCategoryKey;
  metricWeight: number;
  normalizedValue: number;
  weightedImpact: number;
  rationale: string;
};

export type CategoryScore = {
  category: HealthCategoryKey;
  score: number;
  completeness: number;
  metricsConsidered: number;
  metricsMissing: number;
  contributions: ScoreContribution[];
};

export type Recommendation = {
  id: string;
  actionKey: string;
  category: HealthCategoryKey;
  title: string;
  description: string;
  priority: RecommendationPriority;
};

export type RepositoryHealthScore = {
  repositoryId: string;
  repositoryName: string;
  importance: RepositoryImportance;
  overallScore: number;
  categories: CategoryScore[];
  completeness: number;
  positiveContributors: ScoreContribution[];
  negativeContributors: ScoreContribution[];
  recommendations: Recommendation[];
  validationIssues: ValidationIssue[];
  _internal?: {
    overallScoreRaw: number;
    completenessRaw: number;
    categoryScoreRaw: Record<HealthCategoryKey, number>;
  };
};

export type OrganizationHealthScore = {
  organizationId: string;
  organizationName: string;
  overallScore: number;
  categories: CategoryScore[];
  completeness: number;
  repositoryCount: number;
  positiveContributors: ScoreContribution[];
  negativeContributors: ScoreContribution[];
  recommendations: Recommendation[];
  validationIssues: ValidationIssue[];
  scoringVersion: string;
  calculatedAt: string;
};
