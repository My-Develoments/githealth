import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CommandCenterScreen } from "./CommandCenterScreen";
import type { CommandCenterHealthViewModel } from "../data/githubHealthViewMappers";

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

describe("CommandCenterScreen source isolation", () => {
  it("does not render demo trend/achievement/topology/scan data in live mode", () => {
    render(
      <CommandCenterScreen
        healthData={buildHealthModel("live")}
        activityState={{ isLoading: false, isEmpty: false, hasError: false }}
        recentActivity={[]}
      />
    );

    expect(screen.getByText("Trend unavailable")).toBeTruthy();
    expect(screen.getByText("Historical trend data is unavailable from the current live API source.")).toBeTruthy();
    expect(screen.getByText("Achievement data is unavailable in live mode.")).toBeTruthy();
    expect(screen.getByText("Relationship preview is unavailable because topology data is not provided by the live API.")).toBeTruthy();
    expect(screen.getByText("Scan progress telemetry is unavailable for the live API path.")).toBeTruthy();
    expect(screen.getByText("Recent engineering activity is unavailable from the current source.")).toBeTruthy();
  });

  it("does not convert undefined healthData into mock mode", () => {
    render(<CommandCenterScreen healthData={undefined} activityState={undefined} recentActivity={undefined} />);

    expect(screen.getByText("Source: live")).toBeTruthy();
    expect(screen.getByText("Trend unavailable")).toBeTruthy();
    expect(screen.getByText("Achievement data is unavailable in live mode.")).toBeTruthy();
    expect(screen.queryByText("Security Champion")).toBeNull();
    expect(screen.queryByText("Good morning, Kuldeep.")).toBeNull();
  });

  it("invokes retry callback when error recovery action is used", () => {
    const onRetry = vi.fn();

    render(
      <CommandCenterScreen
        healthData={buildHealthModel("live")}
        activityState={{ isLoading: false, isEmpty: false, hasError: true }}
        integrationError={{
          code: "AUTH_INVALID",
          message: "Authentication failed",
          status: 401
        }}
        onRetry={onRetry}
        recentActivity={[]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry health check" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders a connect action when GitHub App mode is ready to connect", () => {
    const onConnectGitHub = vi.fn();

    render(
      <CommandCenterScreen
        healthData={buildHealthModel("live")}
        activityState={{ isLoading: false, isEmpty: true, hasError: false }}
        connection={{
          provider: "app",
          status: "ready_to_connect",
          isConnected: false,
          canConnect: true,
          hasInstallationId: false,
          installUrlConfigured: true,
          callbackRedirectConfigured: false,
          message: "GitHub App is configured and ready to connect."
        }}
        onConnectGitHub={onConnectGitHub}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Connect GitHub" }));
    expect(onConnectGitHub).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Ready to connect")).toBeTruthy();
  });

  it("does not render retry action when there is no error", () => {
    render(
      <CommandCenterScreen
        healthData={buildHealthModel("live")}
        activityState={{ isLoading: false, isEmpty: false, hasError: false }}
      />
    );

    expect(screen.queryByRole("button", { name: "Retry health check" })).toBeNull();
  });

  it("keeps loading state distinct from empty and healthy states", () => {
    render(
      <CommandCenterScreen
        healthData={buildHealthModel("live")}
        activityState={{ isLoading: true, isEmpty: false, hasError: false }}
      />
    );

    expect(screen.queryByText("No repository data available yet.")).toBeNull();
    expect(screen.queryByText("No active loading jobs.")).toBeNull();
    expect(screen.getByText("Data Loading")).toBeTruthy();
  });

  it("does not fallback to mock recent activity in live mode", () => {
    render(
      <CommandCenterScreen
        healthData={buildHealthModel("live")}
        activityState={{ isLoading: false, isEmpty: true, hasError: false }}
      />
    );

    expect(screen.getByText("Recent engineering activity is unavailable from the current source.")).toBeTruthy();
    expect(screen.queryByText("Organization scan completed")).toBeNull();
  });

  it("keeps demo data visible in explicit mock mode", () => {
    render(
      <CommandCenterScreen
        healthData={buildHealthModel("mock")}
        activityState={{ isLoading: false, isEmpty: false, hasError: false }}
      />
    );

    expect(screen.getByText("Security Champion")).toBeTruthy();
    expect(screen.getByText("Good morning, Kuldeep.")).toBeTruthy();
    expect(screen.getByText("30-Day Health Trend")).toBeTruthy();
    expect(screen.getByText("Organization scan completed")).toBeTruthy();
    expect(screen.queryByText("Achievement data is unavailable in live mode.")).toBeNull();
  });
});

function buildHealthModel(source: "live" | "mock"): CommandCenterHealthViewModel {
  return {
    source,
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
      {
        key: "security",
        label: "Security",
        score: 90,
        tone: "healthy",
        trend: "Unavailable",
        sparkline: [90, 90, 90, 90, 90, 90, 90]
      },
      {
        key: "governance",
        label: "Governance",
        score: 84,
        tone: "warning",
        trend: "Unavailable",
        sparkline: [84, 84, 84, 84, 84, 84, 84]
      },
      {
        key: "cicd",
        label: "CI / CD",
        score: 80,
        tone: "warning",
        trend: "Unavailable",
        sparkline: [80, 80, 80, 80, 80, 80, 80]
      },
      {
        key: "quality",
        label: "Quality",
        score: 82,
        tone: "warning",
        trend: "Unavailable",
        sparkline: [82, 82, 82, 82, 82, 82, 82]
      }
    ],
    insights: [
      {
        id: "insight-1",
        title: "Insight",
        repositories: 1,
        impact: "Low",
        tone: "neutral",
        action: "Action"
      }
    ],
    fetchStatus: "complete",
    adapterIssues: []
  };
}
