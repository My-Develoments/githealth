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

type GitHubScoreComputationResult = {
  source: GitHubSource;
  organization: ApiOrganizationScore;
  repositories: ApiRepositoryScore[];
  fetchStatus: FetchStatus;
  adapterIssues: GitHubAdapterIssue[];
};

type CachedGitHubScoreResult = {
  expiresAt: number;
  result?: GitHubScoreComputationResult;
  promise?: Promise<GitHubScoreComputationResult>;
};

const LIVE_GITHUB_SCORE_CACHE_TTL_MS = 30_000;
const liveGitHubScoreCache = new Map<string, CachedGitHubScoreResult>();

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

function buildCacheKey(organization: string, source: GitHubSource, repository?: string): string {
  return JSON.stringify([organization, source, repository ?? ""]);
}

async function computeGitHubScores(
  organization: string,
  sourceInput?: GitHubSource,
  repository?: string
): Promise<GitHubScoreComputationResult> {
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

async function getCachedGitHubScores(
  organization: string,
  sourceInput?: GitHubSource,
  repository?: string
): Promise<GitHubScoreComputationResult> {
  const source = resolveSource(sourceInput);
  if (source !== "live") {
    return computeGitHubScores(organization, sourceInput, repository);
  }

  const cacheKey = buildCacheKey(organization, source, repository);
  const now = Date.now();
  const cached = liveGitHubScoreCache.get(cacheKey);

  if (cached?.result && cached.expiresAt > now) {
    return cached.result;
  }

  if (cached?.promise) {
    return cached.promise;
  }

  const promise = computeGitHubScores(organization, sourceInput, repository)
    .then((result) => {
      liveGitHubScoreCache.set(cacheKey, {
        expiresAt: Date.now() + LIVE_GITHUB_SCORE_CACHE_TTL_MS,
        result
      });
      return result;
    })
    .catch((error) => {
      liveGitHubScoreCache.delete(cacheKey);
      throw error;
    });

  liveGitHubScoreCache.set(cacheKey, {
    expiresAt: now + LIVE_GITHUB_SCORE_CACHE_TTL_MS,
    promise
  });

  return promise;
}

export function resetGitHubScoreCache(): void {
  liveGitHubScoreCache.clear();
}

export async function getGitHubOrganizationScore(
  organization: string,
  sourceInput?: GitHubSource
): Promise<GitHubOrganizationScoreResponse> {
  const result = await getCachedGitHubScores(organization, sourceInput);
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
  const result = await getCachedGitHubScores(organization, sourceInput);
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
  const result = await getCachedGitHubScores(organization, sourceInput, repositoryId);
  return {
    source: result.source,
    repository: result.repositories.find((repository) => repository.repositoryId === repositoryId) ?? null,
    fetchStatus: result.fetchStatus,
    adapterIssues: result.adapterIssues
  };
}
