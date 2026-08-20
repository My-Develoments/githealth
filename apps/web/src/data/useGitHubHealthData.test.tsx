import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GitHubHealthAdapterResult } from "./githubHealthDataAdapter";
import { useGitHubHealthData } from "./useGitHubHealthData";

vi.mock("./githubHealthDataAdapter", () => ({
  fetchGitHubHealthData: vi.fn()
}));

vi.mock("./githubConnectionDataAdapter", () => ({
  fetchGitHubConnectionStatus: vi.fn(),
  startGitHubConnection: vi.fn(),
  disconnectGitHubConnection: vi.fn(),
  selectGitHubConnectionOrganization: vi.fn()
}));

import { fetchGitHubHealthData } from "./githubHealthDataAdapter";
import {
  disconnectGitHubConnection,
  fetchGitHubConnectionStatus,
  selectGitHubConnectionOrganization,
  startGitHubConnection
} from "./githubConnectionDataAdapter";

const mockedFetchGitHubHealthData = vi.mocked(fetchGitHubHealthData);
const mockedFetchGitHubConnectionStatus = vi.mocked(fetchGitHubConnectionStatus);
const mockedStartGitHubConnection = vi.mocked(startGitHubConnection);
const mockedDisconnectGitHubConnection = vi.mocked(disconnectGitHubConnection);
const mockedSelectGitHubConnectionOrganization = vi.mocked(selectGitHubConnectionOrganization);

beforeEach(() => {
  mockedFetchGitHubHealthData.mockReset();
  mockedFetchGitHubConnectionStatus.mockReset();
  mockedStartGitHubConnection.mockReset();
  mockedDisconnectGitHubConnection.mockReset();
  mockedSelectGitHubConnectionOrganization.mockReset();
  window.history.replaceState({}, "", "/");
  mockedFetchGitHubHealthData.mockResolvedValue(successResult("ready"));
  mockedFetchGitHubConnectionStatus.mockResolvedValue({
    provider: "pat",
    status: "connected",
    isConnected: true,
    canConnect: false,
    hasInstallationId: false,
    installUrlConfigured: false,
    callbackRedirectConfigured: false,
    message: "Server-side GitHub PAT authentication is configured."
  });
});

describe("useGitHubHealthData", () => {
  it("transitions from loading to ready when adapter succeeds", async () => {
    mockedFetchGitHubHealthData.mockResolvedValueOnce(successResult("ready"));

    const { result } = renderHook(() => useGitHubHealthData());

    expect(result.current.state).toBe("loading");

    await waitFor(() => {
      expect(result.current.state).toBe("ready");
    });

    expect(result.current.viewModels.commandCenter.score).toBe(87);
  });

  it("supports retry after error", async () => {
    mockedFetchGitHubHealthData
      .mockResolvedValueOnce(errorResult("UPSTREAM_UNAVAILABLE", "Network down", 0))
      .mockResolvedValueOnce(successResult("partial"));

    const { result } = renderHook(() => useGitHubHealthData());

    await waitFor(() => {
      expect(result.current.state).toBe("error");
    });

    act(() => {
      result.current.reload();
    });

    await waitFor(() => {
      expect(result.current.state).toBe("partial");
    });
  });

  it("preserves adapter error code/status for UI guidance", async () => {
    mockedFetchGitHubHealthData.mockResolvedValueOnce(errorResult("AUTH_INVALID", "Invalid token", 401));

    const { result } = renderHook(() => useGitHubHealthData());

    await waitFor(() => {
      expect(result.current.state).toBe("error");
    });

    expect(result.current.error).toEqual({
      code: "AUTH_INVALID",
      message: "Invalid token",
      status: 401
    });
  });

  it("keeps empty semantics distinct from loading/error", async () => {
    mockedFetchGitHubHealthData.mockResolvedValueOnce(successResult("empty"));

    const { result } = renderHook(() => useGitHubHealthData());

    await waitFor(() => {
      expect(result.current.state).toBe("empty");
    });

    expect(result.current.commandCenterActivity).toEqual({
      isLoading: false,
      isEmpty: true,
      hasError: false
    });
  });

  it("surfaces GitHub App readiness without attempting a live health fetch", async () => {
    mockedFetchGitHubConnectionStatus.mockResolvedValueOnce({
      provider: "app",
      status: "ready_to_connect",
      isConnected: false,
      canConnect: true,
      hasInstallationId: false,
      installUrlConfigured: true,
      callbackRedirectConfigured: false,
      message: "GitHub App is configured and ready to connect."
    });

    const { result } = renderHook(() => useGitHubHealthData());

    await waitFor(() => {
      expect(result.current.connection.status).toBe("ready_to_connect");
    });

    expect(result.current.state).toBe("empty");
    expect(mockedFetchGitHubHealthData).not.toHaveBeenCalled();
  });

  it("does not fetch live health data when PAT mode is not configured", async () => {
    mockedFetchGitHubConnectionStatus.mockResolvedValueOnce({
      provider: "pat",
      status: "not_configured",
      isConnected: false,
      canConnect: false,
      hasInstallationId: false,
      installUrlConfigured: false,
      callbackRedirectConfigured: false,
      message: "Server-side GITHUB_TOKEN is configured, but ALLOWED_GITHUB_ORGS is empty."
    });

    const { result } = renderHook(() => useGitHubHealthData());

    await waitFor(() => {
      expect(result.current.connection.status).toBe("not_configured");
    });

    expect(result.current.state).toBe("empty");
    expect(mockedFetchGitHubHealthData).not.toHaveBeenCalled();
  });

  it("consumes callback completion and finishes connected", async () => {
    window.history.replaceState(
      {},
      "",
      "/?github_oauth_callback=received&github_oauth_status=connected&github_oauth_login=octocat"
    );
    mockedFetchGitHubConnectionStatus.mockResolvedValueOnce({
      provider: "oauth",
      status: "connected",
      isConnected: true,
      canConnect: true,
      hasInstallationId: false,
      installUrlConfigured: false,
      callbackRedirectConfigured: true,
      message: "GitHub OAuth is connected for this workspace.",
      organization: "githealth-labs",
      githubLogin: "octocat"
    });
    mockedFetchGitHubHealthData.mockResolvedValueOnce(successResult("ready"));

    const { result } = renderHook(() => useGitHubHealthData());

    await waitFor(() => {
      expect(result.current.connection.status).toBe("connected");
    });

    expect(mockedFetchGitHubConnectionStatus.mock.calls[0]?.[0]).toEqual({
      signal: expect.any(AbortSignal)
    });
    expect(window.location.search).toBe("");
    expect(result.current.connection.organization).toBe("githealth-labs");
    expect(result.current.connection.githubLogin).toBe("octocat");
    expect(mockedFetchGitHubHealthData.mock.calls[0]?.[2]).toBe("githealth-labs");
  });

  it("surfaces callback authorization errors without calling live health fetch", async () => {
    window.history.replaceState(
      {},
      "",
      "/?github_app_callback=received&github_app_status=unauthorized_installation&github_app_error_code=PERMISSION_DENIED&github_app_message=Unauthorized"
    );

    const { result } = renderHook(() => useGitHubHealthData());

    await waitFor(() => {
      expect(result.current.connection.status).toBe("unauthorized_installation");
    });

    expect(result.current.state).toBe("error");
    expect(result.current.error).toEqual({
      code: "PERMISSION_DENIED",
      message: "Unauthorized",
      status: 403
    });
    expect(mockedFetchGitHubConnectionStatus).not.toHaveBeenCalled();
    expect(mockedFetchGitHubHealthData).not.toHaveBeenCalled();
  });

  it("starts onboarding and redirects the browser to the backend-provided GitHub OAuth URL", async () => {
    mockedStartGitHubConnection.mockResolvedValueOnce({
      provider: "oauth",
      status: "ready_to_connect",
      connectUrl: "https://github.com/login/oauth/authorize?client_id=test-client"
    });
    const assignSpy = vi.spyOn(window.location, "assign").mockImplementation(() => undefined);

    const { result } = renderHook(() => useGitHubHealthData());

    await waitFor(() => {
      expect(result.current.connection.status).toBe("connected");
    });

    await act(async () => {
      await result.current.connectGitHub();
    });

    expect(mockedStartGitHubConnection).toHaveBeenCalledTimes(1);
    expect(assignSpy).toHaveBeenCalledWith("https://github.com/login/oauth/authorize?client_id=test-client");
  });

  it("surfaces onboarding start failures as retryable error state", async () => {
    mockedStartGitHubConnection.mockRejectedValueOnce({
      code: "UPSTREAM_UNAVAILABLE",
      message: "Unable to start GitHub App onboarding.",
      status: 503
    });

    const { result } = renderHook(() => useGitHubHealthData());

    await waitFor(() => {
      expect(result.current.connection.status).toBe("connected");
    });

    await act(async () => {
      await result.current.connectGitHub();
    });

    expect(result.current.state).toBe("error");
    expect(result.current.connection.status).toBe("error");
    expect(result.current.error).toEqual({
      code: "UPSTREAM_UNAVAILABLE",
      message: "Unable to start GitHub App onboarding.",
      status: 503
    });
  });

  it("disconnects github and reloads connection state", async () => {
    mockedDisconnectGitHubConnection.mockResolvedValueOnce({ ok: true });
    mockedFetchGitHubConnectionStatus
      .mockResolvedValueOnce({
        provider: "oauth",
        status: "connected",
        isConnected: true,
        canConnect: true,
        hasInstallationId: false,
        installUrlConfigured: false,
        callbackRedirectConfigured: true,
        message: "GitHub OAuth is connected for this workspace.",
        githubLogin: "octocat"
      })
      .mockResolvedValueOnce({
        provider: "oauth",
        status: "ready_to_connect",
        isConnected: false,
        canConnect: true,
        hasInstallationId: false,
        installUrlConfigured: false,
        callbackRedirectConfigured: true,
        message: "GitHub OAuth is configured and ready to connect."
      });

    const { result } = renderHook(() => useGitHubHealthData());

    await waitFor(() => {
      expect(result.current.connection.status).toBe("connected");
    });

    await act(async () => {
      await result.current.disconnectGitHub();
    });

    await waitFor(() => {
      expect(result.current.connection.status).toBe("ready_to_connect");
    });

    expect(mockedDisconnectGitHubConnection).toHaveBeenCalledTimes(1);
  });

  it("selects OAuth organization and reloads live health data", async () => {
    mockedFetchGitHubConnectionStatus.mockResolvedValueOnce({
      provider: "oauth",
      status: "connected",
      isConnected: true,
      canConnect: true,
      hasInstallationId: false,
      installUrlConfigured: false,
      callbackRedirectConfigured: true,
      message: "GitHub OAuth is connected for this workspace.",
      organization: "xebia-playground",
      organizationOptions: ["xebia-playground", "xebia"],
      githubLogin: "octocat"
    });
    mockedSelectGitHubConnectionOrganization.mockResolvedValueOnce({
      selectedOrganization: "xebia",
      organizations: ["xebia-playground", "xebia"]
    });
    mockedFetchGitHubConnectionStatus.mockResolvedValueOnce({
      provider: "oauth",
      status: "connected",
      isConnected: true,
      canConnect: true,
      hasInstallationId: false,
      installUrlConfigured: false,
      callbackRedirectConfigured: true,
      message: "GitHub OAuth is connected for this workspace.",
      organization: "xebia",
      organizationOptions: ["xebia-playground", "xebia"],
      githubLogin: "octocat"
    });

    const { result } = renderHook(() => useGitHubHealthData());

    await waitFor(() => {
      expect(result.current.connection.organization).toBe("xebia-playground");
    });

    await act(async () => {
      await result.current.selectOrganization("xebia");
    });

    await waitFor(() => {
      expect(result.current.connection.organization).toBe("xebia");
    });

    expect(mockedSelectGitHubConnectionOrganization).toHaveBeenCalledWith("xebia");
  });

  it("avoids live health fetch when no organization is resolved for connected OAuth session", async () => {
    mockedFetchGitHubConnectionStatus.mockResolvedValueOnce({
      provider: "oauth",
      status: "connected",
      isConnected: true,
      canConnect: true,
      hasInstallationId: false,
      installUrlConfigured: false,
      callbackRedirectConfigured: true,
      message: "GitHub OAuth is connected for this workspace."
    });

    const { result } = renderHook(() => useGitHubHealthData());

    await waitFor(() => {
      expect(result.current.state).toBe("empty");
    });

    expect(result.current.error).toEqual({
      code: "INVALID_REQUEST",
      message: "No organization is selected for live GitHub data. Select an organization in GitHub Settings.",
      status: 409
    });
    expect(mockedFetchGitHubHealthData).not.toHaveBeenCalled();
  });
});

function successResult(state: "ready" | "partial" | "failed" | "empty"): GitHubHealthAdapterResult {
  return {
    state,
    data: {
      source: "mock",
      fetchStatus: state === "partial" ? "partial" : state === "failed" ? "failed" : "complete",
      adapterIssues: [],
      organization: {
        organizationId: "org-id",
        organizationName: "GitHealth Labs",
        overallScore: 87,
        categories: [
          { category: "security", score: 90, completeness: 1, metricsConsidered: 6, metricsMissing: 0 },
          { category: "governance", score: 86, completeness: 1, metricsConsidered: 6, metricsMissing: 0 },
          { category: "cicd", score: 84, completeness: 1, metricsConsidered: 6, metricsMissing: 0 },
          { category: "quality-maintenance", score: 88, completeness: 1, metricsConsidered: 6, metricsMissing: 0 }
        ],
        completeness: 1,
        repositoryCount: state === "empty" ? 0 : 1,
        positiveContributors: [],
        negativeContributors: [],
        recommendations: [],
        validationIssues: [],
        scoringVersion: "1.0.0",
        calculatedAt: new Date().toISOString()
      },
      repositories:
        state === "empty"
          ? []
          : [
              {
                repositoryId: "api-gateway",
                repositoryName: "api-gateway",
                importance: "high",
                overallScore: 87,
                categories: [
                  { category: "security", score: 90, completeness: 1, metricsConsidered: 6, metricsMissing: 0 },
                  { category: "governance", score: 86, completeness: 1, metricsConsidered: 6, metricsMissing: 0 },
                  { category: "cicd", score: 84, completeness: 1, metricsConsidered: 6, metricsMissing: 0 },
                  { category: "quality-maintenance", score: 88, completeness: 1, metricsConsidered: 6, metricsMissing: 0 }
                ],
                completeness: 1,
                positiveContributors: [],
                negativeContributors: [],
                recommendations: [],
                validationIssues: []
              }
            ]
    }
  };
}

function errorResult(code: string, message: string, status: number): GitHubHealthAdapterResult {
  return {
    state: "error",
    error: {
      code,
      message,
      status
    }
  };
}
