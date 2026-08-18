export type GitHubRepositoryImportance = "important" | "medium" | "support";

export type GitHubOrganizationSlice = {
  login: string;
  name?: string;
};

export type GitHubRepositorySlice = {
  name: string;
  pushedAt?: string;
  archived?: boolean;
  protected?: boolean;
  openIssuesCount?: number;
  importance?: GitHubRepositoryImportance;
};

export type GitHubSecuritySignalSlice = {
  openAlerts?: number;
  vulnerabilitiesResolved?: number;
  vulnerabilitiesTotal?: number;
  codeScanningAlertsOpen?: number;
};

export type GitHubGovernanceSignalSlice = {
  branchProtectionCoverage?: number;
  reviewComplianceRate?: number;
  pullRequestReviewQueueAgeDays?: number;
};

export type GitHubCicdSignalSlice = {
  ciSuccessRate?: number;
  deploymentFrequencyWeekly?: number;
  workflowFailureRate?: number;
};

export type GitHubQualitySignalSlice = {
  testCoverage?: number;
  dependencyFreshness?: number;
  issueHygiene?: number;
  dependabotAlertAgeDays?: number;
};

export type GitHubRepositoryHealthSignalSlice = {
  staleIssueAgeDays?: number;
};

export type GitHubRepositorySignalInput = {
  repository: GitHubRepositorySlice;
  security?: GitHubSecuritySignalSlice;
  governance?: GitHubGovernanceSignalSlice;
  cicd?: GitHubCicdSignalSlice;
  quality?: GitHubQualitySignalSlice;
  repositoryHealth?: GitHubRepositoryHealthSignalSlice;
  signalCoverage?: number;
  activityRecencyDays?: number;
};

export type GitHubOrganizationSignalInput = {
  organization: GitHubOrganizationSlice;
  repositories: GitHubRepositorySignalInput[];
  calculatedAt?: string;
};
