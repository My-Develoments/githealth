import { useEffect, useState } from "react";
import { commandCenterActivityFeed, useGitHubHealthData } from "./data/useGitHubHealthData";
import { appRoutes, resolvePathForScreen, resolveScreenFromPath, type AppScreen } from "./navigation";
import { CommandCenterScreen } from "./screens/CommandCenterScreen";
import { CiCdHealthScreen } from "./screens/CiCdHealthScreen";
import { GitHubSettingsScreen } from "./screens/GitHubSettingsScreen";
import { GovernanceScreen } from "./screens/GovernanceScreen";
import { OrganizationHealthScreen } from "./screens/OrganizationHealthScreen";
import { RepositoryUniverseScreen } from "./screens/RepositoryUniverse/RepositoryUniverseScreen";
import { SecurityPostureScreen } from "./screens/SecurityPostureScreen";
import { SectionPlaceholderScreen } from "./screens/SectionPlaceholderScreen";

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
        activeNavId={screen}
        onNavigate={navigateTo}
        healthData={githubHealth.viewModels.commandCenter}
        integrationState={githubHealth.state}
        connection={githubHealth.connection}
        integrationError={githubHealth.error}
        onConnectGitHub={githubHealth.connectGitHub}
        onRetry={githubHealth.reload}
      />
    );
  }

  if (screen === "security") {
    return (
      <SecurityPostureScreen
        activeNavId={screen}
        onNavigate={navigateTo}
        healthData={githubHealth.viewModels.commandCenter}
        repositoryData={githubHealth.viewModels.repositoryUniverse}
        integrationState={githubHealth.state}
        connection={githubHealth.connection}
        integrationError={githubHealth.error}
        onConnectGitHub={githubHealth.connectGitHub}
        onRetry={githubHealth.reload}
      />
    );
  }

  if (screen === "governance") {
    return (
      <GovernanceScreen
        activeNavId={screen}
        onNavigate={navigateTo}
        healthData={githubHealth.viewModels.commandCenter}
        repositoryData={githubHealth.viewModels.repositoryUniverse}
        integrationState={githubHealth.state}
        connection={githubHealth.connection}
        integrationError={githubHealth.error}
        onConnectGitHub={githubHealth.connectGitHub}
        onRetry={githubHealth.reload}
      />
    );
  }

  if (screen === "cicd") {
    return (
      <CiCdHealthScreen
        activeNavId={screen}
        onNavigate={navigateTo}
        healthData={githubHealth.viewModels.commandCenter}
        repositoryData={githubHealth.viewModels.repositoryUniverse}
        integrationState={githubHealth.state}
        connection={githubHealth.connection}
        integrationError={githubHealth.error}
        onConnectGitHub={githubHealth.connectGitHub}
        onRetry={githubHealth.reload}
      />
    );
  }

  if (screen !== "command-center") {
    const route = appRoutes.find((entry) => entry.id === screen) ?? appRoutes[0];

    return (
      <SectionPlaceholderScreen
        activeScreen={screen}
        route={route}
        connection={githubHealth.connection}
        onNavigate={navigateTo}
        onConnectGitHub={githubHealth.connectGitHub}
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
