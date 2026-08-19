import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RepositoryDetailsPanel } from "./RepositoryDetailsPanel";
import type { UniverseRepository } from "../../../mock/repositoryUniverseData";

describe("RepositoryDetailsPanel", () => {
  it("explains no-data as missing signals instead of low score", () => {
    render(<RepositoryDetailsPanel repository={buildRepository("no-data")} onClose={vi.fn()} />);

    expect(
      screen.getByText("Health signals are unavailable for this repository. This missing-data state is not the same as a healthy or low numeric score.")
    ).toBeTruthy();
  });

  it("shows actionable guidance for needs-attention repositories", () => {
    render(<RepositoryDetailsPanel repository={buildRepository("needs-attention")} onClose={vi.fn()} />);

    expect(
      screen.getByText("At least one health domain is below target. Apply the listed remediation actions to prevent this repository from drifting into critical state.")
    ).toBeTruthy();
    expect(screen.getByText("Improve CI reliability by reducing flaky jobs.")).toBeTruthy();
  });

  it("shows critical-state explanation and remediation", () => {
    render(<RepositoryDetailsPanel repository={buildRepository("critical")} onClose={vi.fn()} />);

    expect(
      screen.getByText("Multiple repository health signals are below target thresholds. Prioritize the remediation guidance below before the next release cycle.")
    ).toBeTruthy();
    expect(screen.getByText("Resolve open security alerts with highest severity first.")).toBeTruthy();
  });
});

function buildRepository(status: UniverseRepository["status"]): UniverseRepository {
  return {
    id: "repo-1",
    name: "repo-1",
    healthScore: status === "no-data" ? 0 : status === "critical" ? 42 : 76,
    status,
    importance: "important",
    kind: "service",
    x: 100,
    y: 140,
    securityScore: status === "critical" ? 35 : 72,
    governanceScore: status === "critical" ? 40 : 75,
    cicdScore: status === "critical" ? 44 : 71,
    qualityScore: status === "critical" ? 43 : 77,
    openIssues: 14,
    pullRequests: 3,
    securityAlerts: status === "critical" ? 6 : 1,
    dependencies: 120,
    lastActivity: "5m ago",
    trend: [60, 62, 64, 66, 68, 70],
    topProblems: [
      "Branch protection coverage is below target.",
      "CI success rate is below target."
    ],
    recommendations:
      status === "critical"
        ? ["Resolve open security alerts with highest severity first."]
        : status === "needs-attention"
          ? ["Improve CI reliability by reducing flaky jobs."]
          : status === "no-data"
            ? ["Restore repository signal collection and rerun the scan."]
            : ["Maintain current controls and monitor for regressions."]
  };
}
