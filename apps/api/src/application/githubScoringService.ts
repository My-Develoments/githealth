import { scoreOrganization } from "../domain/health/scorer.js";
import {
  toApiOrganizationScore,
  toApiRepositoryScore,
  type ApiOrganizationScore,
  type ApiRepositoryScore
} from "./healthScoreDto.js";
import type {
  GitHubAdapterIssue,
  GitHubSource,
  FetchStatus
} from "./githubNormalizedModels.js";
import { toOrganizationInput } from "./githubNormalizedModels.js";
import type { GitHubOrganizationDataRequest } from "./githubOrganizationDataAdapter.js";
import { MockGitHubOrganizationAdapter } from "../infrastructure/github/mock/mockGitHubOrganizationAdapter.js";
import { LiveGitHubOrganizationAdapter } from "../infrastructure/github/live/liveGitHubOrganizationAdapter.js";

export type GitHubOrganizationScoreResponse = {
  source: GitHubSource;
  organization: ApiOrganizationScore;
  fetchStatus: FetchStatus;
  adapterIssues: GitHubAdapterIssue[];
};

export type GitHubRepositoryScoresResponse = {
  source: GitHubSource;
  repositories: ApiRepositoryScore[];
  fetchStatus: FetchStatus;
  adapterIssues: GitHubAdapterIssue[];
};

export type GitHubRepositoryScoreResponse = {
  source: GitHubSource;
  repository: ApiRepositoryScore | null;
  fetchStatus: FetchStatus;
  adapterIssues: GitHubAdapterIssue[];
};

function resolveSource(input?: GitHubSource): GitHubSource {
  return input === "mock" ? "mock" : "live";
}

function resolveAdapter(source: GitHubSource) {
  return source === "live"
    ? new LiveGitHubOrganizationAdapter()
    : new MockGitHubOrganizationAdapter();
}

async function computeGitHubScores(
  organization: string,
  sourceInput?: GitHubSource,
  repository?: string
): Promise<{
  source: GitHubSource;
  organization: ApiOrganizationScore;
  repositories: ApiRepositoryScore[];
  fetchStatus: FetchStatus;
  adapterIssues: GitHubAdapterIssue[];
}> {
  const source = resolveSource(sourceInput);
  const adapter = resolveAdapter(source);

  const request: GitHubOrganizationDataRequest = {
    organization,
    source,
    repository
  };

  const normalized = await adapter.fetchOrganizationData(request);
  const organizationInput = toOrganizationInput(normalized);

  const scored = scoreOrganization(organizationInput, {
    calculatedAt: normalized.calculatedAt
  });

  return {
    source,
    organization: toApiOrganizationScore(scored.organizationScore),
    repositories: scored.repositoryScores.map(toApiRepositoryScore),
    fetchStatus: normalized.fetchStatus,
    adapterIssues: normalized.issues
  };
}

export async function getGitHubOrganizationScore(
  organization: string,
  sourceInput?: GitHubSource
): Promise<GitHubOrganizationScoreResponse> {
  const result = await computeGitHubScores(organization, sourceInput);
  return {
    source: result.source,
    organization: result.organization,
    fetchStatus: result.fetchStatus,
    adapterIssues: result.adapterIssues
  };
}

export async function getGitHubRepositoryScores(
  organization: string,
  sourceInput?: GitHubSource
): Promise<GitHubRepositoryScoresResponse> {
  const result = await computeGitHubScores(organization, sourceInput);
  return {
    source: result.source,
    repositories: result.repositories,
    fetchStatus: result.fetchStatus,
    adapterIssues: result.adapterIssues
  };
}

export async function getGitHubRepositoryScoreById(
  organization: string,
  repositoryId: string,
  sourceInput?: GitHubSource
): Promise<GitHubRepositoryScoreResponse> {
  const result = await computeGitHubScores(organization, sourceInput, repositoryId);
  return {
    source: result.source,
    repository: result.repositories.find((repository) => repository.repositoryId === repositoryId) ?? null,
    fetchStatus: result.fetchStatus,
    adapterIssues: result.adapterIssues
  };
}
