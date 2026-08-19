import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CiCdHealthScreen } from "./CiCdHealthScreen";
import type { CommandCenterHealthViewModel, RepositoryUniverseViewModel } from "../data/githubHealthViewMappers";
import type { GitHubConnectionViewModel } from "../data/githubHealthContracts";

afterEach(() => {
  cleanup();
});

describe("CiCdHealthScreen", () => {
  it("renders delivery summary and repository context from existing view models", () => {
    render(
      <CiCdHealthScreen
        healthData={buildHealthData()}
        repositoryData={buildRepositoryData()}
        integrationState="ready"
        connection={buildConnection({ status: "connected", isConnected: true, canConnect: true })}
      />
    );

    expect(screen.getByRole("heading", { name: "CI / CD Health" })).toBeTruthy();
    expect(screen.getByText("Delivery Summary")).toBeTruthy();
    expect(screen.getByText("Low CI / CD score repos: 1")).toBeTruthy();
    expect(screen.getByText("Repository Delivery Context")).toBeTruthy();
    expect(screen.getByText("api-gateway")).toBeTruthy();
  });

  it("clearly distinguishes mock/demo source", () => {
    render(
      <CiCdHealthScreen
        healthData={buildHealthData({ source: "mock" })}
        repositoryData={buildRepositoryData({ source: "mock" })}
        integrationState="ready"
        connection={buildConnection({ provider: "pat", status: "connected", isConnected: true, canConnect: false })}
      />
    );

    expect(screen.getByText("Source: mock")).toBeTruthy();
    expect(screen.getByText("Showing mock/demo CI / CD health posture from local fixtures.")).toBeTruthy();
  });

  it("shows loading state", () => {
    render(
      <CiCdHealthScreen
        healthData={buildHealthData()}
        repositoryData={buildRepositoryData()}
        integrationState="loading"
        connection={buildConnection({ status: "connecting", isConnected: false, canConnect: false })}
      />
    );

    expect(screen.getByText("Loading CI / CD health")).toBeTruthy();
  });

  it("shows connect action when app is ready to connect", () => {
    const onConnectGitHub = vi.fn();

    render(
      <CiCdHealthScreen
        healthData={buildHealthData()}
        repositoryData={buildRepositoryData()}
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
      <CiCdHealthScreen
        healthData={buildHealthData()}
        repositoryData={buildRepositoryData()}
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

    expect(screen.getByText("Unable to load CI / CD health")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry CI/CD health" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows unavailable repository context when repository signals are missing", () => {
    render(
      <CiCdHealthScreen
        healthData={buildHealthData()}
        repositoryData={buildRepositoryData({ repositories: [] })}
        integrationState="empty"
        connection={buildConnection({ status: "connected", isConnected: true, canConnect: false })}
      />
    );

    expect(screen.getByText("No repository-level CI / CD context is available for the current source.")).toBeTruthy();
  });

  it("surfaces workflow data coverage limitations without inventing delivery telemetry", () => {
    render(
      <CiCdHealthScreen
        healthData={buildHealthData()}
        repositoryData={buildRepositoryData()}
        integrationState="ready"
        connection={buildConnection({ status: "connected", isConnected: true, canConnect: false })}
      />
    );

    expect(screen.getByText("Workflow Data Coverage")).toBeTruthy();
    expect(screen.getByText(/but not workflow run, deployment frequency, lead time, or failure-rate series/i)).toBeTruthy();
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
        key: "cicd",
        label: "CI / CD",
        score: 79,
        tone: "warning",
        trend: "Unavailable",
        sparkline: [79, 79, 79]
      }
    ],
    insights: [
      {
        id: "cicd-insight",
        title: "Pipeline queue depth increased on core services",
        repositories: 2,
        impact: "Medium",
        tone: "warning",
        action: "Review workflow concurrency and release queue limits"
      }
    ],
    fetchStatus: "complete",
    adapterIssues: [],
    ...overrides
  };
}

function buildRepositoryData(overrides: Partial<RepositoryUniverseViewModel> = {}): RepositoryUniverseViewModel {
  return {
    source: "live",
    organization: {
      name: "GitHealth Labs",
      score: 87,
      status: "strong",
      repositories: 2
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
        securityScore: 72,
        governanceScore: 75,
        cicdScore: 76,
        qualityScore: 77,
        openIssues: 12,
        pullRequests: 9,
        securityAlerts: 1,
        dependencies: 40,
        lastActivity: "5m ago",
        trend: [],
        operationalDataAvailable: true,
        trendDataAvailable: false,
        topProblems: ["Delivery queue saturation"],
        recommendations: ["Increase workflow parallelization"]
      }
    ],
    connections: [],
    insights: [],
    activity: [],
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
