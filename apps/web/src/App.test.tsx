import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

vi.mock("./data/useGitHubHealthData", () => ({
  commandCenterActivityFeed: [],
  useGitHubHealthData: () => ({
    state: "ready",
    commandCenterActivity: { isLoading: false, isEmpty: false, hasError: false },
    viewModels: {
      commandCenter: {
        source: "live",
        organization: "GitHealth Labs",
        score: 87,
        scoreStatus: "Excellent",
        totalRepositories: 4,
        pulse: {
          healthy: 2,
          warning: 1,
          critical: 1,
          lastScan: "07:00"
        },
        categorySignals: [
          { key: "security", label: "Security", score: 90, tone: "healthy", trend: "Unavailable", sparkline: [90, 90, 90] }
        ],
        insights: [
          { id: "insight-1", title: "Insight", repositories: 1, impact: "Low", tone: "neutral", action: "Action" }
        ],
        fetchStatus: "complete",
        adapterIssues: []
      },
      repositoryUniverse: {
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
      }
    },
    connection: {
      provider: "app",
      status: "ready_to_connect",
      isConnected: false,
      canConnect: true,
      hasInstallationId: false,
      installUrlConfigured: true,
      callbackRedirectConfigured: false,
      message: "GitHub App is configured and ready to connect."
    },
    error: null,
    reload: vi.fn(),
    connectGitHub: vi.fn()
  })
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

beforeEach(() => {
  window.history.replaceState({}, "", "/command-center");
});

describe("App navigation", () => {
  it("makes all primary sidebar items clickable", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "Command Center" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Repository Universe" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Security" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Governance" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "CI / CD" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Health Intelligence" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reports" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
  });

  it("navigates to placeholder screens and updates the active state", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Security" }));

    await waitFor(() => {
      expect(window.location.pathname).toBe("/security");
    });

    expect(screen.getByRole("button", { name: "Security" }).getAttribute("aria-current")).toBe("page");
  });

  it("preserves repository universe navigation", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Repository Universe" }));

    await waitFor(() => {
      expect(screen.getByText("Back To Command Center")).toBeTruthy();
    });

    expect(window.location.pathname).toBe("/repository-universe");
    expect(screen.getByText("Explore engineering health across repositories, services, and platform dependencies.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Back To Command Center" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Engineering Intelligence Center" })).toBeTruthy();
    });

    expect(window.location.pathname).toBe("/command-center");
  });

  it("restores the correct screen from the current URL", async () => {
    window.history.replaceState({}, "", "/reports");

    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/reports");
    });

    expect(screen.getByRole("button", { name: "Reports" }).getAttribute("aria-current")).toBe("page");
  });
});