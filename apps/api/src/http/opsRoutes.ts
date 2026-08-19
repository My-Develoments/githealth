import { Router } from "express";
import { getGitHubScoreCacheStatistics } from "../application/githubScoringService.js";
import { getServiceMetadata } from "../infrastructure/runtime/serviceMetadata.js";

export const opsRoutes = Router();

opsRoutes.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

opsRoutes.get("/ready", (_req, res) => {
  const metadata = getServiceMetadata();
  const githubScoreCache = getGitHubScoreCacheStatistics();

  res.json({
    status: "ready",
    service: metadata.service,
    version: metadata.version,
    environment: metadata.environment,
    checks: {
      configuration: "ok",
      githubScoreCache
    }
  });
});
