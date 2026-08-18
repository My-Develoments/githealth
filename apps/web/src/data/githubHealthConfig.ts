import type { GitHubHealthConfig, GitHubSource } from "./githubHealthContracts";

const DEFAULT_ORGANIZATION = "githealth-labs";
const DEFAULT_SOURCE: GitHubSource = "mock";

export function resolveGitHubHealthConfig(): GitHubHealthConfig {
  const apiBaseUrl = sanitizeBaseUrl(import.meta.env.VITE_API_BASE_URL);
  const organization = sanitizeOrganization(import.meta.env.VITE_GITHUB_ORG);
  const source = sanitizeSource(import.meta.env.VITE_GITHUB_SOURCE);

  return {
    apiBaseUrl,
    organization,
    source
  };
}

function sanitizeBaseUrl(value: string | undefined): string {
  if (!value) {
    return "";
  }
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function sanitizeOrganization(value: string | undefined): string {
  if (!value) {
    return DEFAULT_ORGANIZATION;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return DEFAULT_ORGANIZATION;
  }

  return trimmed;
}

function sanitizeSource(value: string | undefined): GitHubSource {
  if (value === "live") {
    return "live";
  }
  return DEFAULT_SOURCE;
}
