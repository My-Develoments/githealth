import { useState } from "react";
import { CommandCenterScreen } from "./screens/CommandCenterScreen";
import { RepositoryUniverseScreen } from "./screens/RepositoryUniverse/RepositoryUniverseScreen";

type Screen = "command-center" | "repository-universe";

export function App() {
  const [screen, setScreen] = useState<Screen>("command-center");

  if (screen === "repository-universe") {
    return <RepositoryUniverseScreen onBack={() => setScreen("command-center")} />;
  }

  return <CommandCenterScreen onExploreUniverse={() => setScreen("repository-universe")} />;
}
