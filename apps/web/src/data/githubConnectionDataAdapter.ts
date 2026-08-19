import { requestJson } from "./githubHealthApiClient";
import { resolveGitHubHealthConfig } from "./githubHealthConfig";
import type { GitHubConnectionStartResponse, GitHubConnectionStatusResponse } from "./githubHealthContracts";

function buildConnectionEndpoint(apiBaseUrl: string, path: string): string {
  return new URL(`${apiBaseUrl}${path}`, window.location.origin).toString();
}

export function fetchGitHubConnectionStatus(signal?: AbortSignal): Promise<GitHubConnectionStatusResponse> {
  const config = resolveGitHubHealthConfig();
  return requestJson<GitHubConnectionStatusResponse>(buildConnectionEndpoint(config.apiBaseUrl, "/github/connection/status"), {
    signal
  });
}

export function startGitHubConnection(signal?: AbortSignal): Promise<GitHubConnectionStartResponse> {
  const config = resolveGitHubHealthConfig();
  return requestJson<GitHubConnectionStartResponse>(buildConnectionEndpoint(config.apiBaseUrl, "/github/connection/start"), {
    signal
  });
}