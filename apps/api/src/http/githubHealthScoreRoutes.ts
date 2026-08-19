import { Router, type Response } from "express";
import {
  getGitHubOrganizationScore,
  getGitHubRepositoryScoreById,
  getGitHubRepositoryScores
} from "../application/githubScoringService.js";
import { GitHubAdapterError } from "../infrastructure/github/errors.js";
import type { GitHubSource } from "../application/githubNormalizedModels.js";
import { sendApiError } from "./errorEnvelope.js";
import { githubEndpointAuth } from "./githubEndpointAuth.js";
import { authorizeGitHubOrganizationForSource } from "./githubEndpointOrgAuthorization.js";
import { githubEndpointRateLimit } from "./githubEndpointRateLimit.js";

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

function handleIntegrationError(error: unknown, res: Response) {
  if (error instanceof GitHubAdapterError) {
    sendApiError(res, {
      status: error.status,
      code: error.code,
      message: error.message
    });
    return;
  }

  sendApiError(res, {
    status: 500,
    code: "UPSTREAM_UNAVAILABLE",
    message: "Failed to collect GitHub organization data."
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

function enforceLiveRequestProtection(
  req: Parameters<typeof githubEndpointAuth>[0],
  res: Parameters<typeof githubEndpointAuth>[1],
  organization: string,
  source: GitHubSource | undefined
): boolean {
  if (source === "mock") {
    return true;
  }

  if (!runMiddleware(githubEndpointRateLimit, req, res)) {
    return false;
  }

  if (!runMiddleware(githubEndpointAuth, req, res)) {
    return false;
  }

  if (!authorizeGitHubOrganizationForSource(organization, source, res)) {
    return false;
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

  if (!enforceLiveRequestProtection(req, res, organization, source)) {
    return;
  }

  try {
    const result = await getGitHubOrganizationScore(organization, source);
    res.json(result);
  } catch (error) {
    handleIntegrationError(error, res);
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

  if (!enforceLiveRequestProtection(req, res, organization, source)) {
    return;
  }

  try {
    const result = await getGitHubRepositoryScores(organization, source);
    res.json(result);
  } catch (error) {
    handleIntegrationError(error, res);
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

  if (!enforceLiveRequestProtection(req, res, organization, source)) {
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
    handleIntegrationError(error, res);
  }
});
