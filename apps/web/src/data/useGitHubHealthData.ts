import { useCallback, useEffect, useMemo, useState } from "react";
import {
  categorySignals,
  commandCenterData,
  insights,
  recentEngineeringActivity
} from "../mock/commandCenterData";
import {
  universeConnections,
  universeOrganization,
  universeRecentActivity,
  universeRepositories,
  universeTopInsights
} from "../mock/repositoryUniverseData";
import {
  fetchGitHubHealthData,
  type GitHubHealthAdapterFailure
} from "./githubHealthDataAdapter";
import {
  disconnectGitHubConnection,
  fetchGitHubConnectionStatus,
  selectGitHubConnectionOrganization,
  startGitHubConnection
} from "./githubConnectionDataAdapter";
import { resolveGitHubHealthConfig } from "./githubHealthConfig";
import type { GitHubConnectionViewModel, GitHubHealthIntegrationState } from "./githubHealthContracts";
import {
  buildCommandCenterActivityState,
  mapGitHubHealthToViewModels,
  type CommandCenterActivityState,
  type GitHubHealthViewModels
} from "./githubHealthViewMappers";

type UseGitHubHealthDataResult = {
  state: GitHubHealthIntegrationState;
  isRefreshing: boolean;
  commandCenterActivity: CommandCenterActivityState;
  viewModels: GitHubHealthViewModels;
  connection: GitHubConnectionViewModel;
  organizationOptions: string[];
  error: GitHubHealthAdapterFailure["error"] | null;
  reload: () => void;
  connectGitHub: () => Promise<void>;
  disconnectGitHub: () => Promise<void>;
  selectOrganization: (organization: string) => Promise<void>;
};

type GitHubAppCallbackResult = {
  status: Extract<GitHubConnectionViewModel["status"], "installation_completed" | "oauth_connected" | "ready_to_connect" | "unauthorized_installation" | "error">;
  message?: string;
  errorCode?: string;
  githubLogin?: string;
};

const GITHUB_APP_CALLBACK_QUERY_KEYS = [
  "github_app_callback",
  "github_app_status",
  "github_app_session",
  "github_app_message",
  "github_app_error_code",
  "github_app_setup_action"
] as const;

const GITHUB_OAUTH_CALLBACK_QUERY_KEYS = [
  "github_oauth_callback",
  "github_oauth_status",
  "github_oauth_login"
] as const;

function isCallbackStatus(value: string | null): value is GitHubAppCallbackResult["status"] {
  return (
    value === "installation_completed" ||
    value === "oauth_connected" ||
    value === "ready_to_connect" ||
    value === "unauthorized_installation" ||
    value === "error"
  );
}

function consumeGitHubAppCallbackResult(): GitHubAppCallbackResult | undefined {
  const url = new URL(window.location.href);
  if (url.searchParams.get("github_app_callback") !== "received") {
    return undefined;
  }

  const statusValue = url.searchParams.get("github_app_status");
  const status = isCallbackStatus(statusValue) ? statusValue : "error";
  const message = url.searchParams.get("github_app_message") ?? undefined;
  const errorCode = url.searchParams.get("github_app_error_code") ?? undefined;

  for (const key of GITHUB_APP_CALLBACK_QUERY_KEYS) {
    url.searchParams.delete(key);
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, document.title, nextUrl);

  return {
    status,
    message,
    errorCode
  };
}

function consumeGitHubOAuthCallbackResult(): GitHubAppCallbackResult | undefined {
  const url = new URL(window.location.href);
  if (url.searchParams.get("github_oauth_callback") !== "received") {
    return undefined;
  }

  const statusValue = url.searchParams.get("github_oauth_status");
  const status = statusValue === "connected" ? "oauth_connected" : "error";
  const githubLogin = url.searchParams.get("github_oauth_login") ?? undefined;

  for (const key of GITHUB_OAUTH_CALLBACK_QUERY_KEYS) {
    url.searchParams.delete(key);
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, document.title, nextUrl);

  return {
    status,
    message: status === "oauth_connected"
      ? "GitHub OAuth connection completed successfully."
      : "GitHub OAuth onboarding did not complete successfully.",
    githubLogin
  };
}

function createInitialConnectionState(source: "live" | "mock"): GitHubConnectionViewModel {
  if (source === "mock") {
    return {
      provider: "pat",
      status: "connected",
      isConnected: true,
      canConnect: false,
      hasInstallationId: false,
      installUrlConfigured: false,
      callbackRedirectConfigured: false,
      message: "Mock GitHub source is active."
    };
  }

  return {
    provider: "oauth",
    status: "connecting",
    isConnected: false,
    canConnect: false,
    hasInstallationId: false,
    installUrlConfigured: false,
    callbackRedirectConfigured: false,
    message: "Checking GitHub connection status."
  };
}

function createDefaultViewModels(source: "live" | "mock"): GitHubHealthViewModels {
  if (source === "mock") {
    return {
      commandCenter: {
        source: "mock",
        organization: commandCenterData.organization,
        score: commandCenterData.score,
        scoreStatus: commandCenterData.scoreStatus,
        totalRepositories: commandCenterData.totalRepositories,
        pulse: commandCenterData.pulse,
        categorySignals,
        insights,
        fetchStatus: "complete",
        adapterIssues: []
      },
      repositoryUniverse: {
        source: "mock",
        organization: universeOrganization,
        repositories: universeRepositories,
        connections: universeConnections,
        insights: universeTopInsights,
        activity: universeRecentActivity,
        fetchStatus: "complete",
        adapterIssues: []
      }
    };
  }

  return {
    commandCenter: {
      source: "live",
      organization: commandCenterData.organization,
      score: 0,
      scoreStatus: "Unavailable",
      totalRepositories: 0,
      pulse: {
        healthy: 0,
        warning: 0,
        critical: 0,
        lastScan: "Unavailable"
      },
      categorySignals: [],
      insights: [
        {
          id: "insights-unavailable",
          title: "Actionable insights unavailable",
          repositories: 0,
          impact: "Low",
          tone: "neutral",
          action: "Connect or configure an authorized GitHub organization to load live data."
        }
      ],
      fetchStatus: "failed",
      adapterIssues: []
    },
    repositoryUniverse: {
      source: "live",
      organization: {
        ...universeOrganization,
        score: 0,
        repositories: 0
      },
      repositories: [],
      connections: [],
      insights: [
        {
          id: "highest-risk",
          label: "Highest Risk Repository",
          value: "Unavailable",
          tone: "no-data"
        }
      ],
      activity: [],
      fetchStatus: "failed",
      adapterIssues: []
    }
  };
}

export function useGitHubHealthData(): UseGitHubHealthDataResult {
  const initialSource = resolveGitHubHealthConfig().source;
  const [state, setState] = useState<GitHubHealthIntegrationState>("loading");
  const [error, setError] = useState<GitHubHealthAdapterFailure["error"] | null>(null);
  const [viewModels, setViewModels] = useState<GitHubHealthViewModels>(() => createDefaultViewModels(initialSource));
  const [connection, setConnection] = useState<GitHubConnectionViewModel>(() => createInitialConnectionState(initialSource));
  const [organizationOptions, setOrganizationOptions] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasCompletedInitialLoad, setHasCompletedInitialLoad] = useState(false);
  const [reloadSeed, setReloadSeed] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const source = resolveGitHubHealthConfig().source;
    const isBackgroundRefresh = hasCompletedInitialLoad;
    const callbackResult = source === "live"
      ? consumeGitHubOAuthCallbackResult() ?? consumeGitHubAppCallbackResult()
      : undefined;
    if (!isBackgroundRefresh) {
      setState("loading");
    }
    setIsRefreshing(isBackgroundRefresh);
    setError(null);
    if (!isBackgroundRefresh) {
      setConnection(createInitialConnectionState(source));
      setOrganizationOptions([]);
    }

    void (async () => {
      try {
        let resolvedLiveOrganization: string | undefined;
        let resolvedLiveProvider: GitHubConnectionViewModel["provider"] | undefined;
        let resolvedLiveConnectionIsConnected = false;

        if (source === "live") {
          if (callbackResult?.status === "installation_completed" || callbackResult?.status === "oauth_connected") {
            setConnection({
              provider: callbackResult.status === "oauth_connected" ? "oauth" : "app",
              status: callbackResult.status,
              isConnected: false,
              canConnect: true,
              hasInstallationId: callbackResult.status !== "oauth_connected",
              installUrlConfigured: callbackResult.status !== "oauth_connected",
              callbackRedirectConfigured: true,
              message: callbackResult.message || "GitHub connection completed. Finalizing connection.",
              githubLogin: callbackResult.githubLogin
            });
          }

          if (callbackResult && callbackResult.status !== "installation_completed" && callbackResult.status !== "oauth_connected") {
            setConnection({
              provider: "app",
              status: callbackResult.status,
              isConnected: false,
              canConnect: callbackResult.status === "ready_to_connect",
              hasInstallationId: false,
              installUrlConfigured: true,
              callbackRedirectConfigured: true,
              message: callbackResult.message || "GitHub App onboarding did not complete successfully."
            });
            setState(callbackResult.status === "ready_to_connect" ? "empty" : "error");
            setError(
              callbackResult.status === "ready_to_connect"
                ? null
                : {
                    code: callbackResult.errorCode || (callbackResult.status === "unauthorized_installation" ? "PERMISSION_DENIED" : "UPSTREAM_UNAVAILABLE"),
                    message: callbackResult.message || "GitHub App onboarding did not complete successfully.",
                    status: callbackResult.status === "unauthorized_installation" ? 403 : 400
                  }
            );
            return;
          }

          try {
            const nextConnection = await fetchGitHubConnectionStatus({
              signal: controller.signal
            });
            if (controller.signal.aborted) {
              return;
            }

            setConnection(nextConnection);
            resolvedLiveProvider = nextConnection.provider;
            resolvedLiveConnectionIsConnected = nextConnection.isConnected;
            setOrganizationOptions(nextConnection.organizationOptions ?? []);
            resolvedLiveOrganization = nextConnection.organization;

            if (!nextConnection.isConnected) {
              if (!isBackgroundRefresh) {
                setViewModels(createDefaultViewModels("live"));
              }
              setState(
                nextConnection.status === "error" || nextConnection.status === "unauthorized_installation"
                  ? "error"
                  : "empty"
              );
              if (nextConnection.status === "error" || nextConnection.status === "unauthorized_installation") {
                setError({
                  code:
                    nextConnection.errorCode ??
                    (nextConnection.status === "unauthorized_installation" ? "PERMISSION_DENIED" : "AUTH_INVALID"),
                  message: nextConnection.message,
                  status: nextConnection.status === "unauthorized_installation" ? 403 : 503,
                  ...(typeof nextConnection.upstreamStatus === "number" ? { upstreamStatus: nextConnection.upstreamStatus } : {}),
                  ...(typeof nextConnection.organization === "string" ? { organization: nextConnection.organization } : {})
                });
              }
              return;
            }
          } catch (connectionError) {
            if (controller.signal.aborted) {
              return;
            }

            const apiError = connectionError as GitHubHealthAdapterFailure["error"];
            setConnection({
              provider: "oauth",
              status: "error",
              isConnected: false,
              canConnect: false,
              hasInstallationId: false,
              installUrlConfigured: false,
              callbackRedirectConfigured: false,
              message: apiError.message || "Unable to determine GitHub connection status."
            });
            setState("error");
            setError({
              code: apiError.code || "UPSTREAM_UNAVAILABLE",
              message: apiError.message || "Unable to determine GitHub connection status.",
              status: Number.isFinite(apiError.status) ? apiError.status : 0
            });
            return;
          }
        }

        if (
          source === "live" &&
          resolvedLiveProvider === "oauth" &&
          resolvedLiveConnectionIsConnected &&
          !resolvedLiveOrganization
        ) {
          if (!isBackgroundRefresh) {
            setViewModels(createDefaultViewModels("live"));
          }
          setState("empty");
          setError({
            code: "INVALID_REQUEST",
            message: "No organization is selected for live GitHub data. Select an organization in GitHub Settings.",
            status: 409
          });
          return;
        }

        const liveOrganization = source === "live" ? resolvedLiveOrganization : undefined;
        const result = await fetchGitHubHealthData(controller.signal, undefined, liveOrganization);
        if (controller.signal.aborted) {
          return;
        }

        if (result.state === "error") {
          setState("error");
          setError(result.error);
          return;
        }

        setViewModels(mapGitHubHealthToViewModels(result.data));
        if (callbackResult?.status === "installation_completed" || callbackResult?.status === "oauth_connected") {
          setConnection((current) => ({
            ...current,
            status: "connected",
            isConnected: true,
            message:
              callbackResult.status === "oauth_connected"
                ? "GitHub OAuth connection completed and is ready."
                : "GitHub App installation completed and connection is ready."
          }));
        }
        setState(result.state);
      } finally {
        if (!controller.signal.aborted) {
          setIsRefreshing(false);
          setHasCompletedInitialLoad(true);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [reloadSeed]);

  const reload = useCallback(() => {
    setReloadSeed((value) => value + 1);
  }, []);

  const connectGitHub = useCallback(async () => {
    setError(null);
    setState("loading");
    setConnection((current) => ({
      ...current,
      provider: current.provider === "pat" ? "oauth" : current.provider,
      status: "connecting",
      message: "Redirecting to GitHub authentication."
    }));

    try {
      const response = await startGitHubConnection();
      window.location.assign(response.connectUrl);
    } catch (connectError) {
      const apiError = connectError as GitHubHealthAdapterFailure["error"];
      setConnection((current) => ({
        ...current,
        provider: current.provider === "pat" ? "oauth" : current.provider,
        status: "error",
        message: apiError.message || "Unable to start GitHub authentication."
      }));
      setState("error");
      setError({
        code: apiError.code || "UPSTREAM_UNAVAILABLE",
        message: apiError.message || "Unable to start GitHub authentication.",
        status: Number.isFinite(apiError.status) ? apiError.status : 0
      });
    }
  }, []);

  const disconnectGitHub = useCallback(async () => {
    try {
      await disconnectGitHubConnection();
    } catch {
      // Status reload below will surface any backend failure in a consistent manner.
    } finally {
      setReloadSeed((value) => value + 1);
    }
  }, []);

  const selectOrganization = useCallback(async (organization: string) => {
    setError(null);
    setState("loading");

    try {
      const result = await selectGitHubConnectionOrganization(organization);
      setOrganizationOptions(result.organizations);
      setConnection((current) => ({
        ...current,
        organization: result.selectedOrganization,
        message: "GitHub OAuth organization updated for this workspace."
      }));
      setReloadSeed((value) => value + 1);
    } catch (selectError) {
      const apiError = selectError as GitHubHealthAdapterFailure["error"];
      setConnection((current) => ({
        ...current,
        status: "error",
        message: apiError.message || "Unable to update GitHub organization selection."
      }));
      setState("error");
      setError({
        code: apiError.code || "UPSTREAM_UNAVAILABLE",
        message: apiError.message || "Unable to update GitHub organization selection.",
        status: Number.isFinite(apiError.status) ? apiError.status : 0
      });
    }
  }, []);

  const commandCenterActivity = useMemo(() => {
    if (state === "loading") {
      return {
        isLoading: true,
        isEmpty: false,
        hasError: false
      };
    }

    if (state === "error") {
      return {
        isLoading: false,
        isEmpty: false,
        hasError: true
      };
    }

    return buildCommandCenterActivityState(state);
  }, [state]);

  return {
    state,
    isRefreshing,
    commandCenterActivity,
    viewModels,
    connection,
    organizationOptions,
    error,
    reload,
    connectGitHub,
    disconnectGitHub,
    selectOrganization
  };
}

export const commandCenterActivityFeed = recentEngineeringActivity;
