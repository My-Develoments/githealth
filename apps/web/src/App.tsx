import { useState } from "react";
import { commandCenterActivityFeed, useGitHubHealthData } from "./data/useGitHubHealthData";
import { CommandCenterScreen } from "./screens/CommandCenterScreen";
import { RepositoryUniverseScreen } from "./screens/RepositoryUniverse/RepositoryUniverseScreen";

type Screen = "command-center" | "repository-universe";

export function App() {
  const [screen, setScreen] = useState<Screen>("command-center");
  const githubHealth = useGitHubHealthData();

  if (screen === "repository-universe") {
    return (
      <RepositoryUniverseScreen
        onBack={() => setScreen("command-center")}
        viewModel={githubHealth.viewModels.repositoryUniverse}
        integrationState={githubHealth.state}
        integrationError={githubHealth.error}
        onRetry={githubHealth.reload}
      />
    );
  }

  return (
    <CommandCenterScreen
      onExploreUniverse={() => setScreen("repository-universe")}
      healthData={githubHealth.viewModels.commandCenter}
      activityState={githubHealth.commandCenterActivity}
      recentActivity={githubHealth.viewModels.commandCenter.source === "mock" ? commandCenterActivityFeed : []}
    />
  );
}
