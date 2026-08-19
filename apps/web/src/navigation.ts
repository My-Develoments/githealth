export type AppScreen =
  | "command-center"
  | "repository-universe"
  | "security"
  | "governance"
  | "cicd"
  | "health-intelligence"
  | "reports"
  | "settings";

export type AppRouteDefinition = {
  id: AppScreen;
  path: string;
  title: string;
  description: string;
  availability: "live" | "planned";
};

export const appRoutes: AppRouteDefinition[] = [
  {
    id: "command-center",
    path: "/command-center",
    title: "Command Center",
    description: "Real-time organization health monitoring and GitHub connection status.",
    availability: "live"
  },
  {
    id: "repository-universe",
    path: "/repository-universe",
    title: "Repository Universe",
    description: "Explore repository relationships, filters, and engineering health topology.",
    availability: "live"
  },
  {
    id: "security",
    path: "/security",
    title: "Security Posture",
    description: "Security score, risk indicators, and repository-level security context.",
    availability: "live"
  },
  {
    id: "governance",
    path: "/governance",
    title: "Governance",
    description: "Branch protection, review enforcement, and repository policy adoption.",
    availability: "live"
  },
  {
    id: "cicd",
    path: "/cicd",
    title: "CI / CD",
    description: "Delivery reliability, workflow health, and release execution visibility.",
    availability: "live"
  },
  {
    id: "health-intelligence",
    path: "/health-intelligence",
    title: "Organization Health",
    description: "Organization-level score, category signals, and actionable engineering health insights.",
    availability: "live"
  },
  {
    id: "reports",
    path: "/reports",
    title: "Reports",
    description: "Exportable summaries, executive snapshots, and scheduled health reporting.",
    availability: "live"
  },
  {
    id: "settings",
    path: "/settings",
    title: "Settings",
    description: "Source configuration, onboarding state, and platform integration controls.",
    availability: "live"
  }
];

const routeByPath = new Map(appRoutes.map((route) => [route.path, route]));
const routeById = new Map(appRoutes.map((route) => [route.id, route]));

export function getRouteById(screen: AppScreen): AppRouteDefinition {
  return routeById.get(screen) ?? appRoutes[0];
}

export function resolveScreenFromPath(pathname: string): AppScreen {
  if (pathname === "/") {
    return "command-center";
  }

  return routeByPath.get(pathname)?.id ?? "command-center";
}

export function resolvePathForScreen(screen: AppScreen): string {
  return getRouteById(screen).path;
}