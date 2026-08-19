import { useEffect, useState } from "react";
import { commandCenterActivityFeed, useGitHubHealthData } from "./data/useGitHubHealthData";
import { appRoutes, resolvePathForScreen, resolveScreenFromPath, type AppScreen } from "./navigation";
import { CommandCenterScreen } from "./screens/CommandCenterScreen";
import { CiCdHealthScreen } from "./screens/CiCdHealthScreen";
import { GitHubSettingsScreen } from "./screens/GitHubSettingsScreen";
import { GovernanceScreen } from "./screens/GovernanceScreen";
import { OrganizationHealthScreen } from "./screens/OrganizationHealthScreen";
import { RepositoryUniverseScreen } from "./screens/RepositoryUniverse/RepositoryUniverseScreen";
import { ReportsScreen } from "./screens/ReportsScreen";
import { SecurityPostureScreen } from "./screens/SecurityPostureScreen";

function syncScreenWithUrl(nextScreen: AppScreen, mode: "push" | "replace" = "push"): void {
  const nextPath = resolvePathForScreen(nextScreen);
  if (window.location.pathname === nextPath) {
    return;
  }

  window.history[mode === "replace" ? "replaceState" : "pushState"]({}, "", nextPath);
}

export function App() {
  const [screen, setScreen] = useState<AppScreen>(() => resolveScreenFromPath(window.location.pathname));
  const githubHealth = useGitHubHealthData();

  useEffect(() => {
    const resolved = resolveScreenFromPath(window.location.pathname);
    if (window.location.pathname === "/") {
      syncScreenWithUrl(resolved, "replace");
    }
    setScreen(resolved);

    const handlePopState = () => {
      setScreen(resolveScreenFromPath(window.location.pathname));
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const navigateTo = (nextScreen: AppScreen) => {
    syncScreenWithUrl(nextScreen);
    setScreen(nextScreen);
  };

  const sectionScreenProps = {
    activeNavId: screen,
    onNavigate: navigateTo,
    integrationState: githubHealth.state,
    connection: githubHealth.connection,
    integrationError: githubHealth.error,
    onConnectGitHub: githubHealth.connectGitHub,
    onRetry: githubHealth.reload
  };

  if (screen === "repository-universe") {
    return (
      <RepositoryUniverseScreen
        onBack={() => navigateTo("command-center")}
        viewModel={githubHealth.viewModels.repositoryUniverse}
        integrationState={githubHealth.state}
        integrationError={githubHealth.error}
        onRetry={githubHealth.reload}
      />
    );
  }

  if (screen === "settings") {
    const commandCenterView = githubHealth.viewModels.commandCenter;
    const connectedOrganization =
      commandCenterView.source === "live" &&
      githubHealth.connection.isConnected &&
      commandCenterView.organization !== "Unavailable"
        ? commandCenterView.organization
        : undefined;

    return (
      <GitHubSettingsScreen
        activeNavId={screen}
        onNavigate={navigateTo}
        connection={githubHealth.connection}
        integrationState={githubHealth.state}
        integrationError={githubHealth.error}
        connectedOrganization={connectedOrganization}
        onConnectGitHub={githubHealth.connectGitHub}
        onRetry={githubHealth.reload}
      />
    );
  }

  if (screen === "health-intelligence") {
    return (
      <OrganizationHealthScreen
        {...sectionScreenProps}
        healthData={githubHealth.viewModels.commandCenter}
      />
    );
  }

  if (screen === "security") {
    return (
      <SecurityPostureScreen
        {...sectionScreenProps}
        healthData={githubHealth.viewModels.commandCenter}
        repositoryData={githubHealth.viewModels.repositoryUniverse}
      />
    );
  }

  if (screen === "governance") {
    return (
      <GovernanceScreen
        {...sectionScreenProps}
        healthData={githubHealth.viewModels.commandCenter}
        repositoryData={githubHealth.viewModels.repositoryUniverse}
      />
    );
  }

  if (screen === "cicd") {
    return (
      <CiCdHealthScreen
        {...sectionScreenProps}
        healthData={githubHealth.viewModels.commandCenter}
        repositoryData={githubHealth.viewModels.repositoryUniverse}
      />
    );
  }

  if (screen === "reports") {
    return (
      <ReportsScreen
        {...sectionScreenProps}
        healthData={githubHealth.viewModels.commandCenter}
        repositoryData={githubHealth.viewModels.repositoryUniverse}
      />
    );
  }

  return (
    <CommandCenterScreen
      activeNavId={screen}
      onNavigate={navigateTo}
      onExploreUniverse={() => navigateTo("repository-universe")}
      healthData={githubHealth.viewModels.commandCenter}
      activityState={githubHealth.commandCenterActivity}
      connection={githubHealth.connection}
      integrationError={githubHealth.error}
      onConnectGitHub={githubHealth.connectGitHub}
      onRetry={githubHealth.reload}
      recentActivity={githubHealth.viewModels.commandCenter.source === "mock" ? commandCenterActivityFeed : []}
    />
  );
}
