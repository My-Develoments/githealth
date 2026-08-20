import { Router, type Response } from "express";
import { signInOrCreateUserFromGitHubIdentity } from "../application/authService.js";
import { getAuthStore } from "../infrastructure/auth/authStore.js";
import { fetchGitHubAppInstallation } from "../infrastructure/github/appAuth.js";
import { getGitHubAppRuntimeConfig, getGitHubConfig } from "../infrastructure/github/config.js";
import {
  getGitHubConnectionStatus,
  type GitHubConnectionState
} from "../infrastructure/github/connectionStatus.js";
import { GitHubAdapterError } from "../infrastructure/github/errors.js";
import { completeGitHubOAuthCallback, startGitHubOAuthFlow } from "../infrastructure/github/oauthAuth.js";
import { getApiProtectionConfig, isAllowedGitHubOrganization } from "../infrastructure/security/apiProtectionConfig.js";
import { resolveAuthenticatedAppFromRequest, setAuthSessionCookie } from "./authSession.js";
import { sendApiError } from "./errorEnvelope.js";

export const githubConnectionRoutes = Router();

function buildOAuthFrontendRedirectUrl(config: ReturnType<typeof getGitHubConfig>): URL {
  const redirectUrl = new URL(config.oauth!.frontendRedirectUrl);
  const callbackUrl = new URL(config.oauth!.redirectUri);

  // Keep frontend and callback on the same host to ensure session cookies survive OAuth redirect.
  redirectUrl.hostname = callbackUrl.hostname;
  redirectUrl.pathname = "/command-center";

  return redirectUrl;
}

function toPositiveInteger(value: unknown): number | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function resolveCallbackStatus(installationIdReceived: boolean): GitHubConnectionState {
  return installationIdReceived ? "installation_completed" : "ready_to_connect";
}

function resolveSetupAction(value: unknown): "install" | "request" | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  if (value === "install" || value === "request") {
    return value;
  }

  return undefined;
}

function resolveOrganizationSlug(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(trimmed)) {
    return undefined;
  }

  return trimmed;
}

function sendCallbackFailure(
  res: Response,
  config: NonNullable<ReturnType<typeof getGitHubAppRuntimeConfig>>,
  status: number,
  code: string,
  message: string,
  connectionState: Extract<GitHubConnectionState, "error" | "unauthorized_installation" | "ready_to_connect">
): void {
  if (config.app?.onboardingRedirectUrl) {
    const redirectUrl = new URL(config.app.onboardingRedirectUrl);
    redirectUrl.searchParams.set("github_app_callback", "received");
    redirectUrl.searchParams.set("github_app_status", connectionState);
    redirectUrl.searchParams.set("github_app_error_code", code);
    redirectUrl.searchParams.set("github_app_message", message);
    res.redirect(302, redirectUrl.toString());
    return;
  }

  sendApiError(res, {
    status,
    code,
    message
  });
}

function assertInstallationIsAllowed(organization: string, targetType: string): void {
  if (targetType.toLowerCase() !== "organization") {
    throw new GitHubAdapterError("PERMISSION_DENIED", "GitHub App installation must target an allowed organization.", 403);
  }

  const protectionConfig = getApiProtectionConfig();
  if (protectionConfig.allowedGitHubOrgSet.size === 0) {
    throw new GitHubAdapterError(
      "PERMISSION_DENIED",
      "GitHub App installation cannot be completed because ALLOWED_GITHUB_ORGS is not configured.",
      403
    );
  }

  if (!isAllowedGitHubOrganization(organization, protectionConfig.allowedGitHubOrgSet)) {
    throw new GitHubAdapterError(
      "PERMISSION_DENIED",
      "GitHub App installation organization is not authorized for GitHealth.",
      403
    );
  }
}

githubConnectionRoutes.get("/status", async (req, res) => {
  try {
    const status = await getGitHubConnectionStatus();
    res.json(status);
  } catch (error) {
    if (error instanceof GitHubAdapterError && error.code === "AUTH_INVALID") {
      res.json({
        provider: "app",
        status: "unauthorized_installation",
        isConnected: false,
        canConnect: true,
        hasInstallationId: false,
        installUrlConfigured: true,
        callbackRedirectConfigured: true,
        message: error.message
      });
      return;
    }

    throw error;
  }
});

githubConnectionRoutes.get("/start", async (req, res) => {
  const config = getGitHubConfig();

  if (config.authProvider === "oauth") {
    const startResult = await startGitHubOAuthFlow(config);
    res.json({
      provider: "oauth",
      status: "ready_to_connect",
      connectUrl: startResult.connectUrl
    });
    return;
  }

  const authenticatedApp = await resolveAuthenticatedAppFromRequest(req);

  if (!authenticatedApp) {
    sendApiError(res, {
      status: 401,
      code: "AUTH_MISSING",
      message: "Authentication session is required to start GitHub connection."
    });
    return;
  }

  const appConfig = getGitHubAppRuntimeConfig();
  if (!appConfig?.app) {
    sendApiError(res, {
      status: 409,
      code: "INVALID_REQUEST",
      message: "GitHub App mode is not configured."
    });
    return;
  }

  if (!appConfig.app.installUrl || !appConfig.app.onboardingRedirectUrl) {
    sendApiError(res, {
      status: 503,
      code: "INVALID_RESPONSE",
      message: "GitHub App onboarding is not fully configured."
    });
    return;
  }

  res.json({
    provider: "app",
    status: "ready_to_connect",
    connectUrl: appConfig.app.installUrl
  });
});

githubConnectionRoutes.delete("/disconnect", async (req, res) => {
  const config = getGitHubConfig();
  const authenticatedApp = await resolveAuthenticatedAppFromRequest(req);
  if (!authenticatedApp) {
    sendApiError(res, {
      status: 401,
      code: "AUTH_MISSING",
      message: "Authentication session is required to disconnect GitHub connection."
    });
    return;
  }

  const authStore = getAuthStore();
  await authStore.initialize();
  if (config.authProvider === "oauth") {
    await authStore.deleteWorkspaceGitHubOAuthConnection(authenticatedApp.workspace.id, authenticatedApp.user.id);
  } else {
    await authStore.deleteWorkspaceGitHubConnection(authenticatedApp.workspace.id);
  }

  res.status(200).json({
    ok: true,
    workspaceId: authenticatedApp.workspace.id
  });
});

githubConnectionRoutes.get("/callback", async (req, res) => {
  const config = getGitHubConfig();

  if (config.authProvider === "oauth") {
    const state = typeof req.query.state === "string" ? req.query.state.trim() : "";
    const code = typeof req.query.code === "string" ? req.query.code.trim() : "";

    if (!state) {
      sendApiError(res, {
        status: 400,
        code: "INVALID_REQUEST",
        message: "Missing or invalid state query parameter."
      });
      return;
    }

    if (!code) {
      sendApiError(res, {
        status: 400,
        code: "INVALID_REQUEST",
        message: "Missing or invalid code query parameter."
      });
      return;
    }

    try {
      const result = await completeGitHubOAuthCallback(config, state, code);
      const authResult = await signInOrCreateUserFromGitHubIdentity({
        githubUserId: result.githubUserId,
        githubLogin: result.githubLogin
      });

      const authStore = getAuthStore();
      await authStore.initialize();
      const now = new Date().toISOString();
      await authStore.upsertWorkspaceGitHubOAuthConnection({
        workspaceId: authResult.authenticatedApp.workspace.id,
        userId: authResult.authenticatedApp.user.id,
        githubUserId: result.githubUserId,
        githubLogin: result.githubLogin,
        accessTokenCiphertext: result.accessTokenCiphertext,
        accessTokenIv: result.accessTokenIv,
        accessTokenTag: result.accessTokenTag,
        scopes: result.scopes,
        selectedOrganization: result.selectedOrganization,
        organizationOptions: result.organizationOptions,
        connectedAt: now,
        updatedAt: now
      });

      setAuthSessionCookie(res, authResult.sessionToken);

      const redirectUrl = buildOAuthFrontendRedirectUrl(config);
      redirectUrl.searchParams.set("github_oauth_callback", "received");
      redirectUrl.searchParams.set("github_oauth_status", "connected");
      redirectUrl.searchParams.set("github_oauth_login", result.githubLogin);

      res.redirect(302, redirectUrl.toString());
      return;
    } catch (error) {
      if (error instanceof GitHubAdapterError) {
        sendApiError(res, {
          status: error.status,
          code: error.code,
          message: error.message,
          upstreamStatus: error.upstreamStatus
        });
        return;
      }

      sendApiError(res, {
        status: 500,
        code: "UPSTREAM_UNAVAILABLE",
        message: "GitHub OAuth callback failed."
      });
      return;
    }
  }

  const appConfig = getGitHubAppRuntimeConfig();
  if (!appConfig?.app) {
    sendApiError(res, {
      status: 409,
      code: "INVALID_REQUEST",
      message: "GitHub App mode is not configured."
    });
    return;
  }

  const installationId = toPositiveInteger(req.query.installation_id);
  if (!installationId) {
    sendCallbackFailure(
      res,
      appConfig,
      400,
      "INVALID_REQUEST",
      "Missing or invalid installation_id query parameter.",
      "error"
    );
    return;
  }

  const setupAction = resolveSetupAction(req.query.setup_action);
  if (!setupAction) {
    sendCallbackFailure(
      res,
      appConfig,
      400,
      "INVALID_REQUEST",
      "Missing or invalid setup_action query parameter.",
      "error"
    );
    return;
  }

  if (setupAction !== "install") {
    sendCallbackFailure(
      res,
      appConfig,
      409,
      "INVALID_REQUEST",
      "GitHub App installation was not completed.",
      "ready_to_connect"
    );
    return;
  }

  try {
    const authenticatedApp = await resolveAuthenticatedAppFromRequest(req);
    if (!authenticatedApp) {
      sendCallbackFailure(
        res,
        appConfig,
        401,
        "AUTH_MISSING",
        "Authentication session is required to finish GitHub connection.",
        "error"
      );
      return;
    }

    const installation = await fetchGitHubAppInstallation(appConfig, installationId);
    assertInstallationIsAllowed(installation.organization, installation.targetType);

    const authStore = getAuthStore();
    await authStore.initialize();
    const now = new Date().toISOString();
    await authStore.upsertWorkspaceGitHubConnection({
      workspaceId: authenticatedApp.workspace.id,
      provider: "app",
      organization: installation.organization,
      installationId: installation.installationId,
      connectedAt: now,
      updatedAt: now
    });

    const status = resolveCallbackStatus(true);
    const message = "GitHub App installation completed successfully. GitHealth can now authenticate with the installed app.";

    if (appConfig.app?.onboardingRedirectUrl) {
      const redirectUrl = new URL(appConfig.app.onboardingRedirectUrl);
      redirectUrl.searchParams.set("github_app_status", status);
      redirectUrl.searchParams.set("github_app_callback", "received");
      redirectUrl.searchParams.set("github_app_setup_action", setupAction);
      redirectUrl.searchParams.set("github_app_message", message);

      res.redirect(302, redirectUrl.toString());
      return;
    }

    res.json({
      provider: "app",
      status,
      setupAction,
      message,
      organization: installation.organization
    });
  } catch (error) {
    if (error instanceof GitHubAdapterError) {
      sendCallbackFailure(
        res,
        appConfig,
        error.status,
        error.code,
        error.message,
        error.code === "PERMISSION_DENIED" || error.code === "AUTH_INVALID" || error.code === "NOT_FOUND"
          ? "unauthorized_installation"
          : "error"
      );
      return;
    }

    sendCallbackFailure(res, appConfig, 500, "UPSTREAM_UNAVAILABLE", "GitHub App callback failed.", "error");
  }
});

githubConnectionRoutes.get("/organizations", async (req, res) => {
  const config = getGitHubConfig();
  if (config.authProvider !== "oauth") {
    sendApiError(res, {
      status: 409,
      code: "INVALID_REQUEST",
      message: "Organization selection is only available for GitHub OAuth mode."
    });
    return;
  }

  const authenticatedApp = await resolveAuthenticatedAppFromRequest(req);
  if (!authenticatedApp) {
    sendApiError(res, {
      status: 401,
      code: "AUTH_MISSING",
      message: "Authentication session is required to inspect GitHub organizations."
    });
    return;
  }

  const authStore = getAuthStore();
  await authStore.initialize();
  const oauthConnection = await authStore.findWorkspaceGitHubOAuthConnection(
    authenticatedApp.workspace.id,
    authenticatedApp.user.id
  );

  if (!oauthConnection) {
    sendApiError(res, {
      status: 404,
      code: "NOT_FOUND",
      message: "GitHub OAuth connection is not configured for this workspace user."
    });
    return;
  }

  res.json({
    selectedOrganization: oauthConnection.selectedOrganization,
    organizations: oauthConnection.organizationOptions ?? []
  });
});

githubConnectionRoutes.post("/organizations/select", async (req, res) => {
  const config = getGitHubConfig();
  if (config.authProvider !== "oauth") {
    sendApiError(res, {
      status: 409,
      code: "INVALID_REQUEST",
      message: "Organization selection is only available for GitHub OAuth mode."
    });
    return;
  }

  const authenticatedApp = await resolveAuthenticatedAppFromRequest(req);
  if (!authenticatedApp) {
    sendApiError(res, {
      status: 401,
      code: "AUTH_MISSING",
      message: "Authentication session is required to select a GitHub organization."
    });
    return;
  }

  const selectedOrganization = resolveOrganizationSlug((req.body as { organization?: unknown } | undefined)?.organization);
  if (!selectedOrganization) {
    sendApiError(res, {
      status: 400,
      code: "INVALID_REQUEST",
      message: "Missing or invalid organization in request body."
    });
    return;
  }

  const authStore = getAuthStore();
  await authStore.initialize();
  const oauthConnection = await authStore.findWorkspaceGitHubOAuthConnection(
    authenticatedApp.workspace.id,
    authenticatedApp.user.id
  );

  if (!oauthConnection) {
    sendApiError(res, {
      status: 404,
      code: "NOT_FOUND",
      message: "GitHub OAuth connection is not configured for this workspace user."
    });
    return;
  }

  const options = oauthConnection.organizationOptions ?? [];
  const isAllowedSelection = options.some((organization) => organization.toLowerCase() === selectedOrganization.toLowerCase());
  if (!isAllowedSelection) {
    sendApiError(res, {
      status: 403,
      code: "PERMISSION_DENIED",
      message: `Organization '${selectedOrganization}' is not available for this GitHub OAuth connection.`
    });
    return;
  }

  const resolvedSelection = options.find((organization) => organization.toLowerCase() === selectedOrganization.toLowerCase()) ?? selectedOrganization;

  await authStore.upsertWorkspaceGitHubOAuthConnection({
    ...oauthConnection,
    selectedOrganization: resolvedSelection,
    updatedAt: new Date().toISOString()
  });

  res.status(200).json({
    selectedOrganization: resolvedSelection,
    organizations: options
  });
});