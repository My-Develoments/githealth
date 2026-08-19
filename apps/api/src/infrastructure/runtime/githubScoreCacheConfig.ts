export type GitHubScoreCacheConfig = {
  ttlMs: number;
  strategy: "in-memory";
};

const DEFAULT_GITHUB_SCORE_CACHE_TTL_MS = 30_000;

function parsePositiveInteger(rawValue: string | undefined, envName: string, fallback: number): number {
  const value = typeof rawValue === "string" && rawValue.trim().length > 0 ? Number(rawValue) : fallback;

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid ${envName} value. Expected a positive integer.`);
  }

  return value;
}

export function getGitHubScoreCacheConfig(): GitHubScoreCacheConfig {
  const ttlMs = parsePositiveInteger(
    process.env.GITHUB_SCORE_CACHE_TTL_MS,
    "GITHUB_SCORE_CACHE_TTL_MS",
    DEFAULT_GITHUB_SCORE_CACHE_TTL_MS
  );

  return {
    ttlMs,
    strategy: "in-memory"
  };
}