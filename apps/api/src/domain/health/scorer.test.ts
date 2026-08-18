import { describe, expect, it } from "vitest";
import { scoreOrganization, scoreRepository } from "./scorer.js";
import { getMockOrganizationInput } from "../../infrastructure/mock/scenarios.js";
import { CATEGORY_WEIGHTS } from "./constants.js";

describe("health scorer", () => {
  it("keeps repository score inside 0-100", () => {
    const organization = getMockOrganizationInput("invalid");
    const score = scoreRepository(organization.repositories[0]);

    expect(score.overallScore).toBeGreaterThanOrEqual(0);
    expect(score.overallScore).toBeLessThanOrEqual(100);
  });

  it("produces explainable contributors", () => {
    const organization = getMockOrganizationInput("baseline");
    const score = scoreRepository(organization.repositories[0]);

    expect(score.positiveContributors.length).toBeGreaterThan(0);
    expect(score.negativeContributors.length).toBeGreaterThan(0);
  });

  it("ranks negative contributors by weighted negative impact", () => {
    const organization = getMockOrganizationInput("critical-heavy");
    const score = scoreRepository(organization.repositories[0]);

    const weightedNegativeImpact = (value: (typeof score.negativeContributors)[number]): number => {
      return CATEGORY_WEIGHTS[value.category] * value.metricWeight * (1 - value.normalizedValue);
    };

    const impacts = score.negativeContributors.map(weightedNegativeImpact);
    for (let i = 1; i < impacts.length; i += 1) {
      expect(impacts[i - 1]).toBeGreaterThanOrEqual(impacts[i]);
    }
  });

  it("handles sparse data with completeness impact", () => {
    const sparse = getMockOrganizationInput("sparse");
    const baseline = getMockOrganizationInput("baseline");

    const sparseScore = scoreRepository(sparse.repositories[1]);
    const baselineScore = scoreRepository(baseline.repositories[1]);

    expect(sparseScore.completeness).toBeLessThan(baselineScore.completeness);
    expect(sparseScore.validationIssues.length).toBeGreaterThan(0);
  });

  it("returns deterministic organization score for same fixture", () => {
    const fixture = getMockOrganizationInput("mixed");
    const first = scoreOrganization(fixture);
    const second = scoreOrganization(fixture);

    expect(first.organizationScore.overallScore).toBe(second.organizationScore.overallScore);
    expect(first.repositoryScores.length).toBe(second.repositoryScores.length);
  });

  it("handles empty organization repository set", () => {
    const empty = scoreOrganization({
      id: "org-empty",
      name: "Empty Org",
      repositories: []
    });

    expect(empty.organizationScore.overallScore).toBe(0);
    expect(empty.organizationScore.validationIssues[0]?.code).toBe("ORGANIZATION_EMPTY");
  });
});
