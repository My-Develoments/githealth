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
  "repository-health": { key: "repository-health", label: "Repository Health" },
  security: { key: "security", label: "Security" },
  governance: { key: "governance", label: "Governance" },
  cicd: { key: "cicd", label: "CI / CD" },
  "quality-maintenance": { key: "quality", label: "Quality" }
};

const RECOMMENDATION_PRIORITY_WEIGHT = {
  high: 3,
  medium: 2,
  low: 1
} as const;

export function mapGitHubHealthToViewModels(raw: GitHubHealthRawData): GitHubHealthViewModels {
  const mappedRepositories = mapRepositories(raw.repositories, raw.adapterIssues);

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

function mapRepositories(apiRepositories: ApiRepositoryScore[], adapterIssues: GitHubAdapterIssue[]): UniverseRepository[] {
  const metadataById = new Map(universeRepositories.map((repository) => [repository.id, repository]));

  const mappedApiRepositories = apiRepositories.map((repository, index) => {
    const metadata = metadataById.get(repository.repositoryId);
    const fallback = buildFallbackMetadata(repository, index);

    const securityScore = categoryScore(repository.categories, "security");
    const governanceScore = categoryScore(repository.categories, "governance");
    const cicdScore = categoryScore(repository.categories, "cicd");
    const qualityScore = categoryScore(repository.categories, "quality-maintenance");
    const status = mapStatus(repository);

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
      topProblems: buildTopProblems(repository, adapterIssues),
      recommendations: mapRepositoryRecommendations(repository, status, adapterIssues)
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

function buildTopProblems(repository: ApiRepositoryScore, adapterIssues: GitHubAdapterIssue[]): string[] {
  const problems: string[] = [];

  const validationIssues = [...repository.validationIssues]
    .sort((left, right) => {
      const metricCompare = (left.metricKey ?? "").localeCompare(right.metricKey ?? "");
      if (metricCompare !== 0) {
        return metricCompare;
      }
      return left.message.localeCompare(right.message);
    })
    .map((issue) => issue.message);
  problems.push(...validationIssues);

  const lowCategories = [...repository.categories]
    .filter((category) => hasCategorySignal(category) && categoryScoreBelowThreshold(category.score, 88))
    .sort((left, right) => {
      const scoreCompare = left.score - right.score;
      if (scoreCompare !== 0) {
        return scoreCompare;
      }
      return left.category.localeCompare(right.category);
    })
    .map((category) => `${CATEGORY_LABEL_MAP[category.category].label} score ${clampScore(category.score)} is below target.`);
  problems.push(...lowCategories);

  const contributorProblems = [...repository.negativeContributors]
    .sort((left, right) => {
      const metricCompare = left.metricKey.localeCompare(right.metricKey);
      if (metricCompare !== 0) {
        return metricCompare;
      }
      return left.rationale.localeCompare(right.rationale);
    })
    .map((contributor) => `${contributor.metricLabel}: ${contributor.rationale}`);
  problems.push(...contributorProblems);

  const scopedAdapterIssues = adapterIssues
    .filter((issue) => issue.repositoryId === repository.repositoryId)
    .sort((left, right) => {
      const codeCompare = left.code.localeCompare(right.code);
      if (codeCompare !== 0) {
        return codeCompare;
      }
      return left.message.localeCompare(right.message);
    })
    .map((issue) => issue.message);
  problems.push(...scopedAdapterIssues);

  const uniqueProblems = dedupeStable(problems).slice(0, 3);
  if (uniqueProblems.length > 0) {
    return uniqueProblems;
  }

  return ["No high-risk findings reported for available signals."];
}

function mapRepositoryRecommendations(
  repository: ApiRepositoryScore,
  status: HealthStatus,
  adapterIssues: GitHubAdapterIssue[]
): string[] {
  if (status === "no-data") {
    const scopedIssue = adapterIssues.find((issue) => issue.repositoryId === repository.repositoryId);
    if (scopedIssue) {
      return [
        `Data unavailable: ${scopedIssue.message}`,
        "Restore missing repository signals and rerun the organization scan."
      ];
    }

    return [
      "Data unavailable: health signals are missing for this repository.",
      "Enable repository telemetry and policy signals, then rerun health collection."
    ];
  }

  const sortedApiRecommendations = [...repository.recommendations]
    .sort((left, right) => {
      const priorityCompare = RECOMMENDATION_PRIORITY_WEIGHT[right.priority] - RECOMMENDATION_PRIORITY_WEIGHT[left.priority];
      if (priorityCompare !== 0) {
        return priorityCompare;
      }

      const actionCompare = left.actionKey.localeCompare(right.actionKey);
      if (actionCompare !== 0) {
        return actionCompare;
      }

      return left.title.localeCompare(right.title);
    })
    .map((recommendation) => `${recommendation.title}: ${recommendation.description}`);

  if (sortedApiRecommendations.length > 0) {
    return sortedApiRecommendations.slice(0, 3);
  }

  const categoryFallback = [...repository.categories]
    .filter((category) => hasCategorySignal(category) && categoryScoreBelowThreshold(category.score, 88))
    .sort((left, right) => {
      const scoreCompare = left.score - right.score;
      if (scoreCompare !== 0) {
        return scoreCompare;
      }
      return left.category.localeCompare(right.category);
    })
    .map((category) =>
      `Improve ${CATEGORY_LABEL_MAP[category.category].label.toLowerCase()} controls to raise score above watch threshold.`
    );

  const validationFallback = [...repository.validationIssues]
    .sort((left, right) => left.message.localeCompare(right.message))
    .map((issue) => `Address data-quality issue: ${issue.message}`);

  const contributorFallback = [...repository.negativeContributors]
    .sort((left, right) => {
      const metricCompare = left.metricKey.localeCompare(right.metricKey);
      if (metricCompare !== 0) {
        return metricCompare;
      }
      return left.rationale.localeCompare(right.rationale);
    })
    .map((contributor) => `Remediate ${contributor.metricLabel.toLowerCase()}: ${contributor.rationale}`);

  const fallbackRecommendations = dedupeStable([
    ...categoryFallback,
    ...validationFallback,
    ...contributorFallback
  ]).slice(0, 3);

  if (fallbackRecommendations.length > 0) {
    return fallbackRecommendations;
  }

  return ["Maintain current controls and monitor for regressions in upcoming scans."];
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

function mapStatus(repository: ApiRepositoryScore): HealthStatus {
  if (!hasRepositorySignalData(repository)) {
    return "no-data";
  }

  const score = repository.overallScore;
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
  if (completeness <= 0) {
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
    const categoryScoreEntry = repository.categories.find((value) => value.category === category);
    if (!categoryScoreEntry || !hasCategorySignal(categoryScoreEntry)) {
      return false;
    }

    return categoryScoreBelowThreshold(categoryScoreEntry.score, 88);
  }).length;
}

function hasRepositorySignalData(repository: ApiRepositoryScore): boolean {
  if (repository.completeness > 0) {
    return true;
  }

  return repository.categories.some((category) => hasCategorySignal(category));
}

function hasCategorySignal(category: ApiCategoryScore): boolean {
  return category.completeness > 0 || category.metricsConsidered > 0 || category.metricsMissing > 0;
}

function categoryScoreBelowThreshold(score: number, threshold: number): boolean {
  return clampScore(score) < threshold;
}

function dedupeStable(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    if (seen.has(value)) {
      return;
    }
    seen.add(value);
    result.push(value);
  });

  return result;
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
