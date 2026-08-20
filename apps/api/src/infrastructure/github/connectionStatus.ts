import { getAuthStore } from "../auth/authStore.js";
import { getCurrentGitHubAppInstallationSession, resolveGitHubAccessToken } from "./appAuth.js";
import { getGitHubAppRuntimeConfig, getGitHubConfig, type GitHubAuthProvider } from "./config.js";
import { GitHubAdapterError } from "./errors.js";
import { getAuthenticatedAppContextFromRequestStore, getAuthenticatedWorkspaceId } from "../../http/requestContext.js";
import { getApiProtectionConfig } from "../security/apiProtectionConfig.js";
import { validateGitHubLiveAccessForOrganization } from "./liveAccessValidation.js";
import { resolveAllowlistedOrganizationForOAuthToken } from "./oauthAuth.js";

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
  organizationOptions?: string[];
  githubLogin?: string;
  errorCode?: string;
  upstreamStatus?: number;
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
  let appRuntimeConfig: ReturnType<typeof getGitHubAppRuntimeConfig>;
  const authStore = getAuthStore();
  await authStore.initialize();
  const workspaceId = getAuthenticatedWorkspaceId();
  const workspaceConnection = workspaceId
    ? await authStore.findWorkspaceGitHubConnection(workspaceId)
    : undefined;

  try {
    config = getGitHubConfig();
    appRuntimeConfig = getGitHubAppRuntimeConfig();
  } catch (error) {
    if (error instanceof GitHubAdapterError && (configuredAuthProvider() === "app" || appRuntimeConfig?.app)) {
      return buildNotConfiguredAppStatus("GitHub App onboarding is not configured for this environment.");
    }

    throw error;
  }

  if (workspaceConnection && appRuntimeConfig?.app) {
    try {
      await resolveGitHubAccessToken(appRuntimeConfig);

      return {
        provider: "app",
        status: "connected",
        isConnected: true,
        canConnect: true,
        hasInstallationId: true,
        installUrlConfigured: typeof appRuntimeConfig.app.installUrl === "string",
        callbackRedirectConfigured: typeof appRuntimeConfig.app.onboardingRedirectUrl === "string",
        message: "GitHub App installation is connected for this workspace.",
        organization: workspaceConnection.organization
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
          canConnect: true,
          hasInstallationId: true,
          installUrlConfigured: typeof appRuntimeConfig.app.installUrl === "string",
          callbackRedirectConfigured: typeof appRuntimeConfig.app.onboardingRedirectUrl === "string",
          message: error.message,
          organization: workspaceConnection.organization
        };
      }

      throw error;
    }
  }

  if (config.authProvider !== "oauth" && appRuntimeConfig?.app) {
    const requestSession = getCurrentGitHubAppInstallationSession(appRuntimeConfig);
    const hasInstallationId =
      typeof appRuntimeConfig.app.installationId === "number" || typeof requestSession?.installationId === "number";
    const installUrlConfigured = typeof appRuntimeConfig.app.installUrl === "string";
    const callbackRedirectConfigured = typeof appRuntimeConfig.app.onboardingRedirectUrl === "string";

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
      await resolveGitHubAccessToken(appRuntimeConfig);

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

  if (config.authProvider === "oauth") {
    const authenticatedApp = getAuthenticatedAppContextFromRequestStore();
    if (!workspaceId || !authenticatedApp) {
      return {
        provider: "oauth",
        status: "not_configured",
        isConnected: false,
        canConnect: false,
        hasInstallationId: false,
        installUrlConfigured: false,
        callbackRedirectConfigured: false,
        message: "Authentication is required before starting GitHub OAuth connection."
      };
    }

    const oauthConnection = await authStore.findWorkspaceGitHubOAuthConnection(
      workspaceId,
      authenticatedApp.user.id
    );

    if (!oauthConnection) {
      return {
        provider: "oauth",
        status: "ready_to_connect",
        isConnected: false,
        canConnect: true,
        hasInstallationId: false,
        installUrlConfigured: false,
        callbackRedirectConfigured: true,
        message: "GitHub OAuth is configured and ready to connect."
      };
    }

    let selectedOrganization = oauthConnection.selectedOrganization;
    let organizationOptions = oauthConnection.organizationOptions ?? [];

    if (!selectedOrganization || organizationOptions.length === 0) {
      try {
        const accessToken = await resolveGitHubAccessToken(config);
        const resolvedOrganization = await resolveAllowlistedOrganizationForOAuthToken(config, accessToken);
        if (resolvedOrganization && !selectedOrganization) {
          selectedOrganization = resolvedOrganization;
        }

        if (organizationOptions.length === 0 && resolvedOrganization) {
          organizationOptions = [resolvedOrganization];
        }

        if (selectedOrganization || organizationOptions.length > 0) {
          await authStore.upsertWorkspaceGitHubOAuthConnection({
            ...oauthConnection,
            selectedOrganization,
            organizationOptions,
            updatedAt: new Date().toISOString()
          });
        }
      } catch {
        // Keep connected state even when org discovery is unavailable.
      }
    }

    return {
      provider: "oauth",
      status: "connected",
      isConnected: true,
      canConnect: true,
      hasInstallationId: false,
      installUrlConfigured: false,
      callbackRedirectConfigured: true,
      message: "GitHub OAuth is connected for this workspace.",
      organization: selectedOrganization,
      organizationOptions,
      githubLogin: oauthConnection.githubLogin
    };
  }

  if (config.authProvider === "pat") {
    const protectionConfig = getApiProtectionConfig();
    const preferredOrganization = protectionConfig.allowedGitHubOrgs[0];

    if (config.token && preferredOrganization) {
      try {
        await validateGitHubLiveAccessForOrganization(preferredOrganization);

        return {
          provider: "pat",
          status: "connected",
          isConnected: true,
          canConnect: false,
          hasInstallationId: false,
          installUrlConfigured: false,
          callbackRedirectConfigured: false,
          message: "Server-side GitHub PAT authentication is configured and organization access is verified.",
          organization: preferredOrganization
        };
      } catch (error) {
        if (error instanceof GitHubAdapterError) {
          const status =
            error.code === "AUTH_MISSING" ||
            error.code === "AUTH_INVALID" ||
            error.code === "PERMISSION_DENIED" ||
            error.code === "NOT_FOUND"
              ? "not_configured"
              : "error";

          return {
            provider: "pat",
            status,
            isConnected: false,
            canConnect: false,
            hasInstallationId: false,
            installUrlConfigured: false,
            callbackRedirectConfigured: false,
            message: error.message,
            organization: preferredOrganization,
            errorCode: error.code,
            upstreamStatus: error.upstreamStatus
          };
        }

        throw error;
      }
    }

    if (config.token && !preferredOrganization) {
      return {
        provider: "pat",
        status: "not_configured",
        isConnected: false,
        canConnect: false,
        hasInstallationId: false,
        installUrlConfigured: false,
        callbackRedirectConfigured: false,
        message: "Server-side GITHUB_TOKEN is configured, but ALLOWED_GITHUB_ORGS is empty."
      };
    }

    return {
      provider: "pat",
      status: "not_configured",
      isConnected: false,
      canConnect: false,
      hasInstallationId: false,
      installUrlConfigured: false,
      callbackRedirectConfigured: false,
      message: "Server-side GITHUB_TOKEN is not configured."
    };
  }

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