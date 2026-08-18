import type {
  CategoryScore,
  HealthCategoryKey,
  Recommendation,
  RecommendationPriority,
  RepositoryHealthScore
} from "./types.js";

type RecommendationTemplate = {
  actionKey: string;
  category: HealthCategoryKey;
  threshold: number;
  priority: RecommendationPriority;
  title: string;
  description: string;
};

const RECOMMENDATION_RULES: RecommendationTemplate[] = [
  {
    actionKey: "security-alert-burn-down",
    category: "security",
    threshold: 75,
    priority: "high",
    title: "Reduce Open Security Alerts",
    description: "Prioritize CVE burn-down and enforce patch SLA for critical dependencies."
  },
  {
    actionKey: "branch-protection-enforcement",
    category: "governance",
    threshold: 80,
    priority: "high",
    title: "Strengthen Branch Protection",
    description: "Require status checks and code-owner reviews for protected branches."
  },
  {
    actionKey: "pipeline-reliability",
    category: "cicd",
    threshold: 80,
    priority: "medium",
    title: "Improve CI/CD Reliability",
    description: "Stabilize flaky jobs and improve pipeline success rate before next release."
  },
  {
    actionKey: "quality-coverage-improvement",
    category: "quality-maintenance",
    threshold: 82,
    priority: "medium",
    title: "Raise Test and Maintenance Quality",
    description: "Increase coverage and close stale maintenance backlog to improve reliability."
  },
  {
    actionKey: "signal-completeness",
    category: "repository-health",
    threshold: 85,
    priority: "low",
    title: "Increase Health Signal Completeness",
    description: "Enable all expected quality/security/governance signals for this repository."
  }
];

const PRIORITY_WEIGHT: Record<RecommendationPriority, number> = {
  high: 3,
  medium: 2,
  low: 1
};

function compareRecommendations(a: Recommendation, b: Recommendation): number {
  const priorityDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  const actionKeyDiff = a.actionKey.localeCompare(b.actionKey);
  if (actionKeyDiff !== 0) {
    return actionKeyDiff;
  }

  return a.id.localeCompare(b.id);
}

function shouldReplace(existing: Recommendation, candidate: Recommendation): boolean {
  const existingRank = PRIORITY_WEIGHT[existing.priority];
  const candidateRank = PRIORITY_WEIGHT[candidate.priority];

  if (candidateRank !== existingRank) {
    return candidateRank > existingRank;
  }

  return compareRecommendations(candidate, existing) < 0;
}

function scoreGap(score: number, threshold: number): number {
  return Math.max(0, threshold - score);
}

function recommendationId(repositoryId: string, actionKey: string): string {
  return `${repositoryId}:${actionKey}`;
}

export function buildRepositoryRecommendations(
  repositoryId: string,
  categoryScores: CategoryScore[],
  completeness: number
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const rule of RECOMMENDATION_RULES) {
    const category = categoryScores.find((value) => value.category === rule.category);
    if (!category) {
      continue;
    }

    if (category.score < rule.threshold) {
      const gap = scoreGap(category.score, rule.threshold);
      recommendations.push({
        id: recommendationId(repositoryId, rule.actionKey),
        actionKey: rule.actionKey,
        category: rule.category,
        priority: gap >= 18 ? "high" : rule.priority,
        title: rule.title,
        description: `${rule.description} Current ${rule.category} score: ${category.score}.`
      });
    }
  }

  if (completeness < 0.75) {
    recommendations.push({
      id: recommendationId(repositoryId, "data-completeness"),
      actionKey: "data-completeness",
      category: "repository-health",
      priority: "high",
      title: "Improve Data Completeness",
      description: "Several scoring metrics are missing. Ensure telemetry and policy signals are available."
    });
  }

  return recommendations.sort(compareRecommendations).slice(0, 5);
}

export function buildOrganizationRecommendations(
  repositoryScores: RepositoryHealthScore[]
): Recommendation[] {
  const dedup = new Map<string, Recommendation>();

  for (const repositoryScore of repositoryScores) {
    for (const recommendation of repositoryScore.recommendations) {
      const existing = dedup.get(recommendation.actionKey);
      if (!existing) {
        dedup.set(recommendation.actionKey, recommendation);
        continue;
      }

      if (shouldReplace(existing, recommendation)) {
        dedup.set(recommendation.actionKey, recommendation);
      }
    }
  }

  return [...dedup.values()].sort(compareRecommendations).slice(0, 6);
}
