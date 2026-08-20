import { requestJson } from "./githubHealthApiClient";
import { resolveGitHubHealthConfig } from "./githubHealthConfig";
import type {
  GitHubConnectionOrganizationOptionsResponse,
  GitHubConnectionStartResponse,
  GitHubConnectionStatusResponse
} from "./githubHealthContracts";

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

export function disconnectGitHubConnection(signal?: AbortSignal): Promise<{ ok: boolean }> {
  const config = resolveGitHubHealthConfig();
  return requestJson<{ ok: boolean }>(buildConnectionEndpoint(config.apiBaseUrl, "/github/connection/disconnect"), {
    method: "DELETE",
    signal
  });
}

export function fetchGitHubConnectionOrganizations(
  options: ConnectionRequestOptions = {}
): Promise<GitHubConnectionOrganizationOptionsResponse> {
  const config = resolveGitHubHealthConfig();
  return requestJson<GitHubConnectionOrganizationOptionsResponse>(
    buildConnectionEndpoint(config.apiBaseUrl, "/github/connection/organizations"),
    {
      signal: options.signal,
      headers: buildConnectionHeaders(options.installationSession)
    }
  );
}

export function selectGitHubConnectionOrganization(
  organization: string,
  signal?: AbortSignal
): Promise<GitHubConnectionOrganizationOptionsResponse> {
  const config = resolveGitHubHealthConfig();
  return requestJson<GitHubConnectionOrganizationOptionsResponse>(
    buildConnectionEndpoint(config.apiBaseUrl, "/github/connection/organizations/select"),
    {
      method: "POST",
      signal,
      body: {
        organization
      }
    }
  );
}