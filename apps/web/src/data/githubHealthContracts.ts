export type GitHubSource = "mock" | "live";

export type GitHubAuthProvider = "pat" | "app";

export type GitHubFetchStatus = "complete" | "partial" | "failed";

export type GitHubAdapterIssueCode =
  | "AUTH_MISSING"
  | "AUTH_INVALID"
  | "PERMISSION_DENIED"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "UPSTREAM_UNAVAILABLE"
  | "INVALID_RESPONSE"
  | "DATA_TRUNCATED"
  | "MAPPER_DATA_MISSING";

export type GitHubAdapterIssue = {
  code: GitHubAdapterIssueCode;
  message: string;
  repositoryId?: string;
};

export type ApiHealthCategoryKey = "repository-health" | "security" | "governance" | "cicd" | "quality-maintenance";

export type ApiCategoryScore = {
  category: ApiHealthCategoryKey;
  score: number;
  completeness: number;
  metricsConsidered: number;
  metricsMissing: number;
};

export type ApiValidationIssue = {
  scope: "organization" | "repository";
  message: string;
  metricKey?: string;
  repositoryId?: string;
};

export type ApiRecommendation = {
  actionKey: string;
  category: ApiHealthCategoryKey;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
};

export type ApiScoreContributor = {
  metricKey: string;
  metricLabel: string;
  category: ApiHealthCategoryKey;
  rationale: string;
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

export type ApiRepositoryImportance = "critical" | "high" | "medium" | "low";

export type ApiRepositoryScore = {
  repositoryId: string;
  repositoryName: string;
  importance: ApiRepositoryImportance;
  overallScore: number;
  categories: ApiCategoryScore[];
  completeness: number;
  positiveContributors: ApiScoreContributor[];
  negativeContributors: ApiScoreContributor[];
  recommendations: ApiRecommendation[];
  validationIssues: ApiValidationIssue[];
};

export type GitHubOrganizationScoreResponse = {
  source: GitHubSource;
  organization: ApiOrganizationScore;
  fetchStatus: GitHubFetchStatus;
  adapterIssues: GitHubAdapterIssue[];
};

export type GitHubRepositoryScoresResponse = {
  source: GitHubSource;
  repositories: ApiRepositoryScore[];
  fetchStatus: GitHubFetchStatus;
  adapterIssues: GitHubAdapterIssue[];
};

export type GitHubHealthIntegrationState =
  | "loading"
  | "ready"
  | "partial"
  | "failed"
  | "empty"
  | "error";

export type GitHubHealthConfig = {
  apiBaseUrl: string;
  organization: string;
  source: GitHubSource;
};

export type GitHubConnectionState = "not_configured" | "ready_to_connect" | "connecting" | "connected" | "error";

export type GitHubConnectionStatusResponse = {
  provider: GitHubAuthProvider;
  status: Exclude<GitHubConnectionState, "connecting">;
  isConnected: boolean;
  canConnect: boolean;
  hasInstallationId: boolean;
  installUrlConfigured: boolean;
  callbackRedirectConfigured: boolean;
  message: string;
};

export type GitHubConnectionStartResponse = {
  provider: "app";
  status: "ready_to_connect";
  connectUrl: string;
};

export type GitHubConnectionViewModel = Omit<GitHubConnectionStatusResponse, "status"> & {
  status: GitHubConnectionState;
};
