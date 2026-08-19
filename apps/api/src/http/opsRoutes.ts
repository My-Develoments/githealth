import { Router } from "express";
import { getGitHubScoreCacheStatistics } from "../application/githubScoringService.js";
import { getServiceMetadata } from "../infrastructure/runtime/serviceMetadata.js";
import { getStartupValidationStatus } from "../infrastructure/runtime/startupValidation.js";

export const opsRoutes = Router();

opsRoutes.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

opsRoutes.get("/ready", (_req, res) => {
  const metadata = getServiceMetadata();
  const githubScoreCache = getGitHubScoreCacheStatistics();
  const startupValidationStatus = getStartupValidationStatus();
  const isReady = startupValidationStatus === "ok";

  res.status(isReady ? 200 : 503).json({
    status: isReady ? "ready" : "degraded",
    service: metadata.service,
    version: metadata.version,
    environment: metadata.environment,
    checks: {
      configuration: startupValidationStatus,
      githubScoreCache
    }
  });
});
