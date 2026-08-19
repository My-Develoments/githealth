import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { UniverseInsightsPanel } from "./UniverseInsightsPanel";
import type { UniverseActivity, UniverseInsight, UniverseRepository } from "../../../mock/repositoryUniverseData";

afterEach(() => {
  cleanup();
});

describe("UniverseInsightsPanel", () => {
  it("shows explicit no-data message when no ranked repositories exist", () => {
    render(
      <UniverseInsightsPanel
        insights={buildInsights()}
        activity={[]}
        repositories={[buildRepository("repo-no-data", "no-data", 0)]}
      />
    );

    expect(screen.getByText("Top risk ranking is unavailable because no repositories have ranked health scores.")).toBeTruthy();
  });

  it("keeps unavailable activity messaging", () => {
    render(
      <UniverseInsightsPanel insights={buildInsights()} activity={[]} repositories={[buildRepository("repo-1", "critical", 52)]} />
    );

    expect(screen.getByText("Recent engineering activity is unavailable from the current API source.")).toBeTruthy();
  });

  it("renders ranked repositories when available", () => {
    render(
      <UniverseInsightsPanel
        insights={buildInsights()}
        activity={[buildActivity()]}
        repositories={[
          buildRepository("repo-a", "healthy", 92),
          buildRepository("repo-b", "critical", 48),
          buildRepository("repo-c", "needs-attention", 73)
        ]}
      />
    );

    expect(screen.getByText("repo-b")).toBeTruthy();
    expect(screen.getByText("repo-c")).toBeTruthy();
  });
});

function buildInsights(): UniverseInsight[] {
  return [
    {
      id: "highest-risk",
      label: "Highest Risk Repository",
      value: "repo-b (48)",
      tone: "critical"
    }
  ];
}

function buildActivity(): UniverseActivity {
  return {
    id: "a-1",
    event: "Scan completed",
    context: "Repository graph refreshed",
    when: "2m ago",
    tone: "healthy"
  };
}

function buildRepository(id: string, status: UniverseRepository["status"], score: number): UniverseRepository {
  return {
    id,
    name: id,
    healthScore: score,
    status,
    importance: "support",
    kind: "service",
    x: 100,
    y: 100,
    securityScore: score,
    governanceScore: score,
    cicdScore: score,
    qualityScore: score,
    openIssues: 0,
    pullRequests: 0,
    securityAlerts: 0,
    dependencies: 0,
    lastActivity: "Unavailable",
    trend: [],
    operationalDataAvailable: false,
    trendDataAvailable: false,
    topProblems: ["No data"],
    recommendations: ["Retry scan"]
  };
}
