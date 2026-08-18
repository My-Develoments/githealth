import { scoreOrganization } from "../domain/health/scorer.js";
import {
  getMockOrganizationInput,
  resolveScenario,
  type HealthScoringScenario
} from "../infrastructure/mock/scenarios.js";
import {
  toApiOrganizationScore,
  toApiRepositoryScore,
  type ApiOrganizationScore,
  type ApiRepositoryScore
} from "./healthScoreDto.js";

const SCENARIO_CALCULATED_AT: Record<HealthScoringScenario, string> = {
  baseline: "2026-01-01T00:00:00.000Z",
  mixed: "2026-01-01T00:01:00.000Z",
  "critical-heavy": "2026-01-01T00:02:00.000Z",
  sparse: "2026-01-01T00:03:00.000Z",
  invalid: "2026-01-01T00:04:00.000Z"
};

export type OrganizationScoreResponse = {
  scenario: HealthScoringScenario;
  organization: ApiOrganizationScore;
};

export type RepositoryScoresResponse = {
  scenario: HealthScoringScenario;
  repositories: ApiRepositoryScore[];
};

export type RepositoryScoreResponse = {
  scenario: HealthScoringScenario;
  repository: ApiRepositoryScore | null;
};

function computeScenarioScores(scenarioInput?: string): {
  scenario: HealthScoringScenario;
  organization: ApiOrganizationScore;
  repositories: ApiRepositoryScore[];
} {
  const scenario = resolveScenario(scenarioInput);
  const input = getMockOrganizationInput(scenario);
  const { organizationScore, repositoryScores } = scoreOrganization(input, {
    calculatedAt: SCENARIO_CALCULATED_AT[scenario]
  });

  return {
    scenario,
    organization: toApiOrganizationScore(organizationScore),
    repositories: repositoryScores.map(toApiRepositoryScore)
  };
}

export function getOrganizationScore(scenarioInput?: string): OrganizationScoreResponse {
  const result = computeScenarioScores(scenarioInput);
  return {
    scenario: result.scenario,
    organization: result.organization
  };
}

export function getRepositoryScores(scenarioInput?: string): RepositoryScoresResponse {
  const result = computeScenarioScores(scenarioInput);
  return {
    scenario: result.scenario,
    repositories: result.repositories
  };
}

export function getRepositoryScoreById(
  repositoryId: string,
  scenarioInput?: string
): RepositoryScoreResponse {
  const result = computeScenarioScores(scenarioInput);
  return {
    scenario: result.scenario,
    repository: result.repositories.find((repository) => repository.repositoryId === repositoryId) ?? null
  };
}
