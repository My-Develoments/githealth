export type ApiProtectionConfig = {
  apiAuthToken: string;
  allowedGitHubOrgs: string[];
  allowedGitHubOrgSet: Set<string>;
  githubEndpointRateLimitWindowMs: number;
  githubEndpointRateLimitMaxRequests: number;
};

const DEFAULT_GITHUB_ENDPOINT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_GITHUB_ENDPOINT_RATE_LIMIT_MAX_REQUESTS = 60;

function parsePositiveInteger(rawValue: string | undefined, envName: string, fallback: number): number {
  const value = typeof rawValue === "string" && rawValue.trim().length > 0 ? Number(rawValue) : fallback;

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid ${envName} value. Expected a positive integer.`);
  }

  return value;
}

function parseRequiredToken(rawValue: string | undefined): string {
  const token = typeof rawValue === "string" ? rawValue.trim() : "";
  if (token.length === 0) {
    throw new Error("Invalid API_AUTH_TOKEN value. Expected a non-empty token.");
  }

  return token;
}

function parseAllowedOrganizations(rawValue: string | undefined): string[] {
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    return [];
  }

  const deduped = new Set<string>();
  rawValue
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0)
    .forEach((value) => {
      deduped.add(value);
    });

  return [...deduped];
}

export function getApiProtectionConfig(): ApiProtectionConfig {
  const apiAuthToken = parseRequiredToken(process.env.API_AUTH_TOKEN);
  const allowedGitHubOrgs = parseAllowedOrganizations(process.env.ALLOWED_GITHUB_ORGS);
  const githubEndpointRateLimitWindowMs = parsePositiveInteger(
    process.env.GITHUB_ENDPOINT_RATE_LIMIT_WINDOW_MS,
    "GITHUB_ENDPOINT_RATE_LIMIT_WINDOW_MS",
    DEFAULT_GITHUB_ENDPOINT_RATE_LIMIT_WINDOW_MS
  );
  const githubEndpointRateLimitMaxRequests = parsePositiveInteger(
    process.env.GITHUB_ENDPOINT_RATE_LIMIT_MAX_REQUESTS,
    "GITHUB_ENDPOINT_RATE_LIMIT_MAX_REQUESTS",
    DEFAULT_GITHUB_ENDPOINT_RATE_LIMIT_MAX_REQUESTS
  );

  return {
    apiAuthToken,
    allowedGitHubOrgs,
    allowedGitHubOrgSet: new Set<string>(allowedGitHubOrgs),
    githubEndpointRateLimitWindowMs,
    githubEndpointRateLimitMaxRequests
  };
}

export function isAllowedGitHubOrganization(organization: string, allowedOrganizations: Set<string>): boolean {
  return allowedOrganizations.has(organization.trim().toLowerCase());
}
