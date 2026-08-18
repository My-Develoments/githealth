import { Router } from "express";
import {
  getOrganizationScore,
  getRepositoryScoreById,
  getRepositoryScores
} from "../application/healthScoringService.js";

export const healthScoreRoutes = Router();

healthScoreRoutes.get("/organization", (req, res) => {
  const scenario = typeof req.query.scenario === "string" ? req.query.scenario : undefined;
  res.json(getOrganizationScore(scenario));
});

healthScoreRoutes.get("/repositories", (req, res) => {
  const scenario = typeof req.query.scenario === "string" ? req.query.scenario : undefined;
  res.json(getRepositoryScores(scenario));
});

healthScoreRoutes.get("/repositories/:id", (req, res) => {
  const scenario = typeof req.query.scenario === "string" ? req.query.scenario : undefined;
  const result = getRepositoryScoreById(req.params.id, scenario);

  if (!result.repository) {
    res.status(404).json({
      scenario: result.scenario,
      error: "Repository not found for scenario"
    });
    return;
  }

  res.json(result);
});
