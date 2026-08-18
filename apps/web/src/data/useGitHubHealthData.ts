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
import type { GitHubHealthIntegrationState } from "./githubHealthContracts";
import {
  buildCommandCenterActivityState,
  mapGitHubHealthToViewModels,
  type CommandCenterActivityState,
  type GitHubHealthViewModels
} from "./githubHealthViewMappers";

type UseGitHubHealthDataResult = {
  state: GitHubHealthIntegrationState;
  commandCenterActivity: CommandCenterActivityState;
  viewModels: GitHubHealthViewModels;
  error: GitHubHealthAdapterFailure["error"] | null;
  reload: () => void;
};

const defaultViewModels: GitHubHealthViewModels = {
  commandCenter: {
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
    organization: universeOrganization,
    repositories: universeRepositories,
    connections: universeConnections,
    insights: universeTopInsights,
    activity: universeRecentActivity,
    fetchStatus: "complete",
    adapterIssues: []
  }
};

export function useGitHubHealthData(): UseGitHubHealthDataResult {
  const [state, setState] = useState<GitHubHealthIntegrationState>("loading");
  const [error, setError] = useState<GitHubHealthAdapterFailure["error"] | null>(null);
  const [viewModels, setViewModels] = useState<GitHubHealthViewModels>(defaultViewModels);
  const [reloadSeed, setReloadSeed] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    setError(null);

    void fetchGitHubHealthData(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.state === "error") {
        setState("error");
        setError(result.error);
        return;
      }

      setViewModels(mapGitHubHealthToViewModels(result.data));
      setState(result.state);
    });

    return () => {
      controller.abort();
    };
  }, [reloadSeed]);

  const reload = useCallback(() => {
    setReloadSeed((value) => value + 1);
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
    commandCenterActivity,
    viewModels,
    error,
    reload
  };
}

export const commandCenterActivityFeed = recentEngineeringActivity;
