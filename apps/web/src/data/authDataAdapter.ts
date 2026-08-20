import { requestJson } from "./githubHealthApiClient";
import { resolveGitHubHealthConfig } from "./githubHealthConfig";
import type { AuthSessionViewModel } from "./authContracts";
import type { GitHubConnectionStartResponse } from "./githubHealthContracts";

type CredentialsPayload = {
  email: string;
  password: string;
  displayName?: string;
};

function buildAuthEndpoint(path: string): string {
  const config = resolveGitHubHealthConfig();
  return new URL(`${config.apiBaseUrl}${path}`, window.location.origin).toString();
}

export function fetchCurrentAuthSession(signal?: AbortSignal): Promise<AuthSessionViewModel> {
  return requestJson<AuthSessionViewModel>(buildAuthEndpoint("/auth/session"), {
    signal
  });
}

export function signUpWithCredentials(payload: CredentialsPayload): Promise<AuthSessionViewModel> {
  return requestJson<AuthSessionViewModel>(buildAuthEndpoint("/auth/sign-up"), {
    method: "POST",
    body: payload
  });
}

export function signInWithCredentials(payload: Omit<CredentialsPayload, "displayName">): Promise<AuthSessionViewModel> {
  return requestJson<AuthSessionViewModel>(buildAuthEndpoint("/auth/sign-in"), {
    method: "POST",
    body: payload
  });
}

export function signOutCurrentSession(): Promise<{ ok: true }> {
  return requestJson<{ ok: true }>(buildAuthEndpoint("/auth/sign-out"), {
    method: "POST"
  });
}

export function startGitHubOAuthSession(signal?: AbortSignal): Promise<GitHubConnectionStartResponse> {
  return requestJson<GitHubConnectionStartResponse>(buildAuthEndpoint("/github/connection/start"), {
    signal
  });
}