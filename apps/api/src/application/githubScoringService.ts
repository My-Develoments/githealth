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
import { getGitHubScoreCacheConfig } from "../infrastructure/runtime/githubScoreCacheConfig.js";

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

export type GitHubScoreCacheStatistics = {
  strategy: "in-memory";
  ttlMs: number;
  hits: number;
  misses: number;
  size: number;
};

const liveGitHubScoreCache = new Map<string, CachedGitHubScoreResult>();
let liveGitHubScoreCacheHits = 0;
let liveGitHubScoreCacheMisses = 0;

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

function pruneExpiredCacheEntries(now = Date.now()): void {
  for (const [cacheKey, cacheEntry] of liveGitHubScoreCache) {
    if (cacheEntry.result && cacheEntry.expiresAt <= now) {
      liveGitHubScoreCache.delete(cacheKey);
    }
  }
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

  const normalizedRepositoriesById = new Map(
    normalized.repositories.map((repository) => [repository.id, repository])
  );

  return {
    source,
    organization: toApiOrganizationScore(scored.organizationScore),
    repositories: scored.repositoryScores.map((repositoryScore) =>
      toApiRepositoryScore(repositoryScore, normalizedRepositoriesById.get(repositoryScore.repositoryId))
    ),
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

  const { ttlMs } = getGitHubScoreCacheConfig();
  pruneExpiredCacheEntries();

  const cacheKey = buildCacheKey(organization, source, repository);
  const now = Date.now();
  const cached = liveGitHubScoreCache.get(cacheKey);

  if (cached?.result && cached.expiresAt > now) {
    liveGitHubScoreCacheHits += 1;
    return cached.result;
  }

  if (cached?.promise) {
    liveGitHubScoreCacheHits += 1;
    return cached.promise;
  }

  liveGitHubScoreCacheMisses += 1;
  const promise = computeGitHubScores(organization, sourceInput, repository)
    .then((result) => {
      if (result.fetchStatus === "complete") {
        liveGitHubScoreCache.set(cacheKey, {
          expiresAt: Date.now() + ttlMs,
          result
        });
      } else {
        liveGitHubScoreCache.delete(cacheKey);
      }
      return result;
    })
    .catch((error) => {
      liveGitHubScoreCache.delete(cacheKey);
      throw error;
    });

  liveGitHubScoreCache.set(cacheKey, {
    expiresAt: now + ttlMs,
    promise
  });

  return promise;
}

export function resetGitHubScoreCache(): void {
  liveGitHubScoreCache.clear();
  liveGitHubScoreCacheHits = 0;
  liveGitHubScoreCacheMisses = 0;
}

export function getGitHubScoreCacheStatistics(): GitHubScoreCacheStatistics {
  pruneExpiredCacheEntries();

  const { ttlMs, strategy } = getGitHubScoreCacheConfig();

  return {
    strategy,
    ttlMs,
    hits: liveGitHubScoreCacheHits,
    misses: liveGitHubScoreCacheMisses,
    size: liveGitHubScoreCache.size
  };
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
