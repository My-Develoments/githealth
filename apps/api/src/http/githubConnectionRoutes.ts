import { Router, type Response } from "express";
import {
  createGitHubAppInstallationSession,
  fetchGitHubAppInstallation
} from "../infrastructure/github/appAuth.js";
import { getGitHubConfig } from "../infrastructure/github/config.js";
import {
  getGitHubConnectionStatus,
  type GitHubConnectionState
} from "../infrastructure/github/connectionStatus.js";
import { GitHubAdapterError } from "../infrastructure/github/errors.js";
import { getApiProtectionConfig, isAllowedGitHubOrganization } from "../infrastructure/security/apiProtectionConfig.js";
import { sendApiError } from "./errorEnvelope.js";
import { GITHUB_APP_SESSION_COOKIE } from "./requestContext.js";

export const githubConnectionRoutes = Router();

const INSTALLATION_SESSION_COOKIE_TTL_SECONDS = 60 * 60;

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

function sendCallbackFailure(
  res: Response,
  config: ReturnType<typeof getGitHubConfig>,
  status: number,
  code: string,
  message: string,
  connectionState: Extract<GitHubConnectionState, "error" | "unauthorized_installation" | "ready_to_connect">
): void {
  clearInstallationSessionCookie(res);

  if (config.authProvider === "app" && config.app?.onboardingRedirectUrl) {
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

function shouldUseSecureCookie(): boolean {
  return process.env.NODE_ENV === "production";
}

function buildSessionCookieValue(sessionToken: string, maxAgeSeconds = INSTALLATION_SESSION_COOKIE_TTL_SECONDS): string {
  const attributes = [
    `${GITHUB_APP_SESSION_COOKIE}=${encodeURIComponent(sessionToken)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`
  ];

  if (shouldUseSecureCookie()) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

function writeInstallationSessionCookie(res: Response, sessionToken: string): void {
  res.append("Set-Cookie", buildSessionCookieValue(sessionToken));
}

function clearInstallationSessionCookie(res: Response): void {
  const attributes = [
    `${GITHUB_APP_SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0"
  ];

  if (shouldUseSecureCookie()) {
    attributes.push("Secure");
  }

  res.append("Set-Cookie", attributes.join("; "));
}

githubConnectionRoutes.get("/status", async (req, res) => {
  try {
    const status = await getGitHubConnectionStatus();
    res.json(status);
  } catch (error) {
    if (error instanceof GitHubAdapterError && error.code === "AUTH_INVALID") {
      clearInstallationSessionCookie(res);
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

githubConnectionRoutes.get("/start", (req, res) => {
  const config = getGitHubConfig();
  if (config.authProvider !== "app") {
    sendApiError(res, {
      status: 409,
      code: "INVALID_REQUEST",
      message: "GitHub App mode is not enabled."
    });
    return;
  }

  if (!config.app?.installUrl || !config.app.onboardingRedirectUrl) {
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
    connectUrl: config.app.installUrl
  });
});

githubConnectionRoutes.get("/callback", async (req, res) => {
  const config = getGitHubConfig();
  if (config.authProvider !== "app") {
    sendApiError(res, {
      status: 409,
      code: "INVALID_REQUEST",
      message: "GitHub App mode is not enabled."
    });
    return;
  }

  const installationId = toPositiveInteger(req.query.installation_id);
  if (!installationId) {
    sendCallbackFailure(
      res,
      config,
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
      config,
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
      config,
      409,
      "INVALID_REQUEST",
      "GitHub App installation was not completed.",
      "ready_to_connect"
    );
    return;
  }

  try {
    const installation = await fetchGitHubAppInstallation(config, installationId);
    assertInstallationIsAllowed(installation.organization, installation.targetType);

    const sessionToken = createGitHubAppInstallationSession(config, installation);
    writeInstallationSessionCookie(res, sessionToken);
    const status = resolveCallbackStatus(true);
    const message = "GitHub App installation completed successfully. GitHealth can now authenticate with the installed app.";

    if (config.app?.onboardingRedirectUrl) {
      const redirectUrl = new URL(config.app.onboardingRedirectUrl);
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
        config,
        error.status,
        error.code,
        error.message,
        error.code === "PERMISSION_DENIED" || error.code === "AUTH_INVALID" || error.code === "NOT_FOUND"
          ? "unauthorized_installation"
          : "error"
      );
      return;
    }

    sendCallbackFailure(res, config, 500, "UPSTREAM_UNAVAILABLE", "GitHub App callback failed.", "error");
  }
});