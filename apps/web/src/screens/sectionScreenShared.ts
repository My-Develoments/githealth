import type { GitHubConnectionViewModel, GitHubHealthIntegrationState } from "../data/githubHealthContracts";

export type SectionDataState = "loading" | "ready" | "empty" | "error";

export function resolveSectionDataState(state: GitHubHealthIntegrationState): SectionDataState {
  if (state === "loading") {
    return "loading";
  }

  if (state === "error" || state === "failed") {
    return "error";
  }

  if (state === "empty") {
    return "empty";
  }

  return "ready";
}

export function resolveSectionConnectionTone(
  status: GitHubConnectionViewModel["status"]
): "healthy" | "warning" | "neutral" | "critical" | "unknown" {
  if (status === "connected") {
    return "healthy";
  }

  if (status === "ready_to_connect" || status === "connecting" || status === "installation_completed") {
    return "neutral";
  }

  if (status === "error" || status === "unauthorized_installation") {
    return "critical";
  }

  if (status === "not_configured") {
    return "warning";
  }

  return "unknown";
}

export function resolveSectionConnectionLabel(connection: GitHubConnectionViewModel): string {
  if (connection.status === "connected") {
    return "Connected";
  }

  if (connection.status === "ready_to_connect") {
    return "Ready to connect";
  }

  if (connection.status === "connecting") {
    return "Connecting";
  }

  if (connection.status === "installation_completed") {
    return "Installation completed";
  }

  if (connection.status === "unauthorized_installation") {
    return "Unauthorized installation";
  }

  if (connection.status === "not_configured") {
    return "Not configured";
  }

  return "Connection error";
}

export function resolveSectionProviderLabel(connection: GitHubConnectionViewModel): string {
  if (connection.provider === "oauth") {
    return "GitHub OAuth";
  }

  if (connection.provider === "app") {
    return "GitHub App";
  }

  return "Development fallback";
}

export function resolveSectionConnectActionLabel(connection: GitHubConnectionViewModel): "Connect GitHub" | "Reconnect GitHub" {
  if (connection.status === "ready_to_connect") {
    return "Connect GitHub";
  }

  return "Reconnect GitHub";
}

export function shouldShowSectionConnectAction(connection: GitHubConnectionViewModel): boolean {
  return connection.provider !== "pat" && !connection.isConnected;
}

export function isSectionConnectActionDisabled(connection: GitHubConnectionViewModel): boolean {
  return connection.status === "connecting" || connection.status === "installation_completed" || !connection.canConnect;
}

export function scoreTone(score: number): "healthy" | "warning" | "critical" | "unknown" {
  if (score >= 85) {
    return "healthy";
  }

  if (score >= 70) {
    return "warning";
  }

  if (score > 0) {
    return "critical";
  }

  return "unknown";
}