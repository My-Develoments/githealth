import type { GitHubNormalizedOrganization, GitHubSource } from "./githubNormalizedModels.js";

export type GitHubOrganizationDataRequest = {
  organization: string;
  source: GitHubSource;
  repository?: string;
};

export interface GitHubOrganizationDataAdapter {
  fetchOrganizationData(request: GitHubOrganizationDataRequest): Promise<GitHubNormalizedOrganization>;
}
