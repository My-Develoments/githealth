import { useEffect, useState } from "react";
import { commandCenterActivityFeed, useGitHubHealthData } from "./data/useGitHubHealthData";
import { appRoutes, resolvePathForScreen, resolveScreenFromPath, type AppScreen } from "./navigation";
import { CommandCenterScreen } from "./screens/CommandCenterScreen";
import { RepositoryUniverseScreen } from "./screens/RepositoryUniverse/RepositoryUniverseScreen";
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
