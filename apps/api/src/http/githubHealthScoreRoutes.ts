import { Router, type Response } from "express";
import { getAuthStore } from "../infrastructure/auth/authStore.js";
import {
  getGitHubOrganizationScore,
  getGitHubRepositoryScoreById,
  getGitHubRepositoryScores
} from "../application/githubScoringService.js";
import { getCurrentGitHubAppInstallationSession } from "../infrastructure/github/appAuth.js";
import { getGitHubAppRuntimeConfig } from "../infrastructure/github/config.js";
import { GitHubAdapterError } from "../infrastructure/github/errors.js";
import type { GitHubSource } from "../application/githubNormalizedModels.js";
import { sendApiError } from "./errorEnvelope.js";
import { githubEndpointAuth, resolveGitHubEndpointAuthFailure } from "./githubEndpointAuth.js";
import { authorizeGitHubOrganizationForSource } from "./githubEndpointOrgAuthorization.js";
import { githubEndpointRateLimit } from "./githubEndpointRateLimit.js";
import { getAuthenticatedAppContextFromRequestStore, getAuthenticatedWorkspaceId } from "./requestContext.js";
import { getApiProtectionConfig } from "../infrastructure/security/apiProtectionConfig.js";

export const githubHealthScoreRoutes = Router();

const GITHUB_ORG_SLUG_PATTERN = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;

function resolveOrgQuery(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    const org = value.trim();
    if (!GITHUB_ORG_SLUG_PATTERN.test(org)) {
      return null;
    }

    return org;
  }

  return null;
}

function resolveSourceQuery(value: unknown): GitHubSource | null | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  if (value === "mock" || value === "live") {
    return value;
  }

  return null;
}

function handleIntegrationError(error: unknown, res: Response, organization: string) {
  if (error instanceof GitHubAdapterError) {
    sendApiError(res, {
      status: error.status,
      code: error.code,
      message: error.message,
      upstreamStatus: error.upstreamStatus,
      organization: error.organization ?? organization
    });
    return;
  }

  sendApiError(res, {
    status: 500,
    code: "INTERNAL_ERROR",
    message: "Failed to collect GitHub organization data due to an internal error.",
    organization
  });
}

function runMiddleware(
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

async function enforceLiveRequestProtection(
  req: Parameters<typeof githubEndpointAuth>[0],
  res: Parameters<typeof githubEndpointAuth>[1],
  organization: string,
  source: GitHubSource | undefined
): Promise<boolean> {
  if (source === "mock") {
    return true;
  }

  if (!runMiddleware(githubEndpointRateLimit, req, res)) {
    return false;
  }

  const authFailure = await resolveGitHubEndpointAuthFailure(req);
  if (authFailure) {
    sendApiError(res, {
      ...authFailure,
      organization
    });
    return false;
  }

  if (!authorizeGitHubOrganizationForSource(organization, source, res)) {
    return false;
  }

  try {
    const authStore = getAuthStore();
    await authStore.initialize();
    const workspaceId = getAuthenticatedWorkspaceId();
    const workspaceConnection = workspaceId
      ? await authStore.findWorkspaceGitHubConnection(workspaceId)
      : undefined;
    const authenticatedApp = getAuthenticatedAppContextFromRequestStore();
    const oauthConnection = workspaceId && authenticatedApp
      ? await authStore.findWorkspaceGitHubOAuthConnection(workspaceId, authenticatedApp.user.id)
      : undefined;

    const appRuntimeConfig = getGitHubAppRuntimeConfig();
    const installationSession =
      workspaceConnection || typeof appRuntimeConfig?.app?.installationId === "number"
        ? undefined
        : appRuntimeConfig
          ? getCurrentGitHubAppInstallationSession(appRuntimeConfig)
          : undefined;
    if (
      workspaceConnection &&
      workspaceConnection.organization.trim().toLowerCase() !== organization.trim().toLowerCase()
    ) {
      console.warn(
        JSON.stringify({
          event: "github_workspace_org_mismatch",
          requestedOrganization: organization,
          connectedOrganization: workspaceConnection.organization,
          workspaceId,
          reason: "workspace_connection_not_authorized_for_requested_org"
        })
      );

      sendApiError(res, {
        status: 403,
        code: "PERMISSION_DENIED",
        message: "Workspace GitHub connection is not authorized for the requested organization.",
        organization
      });
      return false;
    }

    if (
      installationSession &&
      installationSession.organization.trim().toLowerCase() !== organization.trim().toLowerCase()
    ) {
      console.warn(
        JSON.stringify({
          event: "github_installation_org_mismatch",
          requestedOrganization: organization,
          connectedOrganization: installationSession.organization,
          reason: "installation_not_authorized_for_requested_org"
        })
      );

      sendApiError(res, {
        status: 403,
        code: "PERMISSION_DENIED",
        message: "GitHub App installation is not authorized for the requested organization.",
        organization
      });
      return false;
    }

    if (oauthConnection) {
      const selectedOrganization = oauthConnection.selectedOrganization;
      const accessibleOrganizations = oauthConnection.organizationOptions ?? [];
      const requestedOrganization = organization.trim();
      const requestedOrganizationLower = requestedOrganization.toLowerCase();
      const selectedOrganizationLower = selectedOrganization?.trim().toLowerCase();

      if (accessibleOrganizations.length > 0) {
        const canAccessRequestedOrganization = accessibleOrganizations.some(
          (availableOrganization) => availableOrganization.trim().toLowerCase() === requestedOrganizationLower
        );

        if (!canAccessRequestedOrganization) {
          sendApiError(res, {
            status: 403,
            code: "PERMISSION_DENIED",
            message:
              "GitHub OAuth user does not have access to the requested allowlisted organization for this workspace. Select one of the available organizations in GitHub Settings.",
            organization,
            requestedOrganization,
            selectedOrganization,
            allowedOrganizations: getApiProtectionConfig().allowedGitHubOrgs,
            accessibleOrganizations
          });
          return false;
        }
      } else if (selectedOrganizationLower && selectedOrganizationLower !== requestedOrganizationLower) {
        sendApiError(res, {
          status: 403,
          code: "PERMISSION_DENIED",
          message:
            "GitHub OAuth connection is not authorized for the requested organization. Reconnect OAuth or select a valid organization in GitHub Settings.",
          organization,
          requestedOrganization,
          selectedOrganization,
          allowedOrganizations: getApiProtectionConfig().allowedGitHubOrgs
        });
        return false;
      }
    }
  } catch (error) {
    if (error instanceof GitHubAdapterError) {
      sendApiError(res, {
        status: error.status,
        code: error.code,
        message: error.message,
        upstreamStatus: error.upstreamStatus,
        organization: error.organization ?? organization
      });
      return false;
    }

    throw error;
  }

  return true;
}

githubHealthScoreRoutes.get("/organization", async (req, res) => {
  const organization = resolveOrgQuery(req.query.org);
  if (!organization) {
    sendApiError(res, {
      status: 400,
      code: "INVALID_REQUEST",
      message: "Missing or invalid org query parameter."
    });
    return;
  }

  const source = resolveSourceQuery(req.query.source);
  if (source === null) {
    sendApiError(res, {
      status: 400,
      code: "INVALID_REQUEST",
      message: "Invalid source query parameter."
    });
    return;
  }

  if (!(await enforceLiveRequestProtection(req, res, organization, source))) {
    return;
  }

  try {
    const result = await getGitHubOrganizationScore(organization, source);
    res.json(result);
  } catch (error) {
    handleIntegrationError(error, res, organization);
  }
});

githubHealthScoreRoutes.get("/repositories", async (req, res) => {
  const organization = resolveOrgQuery(req.query.org);
  if (!organization) {
    sendApiError(res, {
      status: 400,
      code: "INVALID_REQUEST",
      message: "Missing or invalid org query parameter."
    });
    return;
  }

  const source = resolveSourceQuery(req.query.source);
  if (source === null) {
    sendApiError(res, {
      status: 400,
      code: "INVALID_REQUEST",
      message: "Invalid source query parameter."
    });
    return;
  }

  if (!(await enforceLiveRequestProtection(req, res, organization, source))) {
    return;
  }

  try {
    const result = await getGitHubRepositoryScores(organization, source);
    res.json(result);
  } catch (error) {
    handleIntegrationError(error, res, organization);
  }
});

githubHealthScoreRoutes.get("/repositories/:id", async (req, res) => {
  const organization = resolveOrgQuery(req.query.org);
  if (!organization) {
    sendApiError(res, {
      status: 400,
      code: "INVALID_REQUEST",
      message: "Missing or invalid org query parameter."
    });
    return;
  }

  const source = resolveSourceQuery(req.query.source);
  if (source === null) {
    sendApiError(res, {
      status: 400,
      code: "INVALID_REQUEST",
      message: "Invalid source query parameter."
    });
    return;
  }

  if (!(await enforceLiveRequestProtection(req, res, organization, source))) {
    return;
  }

  try {
    const result = await getGitHubRepositoryScoreById(organization, req.params.id, source);

    if (!result.repository) {
      sendApiError(res, {
        status: 404,
        code: "NOT_FOUND",
        message: "Repository not found for organization/source."
      });
      return;
    }

    res.json(result);
  } catch (error) {
    handleIntegrationError(error, res, organization);
  }
});
