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
    expect(screen.getByText("Live Workflow Telemetry")).toBeTruthy();
    expect(screen.getByText("Recent Workflow Runs")).toBeTruthy();
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

  it("shows unavailable DORA metrics while using real workflow telemetry", () => {
    render(
      <CiCdHealthScreen
        healthData={buildHealthData()}
        repositoryData={buildRepositoryData()}
        integrationState="ready"
        connection={buildConnection({ status: "connected", isConnected: true, canConnect: false })}
      />
    );

    expect(screen.getByText("Unavailable Delivery Metrics")).toBeTruthy();
    expect(screen.getByText(/lead time for changes/i)).toBeTruthy();
    expect(screen.getByText("Total runs: 3")).toBeTruthy();
    expect(screen.getByText("Success rate: 67%")).toBeTruthy();
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
        cicdTelemetry: {
          ciSuccessRate: 76,
          deploymentFrequencyWeekly: 5.4,
          workflowFailureRate: 24,
          runSummary: {
            totalRuns: 3,
            completedRuns: 3,
            successCount: 2,
            failureCount: 1,
            successRate: 66.67,
            failureRate: 33.33,
            latestRunAt: "2026-02-05T10:45:00.000Z"
          },
          recentRuns: [
            {
              id: 91,
              name: "build",
              status: "completed",
              conclusion: "success",
              event: "push",
              branch: "main",
              runNumber: 44,
              createdAt: "2026-02-05T10:45:00.000Z",
              updatedAt: "2026-02-05T10:49:00.000Z",
              url: "https://github.com/githealth-labs/api-gateway/actions/runs/91"
            },
            {
              id: 90,
              name: "integration",
              status: "completed",
              conclusion: "failure",
              event: "pull_request",
              branch: "feature/ci",
              runNumber: 43,
              createdAt: "2026-02-05T09:40:00.000Z",
              updatedAt: "2026-02-05T09:46:00.000Z",
              url: "https://github.com/githealth-labs/api-gateway/actions/runs/90"
            }
          ]
        },
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
