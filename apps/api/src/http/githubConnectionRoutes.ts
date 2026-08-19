import { Router } from "express";
import { getGitHubConfig } from "../infrastructure/github/config.js";
import {
  getGitHubConnectionStatus,
  type GitHubConnectionState
} from "../infrastructure/github/connectionStatus.js";
import { sendApiError } from "./errorEnvelope.js";
import { githubEndpointAuth } from "./githubEndpointAuth.js";

export const githubConnectionRoutes = Router();

function runProtectedMiddleware(
  middleware: (req: Parameters<typeof githubEndpointAuth>[0], res: Parameters<typeof githubEndpointAuth>[1], next: Parameters<typeof githubEndpointAuth>[2]) => void,
  req: Parameters<typeof githubEndpointAuth>[0],
  res: Parameters<typeof githubEndpointAuth>[1]
): boolean {
  let proceeded = false;
  middleware(req, res, () => {
    proceeded = true;
  });

  return proceeded;
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
  return installationIdReceived ? "connected" : "ready_to_connect";
}

githubConnectionRoutes.get("/status", async (req, res) => {
  if (!runProtectedMiddleware(githubEndpointAuth, req, res)) {
    return;
  }

  const status = await getGitHubConnectionStatus();
  res.json(status);
});

githubConnectionRoutes.get("/start", (req, res) => {
  if (!runProtectedMiddleware(githubEndpointAuth, req, res)) {
    return;
  }

  const config = getGitHubConfig();
  if (config.authProvider !== "app") {
    sendApiError(res, {
      status: 409,
      code: "INVALID_REQUEST",
      message: "GitHub App mode is not enabled."
    });
    return;
  }

  if (!config.app?.installUrl) {
    sendApiError(res, {
      status: 503,
      code: "INVALID_RESPONSE",
      message: "GitHub App install URL is not configured."
    });
    return;
  }

  res.json({
    provider: "app",
    status: "ready_to_connect",
    connectUrl: config.app.installUrl
  });
});

githubConnectionRoutes.get("/callback", (req, res) => {
  const config = getGitHubConfig();
  if (config.authProvider !== "app") {
    sendApiError(res, {
      status: 409,
      code: "INVALID_REQUEST",
      message: "GitHub App mode is not enabled."
    });
    return;
  }

  const installationIdReceived = typeof toPositiveInteger(req.query.installation_id) === "number";
  const setupAction = typeof req.query.setup_action === "string" ? req.query.setup_action : undefined;
  const status = resolveCallbackStatus(installationIdReceived);
  const message = installationIdReceived
    ? "GitHub App installation callback received. Set GITHUB_APP_INSTALLATION_ID on the API deployment to complete server-side authentication."
    : "GitHub App callback received. Complete installation in GitHub, then set GITHUB_APP_INSTALLATION_ID on the API deployment.";

  if (config.app?.onboardingRedirectUrl) {
    const redirectUrl = new URL(config.app.onboardingRedirectUrl);
    redirectUrl.searchParams.set("github_app_status", status);
    redirectUrl.searchParams.set("github_app_callback", "received");
    if (setupAction) {
      redirectUrl.searchParams.set("github_app_setup_action", setupAction);
    }

    res.redirect(302, redirectUrl.toString());
    return;
  }

  res.json({
    provider: "app",
    status,
    installationIdReceived,
    setupAction,
    message
  });
});