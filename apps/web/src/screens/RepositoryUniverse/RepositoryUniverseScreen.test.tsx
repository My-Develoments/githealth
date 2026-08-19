import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { RepositoryUniverseScreen } from "./RepositoryUniverseScreen";
import type { RepositoryUniverseViewModel } from "../../data/githubHealthViewMappers";
import type { GitHubHealthIntegrationState } from "../../data/githubHealthContracts";

vi.mock("./components/UniverseVisualization", () => ({
  UniverseVisualization: () => <div>Universe Visualization</div>
}));

vi.mock("./components/RepositoryDetailsPanel", () => ({
  RepositoryDetailsPanel: () => <div>Repository Details Panel</div>
}));

vi.mock("./components/UniverseInsightsPanel", () => ({
  UniverseInsightsPanel: () => <div>Universe Insights Panel</div>
}));

afterEach(() => {
  cleanup();
});

beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }))
    });
  }
});

describe("RepositoryUniverseScreen state handling", () => {
  it("renders loading state", () => {
    renderScreen("loading");

    expect(screen.getByText("Building Repository Universe")).toBeTruthy();
  });

  it("renders actionable error state and retry action", () => {
    const onRetry = vi.fn();
    renderScreen("error", {
      onRetry,
      integrationError: {
        code: "AUTH_INVALID",
        message: "Invalid GitHub token",
        status: 401
      }
    });

    expect(screen.getByText("GitHub Authentication Required")).toBeTruthy();
    const errorRegion = screen.getByLabelText("Error state");
    fireEvent.click(within(errorRegion).getByRole("button", { name: "Retry repository universe" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders failed state as error state", () => {
    renderScreen("failed", {
      integrationError: {
        code: "UPSTREAM_UNAVAILABLE",
        message: "Upstream unavailable",
        status: 503
      }
    });

    expect(screen.getByText("Network Or Upstream Unavailable")).toBeTruthy();
  });

  it("renders explicit successful empty API response state", () => {
    renderScreen("empty", {
      viewModel: {
        ...buildViewModel(),
        repositories: []
      }
    });

    expect(screen.getByText("No Repository Health Data Available")).toBeTruthy();
    expect(screen.queryByText("No Repositories Match Current Filters")).toBeNull();
  });

  it("keeps filter-empty distinct from successful API-empty", () => {
    renderScreen("ready");

    fireEvent.change(screen.getByLabelText("Search repositories"), {
      target: { value: "non-existent" }
    });

    expect(screen.getByText("No Repositories Match Current Filters")).toBeTruthy();
  });
});

function renderScreen(
  integrationState: GitHubHealthIntegrationState,
  overrides?: {
    viewModel?: RepositoryUniverseViewModel;
    integrationError?: { message: string; code: string; status: number } | null;
    onRetry?: () => void;
  }
) {
  return render(
    <RepositoryUniverseScreen
      onBack={vi.fn()}
      viewModel={overrides?.viewModel ?? buildViewModel()}
      integrationState={integrationState}
      integrationError={overrides?.integrationError ?? null}
      onRetry={overrides?.onRetry ?? vi.fn()}
    />
  );
}

function buildViewModel(): RepositoryUniverseViewModel {
  return {
    source: "live",
    organization: {
      name: "GitHealth Labs",
      score: 87,
      status: "strong",
      repositories: 1
    },
    repositories: [
      {
        id: "api-gateway",
        name: "api-gateway",
        healthScore: 75,
        status: "needs-attention",
        importance: "important",
        kind: "service",
        x: 100,
        y: 100,
        securityScore: 74,
        governanceScore: 75,
        cicdScore: 76,
        qualityScore: 77,
        openIssues: 4,
        pullRequests: 2,
        securityAlerts: 1,
        dependencies: 10,
        lastActivity: "5m ago",
        trend: [],
        operationalDataAvailable: false,
        trendDataAvailable: false,
        topProblems: ["Missing branch protection"],
        recommendations: ["Enable branch protection"]
      }
    ],
    connections: [],
    insights: [
      {
        id: "highest-risk",
        label: "Highest Risk Repository",
        value: "api-gateway (75)",
        tone: "needs-attention"
      }
    ],
    activity: [],
    fetchStatus: "complete",
    adapterIssues: []
  };
}
