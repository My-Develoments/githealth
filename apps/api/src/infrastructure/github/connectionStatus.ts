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
  organization?: string;
};

function configuredAuthProvider(): GitHubAuthProvider {
  return process.env.GITHUB_AUTH_PROVIDER?.trim().toLowerCase() === "app" ? "app" : "pat";
}

function buildNotConfiguredAppStatus(message: string): GitHubConnectionStatusResponse {
  return {
    provider: "app",
    status: "not_configured",
    isConnected: false,
    canConnect: false,
    hasInstallationId: false,
    installUrlConfigured: false,
    callbackRedirectConfigured: false,
    message
  };
}

export async function getGitHubConnectionStatus(): Promise<GitHubConnectionStatusResponse> {
  let config;

  try {
    config = getGitHubConfig();
  } catch (error) {
    if (error instanceof GitHubAdapterError && configuredAuthProvider() === "app") {
      return buildNotConfiguredAppStatus("GitHub App onboarding is not configured for this environment.");
    }

    throw error;
  }

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
    const onboardingReady = installUrlConfigured && callbackRedirectConfigured;

    return {
      provider: "app",
      status: onboardingReady ? "ready_to_connect" : "not_configured",
      isConnected: false,
      canConnect: onboardingReady,
      hasInstallationId,
      installUrlConfigured,
      callbackRedirectConfigured,
      message: !installUrlConfigured
        ? "GitHub App onboarding is unavailable because the install URL is not configured."
        : !callbackRedirectConfigured
          ? "GitHub App onboarding is unavailable because the application return URL is not configured."
          : "GitHub App is configured and ready to connect."
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
      message: "GitHub App installation is connected.",
      organization: requestSession?.organization
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
        message: error.message,
        organization: requestSession?.organization
      };
    }

    throw error;
  }
}