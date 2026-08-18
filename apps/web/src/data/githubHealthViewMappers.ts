import {
  categorySignals as categorySignalDefaults,
  commandCenterData,
  insights as insightDefaults,
  recentEngineeringActivity
} from "../mock/commandCenterData";
import {
  universeConnections,
  universeOrganization,
  universeRecentActivity,
  universeTopInsights,
  universeRepositories,
  type HealthStatus,
  type UniverseActivity,
  type UniverseConnection,
  type UniverseInsight,
  type UniverseRepository
} from "../mock/repositoryUniverseData";
import type {
  ApiCategoryScore,
  ApiRepositoryImportance,
  ApiRepositoryScore,
  GitHubAdapterIssue,
  GitHubFetchStatus
} from "./githubHealthContracts";
import type { GitHubHealthRawData } from "./githubHealthDataAdapter";

export type CommandCenterHealthViewModel = {
  organization: string;
  score: number;
  scoreStatus: string;
  totalRepositories: number;
  pulse: {
    healthy: number;
    warning: number;
    critical: number;
    lastScan: string;
  };
  categorySignals: typeof categorySignalDefaults;
  insights: typeof insightDefaults;
  fetchStatus: GitHubFetchStatus;
  adapterIssues: GitHubAdapterIssue[];
};

export type CommandCenterActivityState = {
  isLoading: boolean;
  isEmpty: boolean;
  hasError: boolean;
};

export type RepositoryUniverseViewModel = {
  organization: {
    name: string;
    score: number;
    status: string;
    repositories: number;
  };
  repositories: UniverseRepository[];
  connections: UniverseConnection[];
  insights: UniverseInsight[];
  activity: UniverseActivity[];
  fetchStatus: GitHubFetchStatus;
  adapterIssues: GitHubAdapterIssue[];
};

export type GitHubHealthViewModels = {
  commandCenter: CommandCenterHealthViewModel;
  repositoryUniverse: RepositoryUniverseViewModel;
};

const CATEGORY_LABEL_MAP: Record<ApiCategoryScore["category"], { key: string; label: string }> = {
  security: { key: "security", label: "Security" },
  governance: { key: "governance", label: "Governance" },
  cicd: { key: "cicd", label: "CI / CD" },
  "quality-maintenance": { key: "quality", label: "Quality" }
};

export function mapGitHubHealthToViewModels(raw: GitHubHealthRawData): GitHubHealthViewModels {
  const mappedRepositories = mapRepositories(raw.repositories);

  return {
    commandCenter: {
      organization: raw.organization.organizationName,
      score: clampScore(raw.organization.overallScore),
      scoreStatus: scoreStatus(raw.organization.overallScore),
      totalRepositories: mappedRepositories.length,
      pulse: buildPulse(mappedRepositories),
      categorySignals: mapCategorySignals(raw.organization.categories),
      insights: mapInsights(raw),
      fetchStatus: raw.fetchStatus,
      adapterIssues: raw.adapterIssues
    },
    repositoryUniverse: {
      organization: {
        name: raw.organization.organizationName,
        score: clampScore(raw.organization.overallScore),
        status: scoreStatus(raw.organization.overallScore).toLowerCase(),
        repositories: mappedRepositories.length
      },
      repositories: mappedRepositories,
      connections: universeConnections,
      insights: mapUniverseInsights(mappedRepositories, raw.adapterIssues),
      activity: universeRecentActivity,
      fetchStatus: raw.fetchStatus,
      adapterIssues: raw.adapterIssues
    }
  };
}

function mapCategorySignals(categories: ApiCategoryScore[]): typeof categorySignalDefaults {
  const byCategory = new Map(categories.map((category) => [category.category, category]));
  const orderedCategories: ApiCategoryScore["category"][] = ["security", "governance", "cicd", "quality-maintenance"];

  return orderedCategories.map((categoryKey) => {
    const apiCategory = byCategory.get(categoryKey);
    const defaults = categorySignalDefaults.find((value) => value.key === CATEGORY_LABEL_MAP[categoryKey].key);

    const score = clampScore(apiCategory?.score ?? 0);
    const tone = toToneFromScore(score, apiCategory?.completeness ?? 0);

    return {
      key: CATEGORY_LABEL_MAP[categoryKey].key,
      label: CATEGORY_LABEL_MAP[categoryKey].label,
      score,
      tone,
      trend: defaults?.trend ?? "+0.0%",
      sparkline: defaults?.sparkline ?? [score, score, score, score, score, score, score]
    };
  });
}

function mapInsights(raw: GitHubHealthRawData): typeof insightDefaults {
  const mappedFromRecommendations = raw.organization.recommendations.slice(0, 3).map((recommendation, index) => ({
    id: recommendation.actionKey,
    title: recommendation.title,
    repositories: Math.max(1, countRepositoriesForCategory(raw.repositories, recommendation.category)),
    impact: (recommendation.priority === "high" ? "High" : recommendation.priority === "medium" ? "Medium" : "Low") as
      | "High"
      | "Medium"
      | "Low",
    tone: (recommendation.priority === "high" ? "critical" : recommendation.priority === "medium" ? "warning" : "neutral") as
      | "critical"
      | "warning"
      | "neutral",
    action: recommendation.description
  }));

  if (mappedFromRecommendations.length > 0) {
    return mappedFromRecommendations;
  }

  if (raw.adapterIssues.length > 0) {
    return raw.adapterIssues.slice(0, 3).map((issue, index) => ({
      id: `adapter-${index}`,
      title: issue.message,
      repositories: issue.repositoryId ? 1 : raw.repositories.length,
      impact: issue.code === "RATE_LIMITED" || issue.code === "UPSTREAM_UNAVAILABLE" ? "High" : "Medium",
      tone: issue.code === "RATE_LIMITED" || issue.code === "UPSTREAM_UNAVAILABLE" ? "critical" : "warning",
      action: "Review adapter issue details and retry the organization scan."
    }));
  }

  return insightDefaults;
}

function mapRepositories(apiRepositories: ApiRepositoryScore[]): UniverseRepository[] {
  const metadataById = new Map(universeRepositories.map((repository) => [repository.id, repository]));

  const mappedApiRepositories = apiRepositories.map((repository, index) => {
    const metadata = metadataById.get(repository.repositoryId);
    const fallback = buildFallbackMetadata(repository, index);

    const securityScore = categoryScore(repository.categories, "security");
    const governanceScore = categoryScore(repository.categories, "governance");
    const cicdScore = categoryScore(repository.categories, "cicd");
    const qualityScore = categoryScore(repository.categories, "quality-maintenance");
    const status = mapStatus(repository.overallScore, repository.completeness);

    return {
      id: repository.repositoryId,
      name: repository.repositoryName,
      healthScore: clampScore(repository.overallScore),
      status,
      importance: mapImportance(repository.importance),
      kind: metadata?.kind ?? fallback.kind,
      x: metadata?.x ?? fallback.x,
      y: metadata?.y ?? fallback.y,
      securityScore,
      governanceScore,
      cicdScore,
      qualityScore,
      openIssues: metadata?.openIssues ?? 0,
      pullRequests: metadata?.pullRequests ?? 0,
      securityAlerts: metadata?.securityAlerts ?? 0,
      dependencies: metadata?.dependencies ?? 0,
      lastActivity: metadata?.lastActivity ?? "N/A",
      trend: metadata?.trend ?? [clampScore(repository.overallScore)],
      topProblems: buildTopProblems(repository),
      recommendations: repository.recommendations.slice(0, 3).map((value) => value.title)
    } satisfies UniverseRepository;
  });

  const existingIds = new Set(mappedApiRepositories.map((repository) => repository.id));
  const metadataOnly = universeRepositories
    .filter((repository) => !existingIds.has(repository.id))
    .map((repository) => ({
      ...repository,
      healthScore: 0,
      status: "no-data" as const,
      securityScore: 0,
      governanceScore: 0,
      cicdScore: 0,
      qualityScore: 0,
      topProblems: ["No API score data available for this repository."],
      recommendations: ["Verify repository visibility and rerun health collection."]
    }));

  return [...mappedApiRepositories, ...metadataOnly];
}

function buildTopProblems(repository: ApiRepositoryScore): string[] {
  const fromValidation = repository.validationIssues.slice(0, 3).map((issue) => issue.message);
  if (fromValidation.length > 0) {
    return fromValidation;
  }
  if (repository.recommendations.length > 0) {
    return [repository.recommendations[0].description];
  }
  return ["No critical problems detected."];
}

function buildPulse(repositories: UniverseRepository[]): CommandCenterHealthViewModel["pulse"] {
  let healthy = 0;
  let warning = 0;
  let critical = 0;

  repositories.forEach((repository) => {
    if (repository.status === "healthy") {
      healthy += 1;
      return;
    }
    if (repository.status === "needs-attention") {
      warning += 1;
      return;
    }
    if (repository.status === "critical") {
      critical += 1;
    }
  });

  return {
    healthy,
    warning,
    critical,
    lastScan: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  };
}

function mapUniverseInsights(repositories: UniverseRepository[], adapterIssues: GitHubAdapterIssue[]): UniverseInsight[] {
  const ranked = [...repositories]
    .filter((repository) => repository.status !== "no-data")
    .sort((left, right) => left.healthScore - right.healthScore);

  const highestRisk = ranked[0];
  const attentionCount = repositories.filter((repository) => repository.status === "needs-attention" || repository.status === "critical").length;

  if (!highestRisk) {
    return universeTopInsights;
  }

  return [
    {
      id: "highest-risk",
      label: "Highest Risk Repository",
      value: `${highestRisk.name} (${highestRisk.healthScore})`,
      tone: highestRisk.status
    },
    {
      id: "adapter-issues",
      label: "Adapter Issues",
      value: adapterIssues.length > 0 ? `${adapterIssues.length} issue(s) reported` : "No adapter issues",
      tone: adapterIssues.length > 0 ? "needs-attention" : "healthy"
    },
    {
      id: "needs-attention",
      label: "Repositories Needing Attention",
      value: `${attentionCount} repositories`,
      tone: attentionCount > 0 ? "needs-attention" : "healthy"
    },
    {
      id: "next-action",
      label: "Recommended Next Action",
      value: highestRisk.recommendations[0] ?? "Review lowest-scoring repository recommendations.",
      tone: highestRisk.status
    }
  ];
}

function buildFallbackMetadata(repository: ApiRepositoryScore, index: number): Pick<UniverseRepository, "x" | "y" | "kind"> {
  const seed = hashCode(repository.repositoryId);
  const lane = Math.abs(seed) % 3;

  return {
    x: 160 + (Math.abs(seed) % 680),
    y: 120 + ((index * 73 + Math.abs(seed % 190)) % 380),
    kind: lane === 0 ? "service" : lane === 1 ? "application" : "platform"
  };
}

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function mapImportance(value: ApiRepositoryImportance): UniverseRepository["importance"] {
  if (value === "critical" || value === "high") {
    return "important";
  }
  if (value === "medium") {
    return "medium";
  }
  return "support";
}

function mapStatus(score: number, completeness: number): HealthStatus {
  if (completeness <= 0 || score <= 0) {
    return "no-data";
  }
  if (score >= 88) {
    return "healthy";
  }
  if (score >= 70) {
    return "needs-attention";
  }
  return "critical";
}

function scoreStatus(score: number): string {
  if (score >= 90) {
    return "Excellent";
  }
  if (score >= 80) {
    return "Strong";
  }
  if (score >= 70) {
    return "Watch";
  }
  return "Critical";
}

function toToneFromScore(score: number, completeness: number): "healthy" | "warning" | "critical" | "neutral" | "unknown" {
  if (completeness <= 0 || score <= 0) {
    return "unknown";
  }
  if (score >= 88) {
    return "healthy";
  }
  if (score >= 70) {
    return "warning";
  }
  return "critical";
}

function categoryScore(categories: ApiCategoryScore[], key: ApiCategoryScore["category"]): number {
  const value = categories.find((category) => category.category === key);
  return clampScore(value?.score ?? 0);
}

function countRepositoriesForCategory(repositories: ApiRepositoryScore[], category: ApiCategoryScore["category"]): number {
  return repositories.filter((repository) => {
    const score = categoryScore(repository.categories, category);
    return score > 0 && score < 88;
  }).length;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function buildCommandCenterActivityState(state: "loading" | "ready" | "partial" | "failed" | "empty" | "error"): CommandCenterActivityState {
  return {
    isLoading: state === "loading",
    isEmpty: state === "empty",
    hasError: state === "error" || state === "failed"
  };
}

export const commandCenterActivityFeed = recentEngineeringActivity;
export const commandCenterDefaults = commandCenterData;
export const repositoryUniverseDefaults = universeOrganization;
