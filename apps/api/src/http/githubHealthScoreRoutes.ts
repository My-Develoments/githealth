import { Router, type Response } from "express";
import {
  getGitHubOrganizationScore,
  getGitHubRepositoryScoreById,
  getGitHubRepositoryScores
} from "../application/githubScoringService.js";
import { GitHubAdapterError } from "../infrastructure/github/errors.js";

export const githubHealthScoreRoutes = Router();

function resolveOrgQuery(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return null;
}

function resolveSourceQuery(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function handleIntegrationError(error: unknown, res: Response) {
  if (error instanceof GitHubAdapterError) {
    res.status(error.status).json({
      code: error.code,
      message: error.message
    });
    return;
  }

  res.status(500).json({
    code: "UPSTREAM_UNAVAILABLE",
    message: "Failed to collect GitHub organization data."
  });
}

githubHealthScoreRoutes.get("/organization", async (req, res) => {
  const organization = resolveOrgQuery(req.query.org);
  if (!organization) {
    res.status(400).json({ code: "INVALID_REQUEST", message: "Missing required org query parameter." });
    return;
  }

  try {
    const source = resolveSourceQuery(req.query.source);
    const result = await getGitHubOrganizationScore(organization, source);
    res.json(result);
  } catch (error) {
    handleIntegrationError(error, res);
  }
});

githubHealthScoreRoutes.get("/repositories", async (req, res) => {
  const organization = resolveOrgQuery(req.query.org);
  if (!organization) {
    res.status(400).json({ code: "INVALID_REQUEST", message: "Missing required org query parameter." });
    return;
  }

  try {
    const source = resolveSourceQuery(req.query.source);
    const result = await getGitHubRepositoryScores(organization, source);
    res.json(result);
  } catch (error) {
    handleIntegrationError(error, res);
  }
});

githubHealthScoreRoutes.get("/repositories/:id", async (req, res) => {
  const organization = resolveOrgQuery(req.query.org);
  if (!organization) {
    res.status(400).json({ code: "INVALID_REQUEST", message: "Missing required org query parameter." });
    return;
  }

  try {
    const source = resolveSourceQuery(req.query.source);
    const result = await getGitHubRepositoryScoreById(organization, req.params.id, source);

    if (!result.repository) {
      res.status(404).json({
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
