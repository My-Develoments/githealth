import type { HealthCategoryKey, HealthMetricDefinition, RepositoryImportance } from "./types.js";

export const SCORING_VERSION = "1.0.0";

export const CATEGORY_WEIGHTS: Record<HealthCategoryKey, number> = {
  "repository-health": 0.25,
  security: 0.25,
  governance: 0.2,
  cicd: 0.15,
  "quality-maintenance": 0.15
};

export const REPOSITORY_IMPORTANCE_MULTIPLIER: Record<RepositoryImportance, number> = {
  important: 1,
  medium: 0.7,
  support: 0.4
};

export const METRIC_DEFINITIONS: HealthMetricDefinition[] = [
  {
    key: "repo_signal_coverage",
    label: "Repository Signal Coverage",
    category: "repository-health",
    weight: 0.55,
    min: 0,
    max: 100,
    direction: "higher-is-better"
  },
  {
    key: "repo_activity_recency_days",
    label: "Activity Recency (Days)",
    category: "repository-health",
    weight: 0.45,
    min: 0,
    max: 30,
    direction: "lower-is-better"
  },
  {
    key: "security_alerts_open",
    label: "Open Security Alerts",
    category: "security",
    weight: 0.5,
    min: 0,
    max: 20,
    direction: "lower-is-better"
  },
  {
    key: "vuln_resolution_rate",
    label: "Vulnerability Resolution Rate",
    category: "security",
    weight: 0.5,
    min: 0,
    max: 100,
    direction: "higher-is-better"
  },
  {
    key: "branch_protection_coverage",
    label: "Branch Protection Coverage",
    category: "governance",
    weight: 0.5,
    min: 0,
    max: 100,
    direction: "higher-is-better"
  },
  {
    key: "review_compliance_rate",
    label: "Review Compliance Rate",
    category: "governance",
    weight: 0.5,
    min: 0,
    max: 100,
    direction: "higher-is-better"
  },
  {
    key: "ci_success_rate",
    label: "CI Success Rate",
    category: "cicd",
    weight: 0.65,
    min: 0,
    max: 100,
    direction: "higher-is-better"
  },
  {
    key: "deployment_frequency_weekly",
    label: "Weekly Deployments",
    category: "cicd",
    weight: 0.35,
    min: 0,
    max: 30,
    direction: "higher-is-better"
  },
  {
    key: "test_coverage",
    label: "Test Coverage",
    category: "quality-maintenance",
    weight: 0.4,
    min: 0,
    max: 100,
    direction: "higher-is-better"
  },
  {
    key: "dependency_freshness",
    label: "Dependency Freshness",
    category: "quality-maintenance",
    weight: 0.35,
    min: 0,
    max: 100,
    direction: "higher-is-better"
  },
  {
    key: "issue_hygiene",
    label: "Issue Hygiene",
    category: "quality-maintenance",
    weight: 0.25,
    min: 0,
    max: 100,
    direction: "higher-is-better"
  }
];

export const ALL_CATEGORIES: HealthCategoryKey[] = [
  "repository-health",
  "security",
  "governance",
  "cicd",
  "quality-maintenance"
];
