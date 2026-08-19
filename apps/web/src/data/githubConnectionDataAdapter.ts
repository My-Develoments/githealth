import { requestJson } from "./githubHealthApiClient";
import { resolveGitHubHealthConfig } from "./githubHealthConfig";
import type { GitHubConnectionStartResponse, GitHubConnectionStatusResponse } from "./githubHealthContracts";

type ConnectionRequestOptions = {
  signal?: AbortSignal;
  installationSession?: string;
};

function buildConnectionHeaders(installationSession: string | undefined): Record<string, string> | undefined {
  if (!installationSession || installationSession.trim().length === 0) {
    return undefined;
  }

  return {
    "x-github-app-session": installationSession.trim()
  };
}

function buildConnectionEndpoint(apiBaseUrl: string, path: string): string {
  return new URL(`${apiBaseUrl}${path}`, window.location.origin).toString();
}

export function fetchGitHubConnectionStatus(options: ConnectionRequestOptions = {}): Promise<GitHubConnectionStatusResponse> {
  const config = resolveGitHubHealthConfig();
  return requestJson<GitHubConnectionStatusResponse>(buildConnectionEndpoint(config.apiBaseUrl, "/github/connection/status"), {
    signal: options.signal,
    headers: buildConnectionHeaders(options.installationSession)
  });
}

export function startGitHubConnection(signal?: AbortSignal): Promise<GitHubConnectionStartResponse> {
  const config = resolveGitHubHealthConfig();
  return requestJson<GitHubConnectionStartResponse>(buildConnectionEndpoint(config.apiBaseUrl, "/github/connection/start"), {
    signal
  });
}