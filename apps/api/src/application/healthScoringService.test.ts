import { describe, expect, it } from "vitest";
import {
  getOrganizationScore,
  getRepositoryScoreById,
  getRepositoryScores
} from "./healthScoringService.js";

describe("healthScoringService", () => {
  it("returns deterministic organization score expectations for each mock scenario", () => {
    const expected: Record<string, { score: number; completeness: number; count: number; calculatedAt: string }> = {
      baseline: { score: 85, completeness: 1, count: 4, calculatedAt: "2026-01-01T00:00:00.000Z" },
      mixed: { score: 84, completeness: 1, count: 4, calculatedAt: "2026-01-01T00:01:00.000Z" },
      "critical-heavy": { score: 53, completeness: 1, count: 4, calculatedAt: "2026-01-01T00:02:00.000Z" },
      sparse: { score: 82, completeness: 0.8734, count: 4, calculatedAt: "2026-01-01T00:03:00.000Z" },
      invalid: { score: 84, completeness: 1, count: 4, calculatedAt: "2026-01-01T00:04:00.000Z" }
    };

    for (const [scenario, value] of Object.entries(expected)) {
      const result = getOrganizationScore(scenario);
      expect(result.organization.overallScore).toBe(value.score);
      expect(result.organization.completeness).toBe(value.completeness);
      expect(result.organization.repositoryCount).toBe(value.count);
      expect(result.organization.calculatedAt).toBe(value.calculatedAt);
    }
  });

  it("returns deterministic repository score expectations for each mock scenario", () => {
    const expected: Record<string, string[]> = {
      baseline: ["frontend-web:93", "api-gateway:90", "admin-panel:72", "infra-tools:75"],
      mixed: ["frontend-web:93", "api-gateway:90", "admin-panel:71", "infra-tools:73"],
      "critical-heavy": ["frontend-web:55", "api-gateway:55", "admin-panel:51", "infra-tools:50"],
      sparse: ["frontend-web:93", "api-gateway:85", "admin-panel:64", "infra-tools:74"],
      invalid: ["frontend-web:93", "api-gateway:91", "admin-panel:60", "infra-tools:81"]
    };

    for (const [scenario, values] of Object.entries(expected)) {
      const result = getRepositoryScores(scenario);
      const scoreList = result.repositories.map((repo) => `${repo.repositoryId}:${repo.overallScore}`);
      expect(scoreList).toEqual(values);
    }
  });

  it("exposes stable DTO shape without internal scoring fields", () => {
    const org = getOrganizationScore("baseline");
    const repo = getRepositoryScoreById("frontend-web", "baseline");

    expect(org.organization.categories[0]).not.toHaveProperty("contributions");
    for (const issue of org.organization.validationIssues) {
      expect(issue).not.toHaveProperty("code");
    }

    const contributor = repo.repository?.negativeContributors[0];
    expect(contributor).toBeDefined();
    expect(contributor).not.toHaveProperty("weightedImpact");
    expect(contributor).not.toHaveProperty("normalizedValue");
    expect(contributor).not.toHaveProperty("metricWeight");

    const recommendation = repo.repository?.recommendations[0];
    expect(recommendation).toBeDefined();
    expect(recommendation).not.toHaveProperty("id");
  });
});
