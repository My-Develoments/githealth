import { ALL_CATEGORIES, CATEGORY_WEIGHTS, METRIC_DEFINITIONS, REPOSITORY_IMPORTANCE_MULTIPLIER, SCORING_VERSION } from "./constants.js";
import { normalizeMetric } from "./normalize.js";
import {
  buildOrganizationRecommendations,
  buildRepositoryRecommendations
} from "./recommendations.js";
import type {
  CategoryScore,
  HealthCategoryKey,
  OrganizationHealthScore,
  OrganizationInput,
  RepositoryHealthScore,
  RepositoryInput,
  ScoreContribution,
  ValidationIssue
} from "./types.js";
import { clamp, ratio, roundScore } from "./utils.js";

type CategoryComputation = {
  categoryScore: CategoryScore;
  issues: ValidationIssue[];
  rawScore: number;
  rawCompleteness: number;
};

type ScoreOrganizationOptions = {
  calculatedAt?: string;
};

function contributionRationale(category: HealthCategoryKey, normalizedValue: number): string {
  if (normalizedValue >= 0.85) {
    return `${category} signal is performing strongly.`;
  }
  if (normalizedValue <= 0.35) {
    return `${category} signal is underperforming and requires attention.`;
  }
  return `${category} signal is stable but has room for improvement.`;
}

function computeCategoryScore(repository: RepositoryInput, category: HealthCategoryKey): CategoryComputation {
  const definitions = METRIC_DEFINITIONS.filter((definition) => definition.category === category);

  let weightedSum = 0;
  let weightSum = 0;
  let metricsMissing = 0;
  const contributions: ScoreContribution[] = [];
  const issues: ValidationIssue[] = [];

  for (const definition of definitions) {
    const normalization = normalizeMetric(repository.metrics[definition.key], definition, repository.id);
    issues.push(...normalization.issues);

    if (normalization.value === null) {
      metricsMissing += 1;
      continue;
    }

    const weightedImpact = normalization.value * definition.weight;
    weightedSum += weightedImpact;
    weightSum += definition.weight;

    contributions.push({
      metricKey: definition.key,
      metricLabel: definition.label,
      category,
      metricWeight: definition.weight,
      normalizedValue: normalization.value,
      weightedImpact,
      rationale: contributionRationale(category, normalization.value)
    });
  }

  const normalizedScore = weightSum > 0 ? weightedSum / weightSum : 0;
  const categoryScore = normalizedScore * 100;
  const metricsConsidered = definitions.length - metricsMissing;
  const completeness = ratio(metricsConsidered, definitions.length);

  return {
    categoryScore: {
      category,
      score: roundScore(categoryScore),
      completeness: Number(completeness.toFixed(4)),
      metricsConsidered,
      metricsMissing,
      contributions
    },
    issues,
    rawScore: categoryScore,
    rawCompleteness: completeness
  };
}

function weightedPositiveImpact(contribution: ScoreContribution): number {
  return CATEGORY_WEIGHTS[contribution.category] * contribution.metricWeight * contribution.normalizedValue;
}

function weightedNegativeImpact(contribution: ScoreContribution): number {
  return CATEGORY_WEIGHTS[contribution.category] * contribution.metricWeight * (1 - contribution.normalizedValue);
}

function splitContributions(contributions: ScoreContribution[]): {
  positive: ScoreContribution[];
  negative: ScoreContribution[];
} {
  const positive = [...contributions]
    .sort((a, b) => {
      const impactDiff = weightedPositiveImpact(b) - weightedPositiveImpact(a);
      if (impactDiff !== 0) {
        return impactDiff;
      }
      return a.metricKey.localeCompare(b.metricKey);
    })
    .slice(0, 4);

  const negative = [...contributions]
    .sort((a, b) => {
      const impactDiff = weightedNegativeImpact(b) - weightedNegativeImpact(a);
      if (impactDiff !== 0) {
        return impactDiff;
      }
      return a.metricKey.localeCompare(b.metricKey);
    })
    .slice(0, 4);

  return { positive, negative };
}

export function scoreRepository(input: RepositoryInput): RepositoryHealthScore {
  const categoryResults = ALL_CATEGORIES.map((category) => computeCategoryScore(input, category));
  const categories = categoryResults.map((result) => result.categoryScore);
  const validationIssues = categoryResults.flatMap((result) => result.issues);

  const rawCategoryScore = categoryResults.reduce<Record<HealthCategoryKey, number>>((acc, result) => {
    acc[result.categoryScore.category] = result.rawScore;
    return acc;
  }, {
    "repository-health": 0,
    security: 0,
    governance: 0,
    cicd: 0,
    "quality-maintenance": 0
  });

  const weightedCategoryTotal = categoryResults.reduce((sum, result) => {
    return sum + (result.rawScore / 100) * CATEGORY_WEIGHTS[result.categoryScore.category];
  }, 0);

  const weightedCompleteness = categoryResults.reduce((sum, result) => {
    return sum + result.rawCompleteness * CATEGORY_WEIGHTS[result.categoryScore.category];
  }, 0);

  const completenessPenaltyMultiplier = 0.8 + 0.2 * clamp(weightedCompleteness, 0, 1);
  const overallScoreRaw = weightedCategoryTotal * 100 * completenessPenaltyMultiplier;
  const overallScore = roundScore(overallScoreRaw);

  const allContributions = categories.flatMap((category) => category.contributions);
  const { positive, negative } = splitContributions(allContributions);

  const recommendations = buildRepositoryRecommendations(
    input.id,
    categories,
    weightedCompleteness
  );

  return {
    repositoryId: input.id,
    repositoryName: input.name,
    importance: input.importance,
    overallScore,
    categories,
    completeness: Number(weightedCompleteness.toFixed(4)),
    positiveContributors: positive,
    negativeContributors: negative,
    recommendations,
    validationIssues,
    _internal: {
      overallScoreRaw,
      completenessRaw: weightedCompleteness,
      categoryScoreRaw: rawCategoryScore
    }
  };
}

function aggregateCategoryScores(repositoryScores: RepositoryHealthScore[]): CategoryScore[] {
  return ALL_CATEGORIES.map((category) => {
    let weightedScore = 0;
    let weightedCompleteness = 0;
    let weightSum = 0;
    let metricsConsidered = 0;
    let metricsMissing = 0;
    const contributions: ScoreContribution[] = [];

    for (const repositoryScore of repositoryScores) {
      const categoryScore = repositoryScore.categories.find((value) => value.category === category);
      if (!categoryScore) {
        continue;
      }

      const repoWeight = REPOSITORY_IMPORTANCE_MULTIPLIER[repositoryScore.importance];
      const rawCategoryScore = repositoryScore._internal?.categoryScoreRaw[category] ?? categoryScore.score;
      weightedScore += rawCategoryScore * repoWeight;
      weightedCompleteness += categoryScore.completeness * repoWeight;
      weightSum += repoWeight;
      metricsConsidered += categoryScore.metricsConsidered;
      metricsMissing += categoryScore.metricsMissing;

      contributions.push(
        ...categoryScore.contributions.map((contribution) => ({
          ...contribution,
          weightedImpact: contribution.weightedImpact * repoWeight
        }))
      );
    }

    const score = weightSum > 0 ? roundScore(weightedScore / weightSum) : 0;
    const completeness = weightSum > 0 ? Number((weightedCompleteness / weightSum).toFixed(4)) : 0;

    return {
      category,
      score,
      completeness,
      metricsConsidered,
      metricsMissing,
      contributions
    };
  });
}

export function scoreOrganization(
  input: OrganizationInput,
  options?: ScoreOrganizationOptions
): {
  organizationScore: OrganizationHealthScore;
  repositoryScores: RepositoryHealthScore[];
} {
  const calculatedAt = options?.calculatedAt ?? new Date().toISOString();

  if (input.repositories.length === 0) {
    const organizationScore: OrganizationHealthScore = {
      organizationId: input.id,
      organizationName: input.name,
      overallScore: 0,
      categories: ALL_CATEGORIES.map((category) => ({
        category,
        score: 0,
        completeness: 0,
        metricsConsidered: 0,
        metricsMissing: 0,
        contributions: []
      })),
      completeness: 0,
      repositoryCount: 0,
      positiveContributors: [],
      negativeContributors: [],
      recommendations: [
        {
          id: `${input.id}:empty-repository-set`,
          actionKey: "empty-repository-set",
          category: "repository-health",
          priority: "high",
          title: "No Repository Data Available",
          description: "Repository scoring input is empty. Provide deterministic repository fixtures first."
        }
      ],
      validationIssues: [
        {
          scope: "organization",
          code: "ORGANIZATION_EMPTY",
          message: "Organization has no repositories for scoring."
        }
      ],
      scoringVersion: SCORING_VERSION,
      calculatedAt
    };

    return {
      organizationScore,
      repositoryScores: []
    };
  }

  const repositoryScores = input.repositories.map((repository) => scoreRepository(repository));

  let weightedTotal = 0;
  let weightedCompleteness = 0;
  let weightSum = 0;

  for (const repositoryScore of repositoryScores) {
    const weight = REPOSITORY_IMPORTANCE_MULTIPLIER[repositoryScore.importance];
    weightedTotal += (repositoryScore._internal?.overallScoreRaw ?? repositoryScore.overallScore) * weight;
    weightedCompleteness += (repositoryScore._internal?.completenessRaw ?? repositoryScore.completeness) * weight;
    weightSum += weight;
  }

  const overallScore = weightSum > 0 ? roundScore(weightedTotal / weightSum) : 0;
  const completeness = weightSum > 0 ? Number((weightedCompleteness / weightSum).toFixed(4)) : 0;

  const categories = aggregateCategoryScores(repositoryScores);
  const allContributions = categories.flatMap((category) => category.contributions);
  const { positive, negative } = splitContributions(allContributions);

  const recommendations = buildOrganizationRecommendations(repositoryScores);
  const validationIssues = repositoryScores.flatMap((repositoryScore) => repositoryScore.validationIssues);

  const organizationScore: OrganizationHealthScore = {
    organizationId: input.id,
    organizationName: input.name,
    overallScore,
    categories,
    completeness,
    repositoryCount: repositoryScores.length,
    positiveContributors: positive,
    negativeContributors: negative,
    recommendations,
    validationIssues,
    scoringVersion: SCORING_VERSION,
    calculatedAt
  };

  return {
    organizationScore,
    repositoryScores
  };
}
