import type { GitHubHealthConfig, GitHubSource } from "./githubHealthContracts";

const DEFAULT_ORGANIZATION = "githealth-labs";
const DEFAULT_SOURCE: GitHubSource = "live";
const GITHUB_ORG_SLUG_PATTERN = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;

export function resolveGitHubHealthConfig(): GitHubHealthConfig {
  const apiBaseUrl = sanitizeBaseUrl(import.meta.env.VITE_API_BASE_URL);
  const source = sanitizeSource(import.meta.env.VITE_GITHUB_SOURCE);
  const organization = sanitizeOrganization(import.meta.env.VITE_GITHUB_ORG, source);

  return {
    apiBaseUrl,
    organization,
    source
  };
}

type LocationLike = {
  hostname: string;
  port: string;
};

function sanitizeBaseUrl(value: string | undefined, location?: LocationLike): string {
  if (!value) {
    const currentLocation =
      location ?? (typeof window !== "undefined" ? window.location : undefined);

    if (currentLocation) {
      const host = currentLocation.hostname;
      const port = currentLocation.port;
      const isLocalDevHost = host === "localhost" || host === "127.0.0.1";
      const isKnownViteDevPort = port === "5173" || port === "5174";

      if (isLocalDevHost && isKnownViteDevPort) {
        return "http://localhost:4000";
      }
    }

    return "";
  }
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function sanitizeOrganization(value: string | undefined, source: GitHubSource): string {
  if (!value) {
    return source === "mock" ? DEFAULT_ORGANIZATION : "";
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return source === "mock" ? DEFAULT_ORGANIZATION : "";
  }

  if (!GITHUB_ORG_SLUG_PATTERN.test(trimmed)) {
    return source === "mock" ? DEFAULT_ORGANIZATION : "";
  }

  return trimmed;
}

function sanitizeSource(value: string | undefined): GitHubSource {
  if (value === "mock") {
    return "mock";
  }

  if (value === "live") {
    return "live";
  }

  return DEFAULT_SOURCE;
}

export const __testables = {
  sanitizeBaseUrl,
  sanitizeOrganization,
  sanitizeSource
};
