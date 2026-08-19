import { getCurrentGitHubAppInstallationSession, resolveGitHubAccessToken } from "./appAuth.js";
import { getGitHubConfig, type GitHubAuthProvider } from "./config.js";
import { GitHubAdapterError } from "./errors.js";

export type GitHubConnectionState =
  | "not_configured"
  | "ready_to_connect"
  | "installation_completed"
  | "connected"
  | "unauthorized_installation"
  | "error";

export type GitHubConnectionStatusResponse = {
  provider: GitHubAuthProvider;
  status: GitHubConnectionState;
  isConnected: boolean;
  canConnect: boolean;
  hasInstallationId: boolean;
  installUrlConfigured: boolean;
  callbackRedirectConfigured: boolean;
  message: string;
};

export async function getGitHubConnectionStatus(): Promise<GitHubConnectionStatusResponse> {
  const config = getGitHubConfig();

  if (config.authProvider === "pat") {
    return {
      provider: "pat",
      status: config.token ? "connected" : "not_configured",
      isConnected: Boolean(config.token),
      canConnect: false,
      hasInstallationId: false,
      installUrlConfigured: false,
      callbackRedirectConfigured: false,
      message: config.token
        ? "Server-side GitHub PAT authentication is configured."
        : "Server-side GITHUB_TOKEN is not configured."
    };
  }

  const appConfig = config.app;
  if (!appConfig) {
    return {
      provider: "app",
      status: "error",
      isConnected: false,
      canConnect: false,
      hasInstallationId: false,
      installUrlConfigured: false,
      callbackRedirectConfigured: false,
      message: "GitHub App configuration is unavailable."
    };
  }

  const requestSession = getCurrentGitHubAppInstallationSession(config);
  const hasInstallationId = typeof appConfig.installationId === "number" || typeof requestSession?.installationId === "number";
  const installUrlConfigured = typeof appConfig.installUrl === "string";
  const callbackRedirectConfigured = typeof appConfig.onboardingRedirectUrl === "string";

  if (!hasInstallationId) {
    return {
      provider: "app",
      status: installUrlConfigured ? "ready_to_connect" : "not_configured",
      isConnected: false,
      canConnect: installUrlConfigured,
      hasInstallationId,
      installUrlConfigured,
      callbackRedirectConfigured,
      message: installUrlConfigured
        ? "GitHub App is configured and ready to connect."
        : "GitHub App onboarding is unavailable because GITHUB_APP_INSTALL_URL is not configured."
    };
  }

  try {
    await resolveGitHubAccessToken(config);

    return {
      provider: "app",
      status: "connected",
      isConnected: true,
      canConnect: installUrlConfigured,
      hasInstallationId,
      installUrlConfigured,
      callbackRedirectConfigured,
      message: "GitHub App installation is connected."
    };
  } catch (error) {
    if (error instanceof GitHubAdapterError) {
      const state =
        error.code === "AUTH_INVALID" || error.code === "PERMISSION_DENIED" || error.code === "NOT_FOUND"
          ? "unauthorized_installation"
          : "error";

      return {
        provider: "app",
        status: state,
        isConnected: false,
        canConnect: installUrlConfigured,
        hasInstallationId,
        installUrlConfigured,
        callbackRedirectConfigured,
        message: error.message
      };
    }

    throw error;
  }
}