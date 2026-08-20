import type { Response } from "express";
import type { GitHubSource } from "../application/githubNormalizedModels.js";
import {
  getApiProtectionConfig,
  isAllowedGitHubOrganization
} from "../infrastructure/security/apiProtectionConfig.js";
import { sendApiError } from "./errorEnvelope.js";

export function authorizeGitHubOrganizationForSource(
  organization: string,
  source: GitHubSource | undefined,
  res: Response
): boolean {
  if (source === "mock") {
    return true;
  }

  const config = getApiProtectionConfig();
  if (!isAllowedGitHubOrganization(organization, config.allowedGitHubOrgSet)) {
    console.warn(
      JSON.stringify({
        event: "github_org_authorization_denied",
        source: source ?? "live",
        requestedOrganization: organization,
        allowedOrganizations: config.allowedGitHubOrgs,
        reason: "organization_not_allowlisted"
      })
    );

    sendApiError(res, {
      status: 403,
      code: "PERMISSION_DENIED",
      message: `Live GitHub access is not authorized for organization '${organization}'. Add this org to ALLOWED_GITHUB_ORGS or connect an organization that is allowlisted.`
    });
    return false;
  }

  return true;
}
