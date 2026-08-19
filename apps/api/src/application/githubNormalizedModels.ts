import type { OrganizationInput, RepositoryImportance, RepositoryMetricInput } from "../domain/health/types.js";
import type { GitHubWorkflowTelemetrySlice } from "../infrastructure/github/types.js";

export type GitHubSource = "mock" | "live";

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

export type FetchStatus = "complete" | "partial" | "failed";

export type GitHubNormalizedRepository = {
  id: string;
  name: string;
  importance: RepositoryImportance;
  metrics: RepositoryMetricInput;
  cicdTelemetry?: GitHubWorkflowTelemetrySlice;
  issues: GitHubAdapterIssue[];
};

export type GitHubNormalizedOrganization = {
  organizationId: string;
  organizationName: string;
  repositories: GitHubNormalizedRepository[];
  issues: GitHubAdapterIssue[];
  fetchStatus: FetchStatus;
  calculatedAt?: string;
};

export function toOrganizationInput(source: GitHubNormalizedOrganization): OrganizationInput {
  return {
    id: source.organizationId,
    name: source.organizationName,
    repositories: source.repositories.map((repository) => ({
      id: repository.id,
      name: repository.name,
      importance: repository.importance,
      metrics: repository.metrics
    }))
  };
}
