import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrganizationHealthScreen } from "./OrganizationHealthScreen";
import type { CommandCenterHealthViewModel } from "../data/githubHealthViewMappers";
import type { GitHubConnectionViewModel } from "../data/githubHealthContracts";

afterEach(() => {
  cleanup();
});

describe("OrganizationHealthScreen", () => {
  it("renders organization summary and category signals from existing health data", () => {
    render(
      <OrganizationHealthScreen
        healthData={buildHealthData()}
        integrationState="ready"
        connection={buildConnection({ status: "connected", isConnected: true, canConnect: true })}
      />
    );

    expect(screen.getByRole("heading", { name: "Organization Health" })).toBeTruthy();
    expect(screen.getByText("Overall Health")).toBeTruthy();
    expect(screen.getByText("Repositories: 4")).toBeTruthy();
    expect(screen.getByText("Category Signals")).toBeTruthy();
    expect(within(screen.getByLabelText("Health category signals")).getByText("Security")).toBeTruthy();
  });

  it("clearly distinguishes mock/demo source", () => {
    render(
      <OrganizationHealthScreen
        healthData={buildHealthData({ source: "mock" })}
        integrationState="ready"
        connection={buildConnection({ provider: "pat", status: "connected", isConnected: true, canConnect: false })}
      />
    );

    expect(screen.getByText("Source: mock")).toBeTruthy();
    expect(screen.getByText("Showing mock/demo organization health signals from local fixtures.")).toBeTruthy();
  });

  it("shows loading state", () => {
    render(
      <OrganizationHealthScreen
        healthData={buildHealthData()}
        integrationState="loading"
        connection={buildConnection({ status: "connecting", isConnected: false, canConnect: false })}
      />
    );

    expect(screen.getByText("Loading organization health")).toBeTruthy();
  });

  it("shows connect action when app is ready to connect", () => {
    const onConnectGitHub = vi.fn();

    render(
      <OrganizationHealthScreen
        healthData={buildHealthData()}
        integrationState="empty"
        connection={buildConnection({ status: "ready_to_connect", isConnected: false, canConnect: true })}
        onConnectGitHub={onConnectGitHub}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Connect GitHub" }));
    expect(onConnectGitHub).toHaveBeenCalledTimes(1);
  });

  it("shows error state and retry action", () => {
    const onRetry = vi.fn();

    render(
      <OrganizationHealthScreen
        healthData={buildHealthData()}
        integrationState="error"
        connection={buildConnection({ status: "error", isConnected: false, canConnect: false })}
        integrationError={{
          code: "UPSTREAM_UNAVAILABLE",
          message: "Unable to reach GitHub API.",
          status: 503
        }}
        onRetry={onRetry}
      />
    );

    expect(screen.getByText("Unable to load organization health")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry organization health" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows empty state when no repositories are returned", () => {
    render(
      <OrganizationHealthScreen
        healthData={buildHealthData({ totalRepositories: 0 })}
        integrationState="empty"
        connection={buildConnection({ status: "connected", isConnected: true, canConnect: false })}
      />
    );

    expect(screen.getByText("No organization data available")).toBeTruthy();
  });
});

function buildHealthData(overrides: Partial<CommandCenterHealthViewModel> = {}): CommandCenterHealthViewModel {
  return {
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
      {
        key: "security",
        label: "Security",
        score: 90,
        tone: "healthy",
        trend: "Unavailable",
        sparkline: [90, 90, 90]
      }
    ],
    insights: [
      {
        id: "insight-1",
        title: "Increase branch protection coverage",
        repositories: 2,
        impact: "Medium",
        tone: "warning",
        action: "Require status checks on high-risk repositories"
      }
    ],
    fetchStatus: "complete",
    adapterIssues: [],
    ...overrides
  };
}

function buildConnection(overrides: Partial<GitHubConnectionViewModel>): GitHubConnectionViewModel {
  return {
    provider: "app",
    status: "ready_to_connect",
    isConnected: false,
    canConnect: true,
    hasInstallationId: false,
    installUrlConfigured: true,
    callbackRedirectConfigured: true,
    message: "GitHub App is configured and ready to connect.",
    ...overrides
  };
}
