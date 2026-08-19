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
    sendApiError(res, {
      status: 403,
      code: "PERMISSION_DENIED",
      message: "Requested organization is not authorized for live GitHub health access."
    });
    return false;
  }

  return true;
}
