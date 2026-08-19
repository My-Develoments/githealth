export type HealthStatus = "healthy" | "needs-attention" | "critical" | "no-data";
export type RepoImportance = "important" | "medium" | "support";

export type UniverseRepository = {
  id: string;
  name: string;
  healthScore: number;
  status: HealthStatus;
  importance: RepoImportance;
  kind: "application" | "service" | "platform" | "data";
  x: number;
  y: number;
  securityScore: number;
  governanceScore: number;
  cicdScore: number;
  qualityScore: number;
  openIssues: number;
  pullRequests: number;
  securityAlerts: number;
  dependencies: number;
  lastActivity: string;
  trend: number[];
  operationalDataAvailable?: boolean;
  trendDataAvailable?: boolean;
  cicdTelemetry?: {
    ciSuccessRate?: number;
    deploymentFrequencyWeekly?: number;
    workflowFailureRate?: number;
    runSummary: {
      totalRuns: number;
      completedRuns: number;
      successCount: number;
      failureCount: number;
      successRate?: number;
      failureRate?: number;
      latestRunAt?: string;
    };
    recentRuns: Array<{
      id?: number;
      name: string;
      status: string;
      conclusion?: string;
      event?: string;
      branch?: string;
      runNumber?: number;
      createdAt?: string;
      updatedAt?: string;
      url?: string;
    }>;
  };
  topProblems: string[];
  recommendations: string[];
};

export type UniverseConnection = {
  from: string;
  to: string;
  strength: "low" | "medium" | "high";
};

export type UniverseInsight = {
  id: string;
  label: string;
  value: string;
  tone: HealthStatus;
};

export type UniverseActivity = {
  id: string;
  event: string;
  context: string;
  when: string;
  tone: HealthStatus;
};

export const universeOrganization = {
  name: "GitHealth Labs",
  score: 87,
  status: "excellent",
  repositories: 14
} as const;

export const universeRepositories: UniverseRepository[] = [
  {
    id: "frontend-web",
    name: "frontend-web",
    healthScore: 94,
    status: "healthy",
    importance: "important",
    kind: "application",
    x: 290,
    y: 250,
    securityScore: 96,
    governanceScore: 92,
    cicdScore: 91,
    qualityScore: 95,
    openIssues: 12,
    pullRequests: 3,
    securityAlerts: 0,
    dependencies: 145,
    lastActivity: "12 min ago",
    trend: [80, 82, 84, 85, 87, 90, 92, 94],
    topProblems: ["2 minor lint violations", "1 flaky integration test"],
    recommendations: ["Stabilize flaky integration test", "Close stale feature branch PR"]
  },
  {
    id: "api-gateway",
    name: "api-gateway",
    healthScore: 91,
    status: "healthy",
    importance: "important",
    kind: "service",
    x: 470,
    y: 165,
    securityScore: 93,
    governanceScore: 90,
    cicdScore: 94,
    qualityScore: 88,
    openIssues: 18,
    pullRequests: 6,
    securityAlerts: 1,
    dependencies: 182,
    lastActivity: "8 min ago",
    trend: [76, 77, 79, 80, 82, 86, 89, 91],
    topProblems: ["1 medium vulnerability", "Review queue delay"],
    recommendations: ["Patch express transitive dependency", "Set PR review SLA alerts"]
  },
  {
    id: "auth-service",
    name: "auth-service",
    healthScore: 88,
    status: "healthy",
    importance: "medium",
    kind: "service",
    x: 300,
    y: 400,
    securityScore: 90,
    governanceScore: 87,
    cicdScore: 88,
    qualityScore: 87,
    openIssues: 14,
    pullRequests: 4,
    securityAlerts: 1,
    dependencies: 133,
    lastActivity: "33 min ago",
    trend: [72, 75, 77, 80, 82, 84, 86, 88],
    topProblems: ["Token refresh edge-case"],
    recommendations: ["Add token rotation regression test"]
  },
  {
    id: "mobile-app",
    name: "mobile-app",
    healthScore: 85,
    status: "needs-attention",
    importance: "important",
    kind: "application",
    x: 700,
    y: 245,
    securityScore: 84,
    governanceScore: 82,
    cicdScore: 89,
    qualityScore: 84,
    openIssues: 29,
    pullRequests: 8,
    securityAlerts: 2,
    dependencies: 203,
    lastActivity: "26 min ago",
    trend: [71, 72, 74, 73, 76, 80, 82, 85],
    topProblems: ["2 medium vulnerabilities", "Device test coverage gap"],
    recommendations: ["Enable CodeQL in mobile pipeline", "Expand device matrix tests"]
  },
  {
    id: "admin-panel",
    name: "admin-panel",
    healthScore: 62,
    status: "critical",
    importance: "important",
    kind: "application",
    x: 690,
    y: 420,
    securityScore: 58,
    governanceScore: 65,
    cicdScore: 63,
    qualityScore: 61,
    openIssues: 67,
    pullRequests: 17,
    securityAlerts: 9,
    dependencies: 245,
    lastActivity: "1 h ago",
    trend: [76, 74, 71, 69, 67, 65, 64, 62],
    topProblems: ["9 security alerts", "Missing branch protection", "High flaky test rate"],
    recommendations: ["Apply emergency security patch set", "Enforce branch protection immediately"]
  },
  {
    id: "core-libraries",
    name: "core-libraries",
    healthScore: 89,
    status: "healthy",
    importance: "medium",
    kind: "platform",
    x: 520,
    y: 470,
    securityScore: 92,
    governanceScore: 88,
    cicdScore: 87,
    qualityScore: 90,
    openIssues: 22,
    pullRequests: 5,
    securityAlerts: 0,
    dependencies: 156,
    lastActivity: "49 min ago",
    trend: [78, 79, 81, 83, 84, 86, 88, 89],
    topProblems: ["Dependabot backlog"],
    recommendations: ["Reduce dependency update queue"]
  },
  {
    id: "analytics-engine",
    name: "analytics-engine",
    healthScore: 83,
    status: "needs-attention",
    importance: "medium",
    kind: "data",
    x: 620,
    y: 150,
    securityScore: 81,
    governanceScore: 85,
    cicdScore: 82,
    qualityScore: 84,
    openIssues: 31,
    pullRequests: 9,
    securityAlerts: 2,
    dependencies: 174,
    lastActivity: "19 min ago",
    trend: [70, 72, 73, 75, 77, 79, 81, 83],
    topProblems: ["Data validation warnings"],
    recommendations: ["Harden schema checks for ingestion pipeline"]
  },
  {
    id: "infra-tools",
    name: "infra-tools",
    healthScore: 79,
    status: "needs-attention",
    importance: "support",
    kind: "platform",
    x: 800,
    y: 320,
    securityScore: 78,
    governanceScore: 80,
    cicdScore: 79,
    qualityScore: 77,
    openIssues: 24,
    pullRequests: 7,
    securityAlerts: 3,
    dependencies: 138,
    lastActivity: "42 min ago",
    trend: [71, 72, 71, 73, 75, 76, 78, 79],
    topProblems: ["Pipeline secret rotation lag"],
    recommendations: ["Rotate stale CI credentials"]
  },
  {
    id: "governance-rules",
    name: "governance-rules",
    healthScore: 90,
    status: "healthy",
    importance: "support",
    kind: "platform",
    x: 360,
    y: 135,
    securityScore: 91,
    governanceScore: 94,
    cicdScore: 88,
    qualityScore: 89,
    openIssues: 8,
    pullRequests: 2,
    securityAlerts: 0,
    dependencies: 98,
    lastActivity: "5 min ago",
    trend: [81, 82, 83, 85, 86, 88, 89, 90],
    topProblems: ["Minor policy drift warnings"],
    recommendations: ["Finalize branch-policy parity checks"]
  },
  {
    id: "security-audit",
    name: "security-audit",
    healthScore: 74,
    status: "needs-attention",
    importance: "support",
    kind: "service",
    x: 220,
    y: 310,
    securityScore: 70,
    governanceScore: 77,
    cicdScore: 74,
    qualityScore: 75,
    openIssues: 39,
    pullRequests: 11,
    securityAlerts: 6,
    dependencies: 161,
    lastActivity: "1 h ago",
    trend: [79, 78, 77, 76, 75, 75, 74, 74],
    topProblems: ["6 unresolved alerts", "Outdated SAST rules"],
    recommendations: ["Refresh SAST ruleset", "Resolve top 3 CVEs"]
  },
  {
    id: "notifications",
    name: "notifications",
    healthScore: 86,
    status: "healthy",
    importance: "support",
    kind: "service",
    x: 220,
    y: 470,
    securityScore: 87,
    governanceScore: 86,
    cicdScore: 85,
    qualityScore: 87,
    openIssues: 11,
    pullRequests: 3,
    securityAlerts: 1,
    dependencies: 107,
    lastActivity: "17 min ago",
    trend: [76, 78, 79, 80, 82, 83, 84, 86],
    topProblems: ["Queue retry spike"],
    recommendations: ["Tune retry backoff strategy"]
  },
  {
    id: "docs-portal",
    name: "docs-portal",
    healthScore: 68,
    status: "no-data",
    importance: "support",
    kind: "application",
    x: 820,
    y: 470,
    securityScore: 0,
    governanceScore: 0,
    cicdScore: 0,
    qualityScore: 0,
    openIssues: 4,
    pullRequests: 1,
    securityAlerts: 0,
    dependencies: 44,
    lastActivity: "3 d ago",
    trend: [68, 68, 68, 68, 68, 68, 68, 68],
    topProblems: ["No recent scan data available"],
    recommendations: ["Reconnect repository scan permissions"]
  },
  {
    id: "data-pipeline",
    name: "data-pipeline",
    healthScore: 82,
    status: "needs-attention",
    importance: "medium",
    kind: "data",
    x: 560,
    y: 110,
    securityScore: 80,
    governanceScore: 83,
    cicdScore: 84,
    qualityScore: 81,
    openIssues: 27,
    pullRequests: 6,
    securityAlerts: 2,
    dependencies: 190,
    lastActivity: "37 min ago",
    trend: [75, 76, 77, 79, 80, 81, 81, 82],
    topProblems: ["Schema mismatch incidents"],
    recommendations: ["Add pre-ingestion schema guardrail"]
  },
  {
    id: "billing-service",
    name: "billing-service",
    healthScore: 77,
    status: "needs-attention",
    importance: "medium",
    kind: "service",
    x: 780,
    y: 185,
    securityScore: 76,
    governanceScore: 79,
    cicdScore: 78,
    qualityScore: 75,
    openIssues: 34,
    pullRequests: 10,
    securityAlerts: 4,
    dependencies: 201,
    lastActivity: "54 min ago",
    trend: [72, 73, 74, 75, 76, 76, 77, 77],
    topProblems: ["Delayed release gates"],
    recommendations: ["Increase CI parallelization for payments suite"]
  }
];

export const universeConnections: UniverseConnection[] = [
  { from: "frontend-web", to: "api-gateway", strength: "high" },
  { from: "mobile-app", to: "api-gateway", strength: "high" },
  { from: "admin-panel", to: "api-gateway", strength: "high" },
  { from: "api-gateway", to: "auth-service", strength: "high" },
  { from: "api-gateway", to: "billing-service", strength: "medium" },
  { from: "api-gateway", to: "analytics-engine", strength: "medium" },
  { from: "analytics-engine", to: "data-pipeline", strength: "high" },
  { from: "core-libraries", to: "frontend-web", strength: "medium" },
  { from: "core-libraries", to: "mobile-app", strength: "medium" },
  { from: "core-libraries", to: "admin-panel", strength: "medium" },
  { from: "security-audit", to: "governance-rules", strength: "medium" },
  { from: "security-audit", to: "api-gateway", strength: "low" },
  { from: "infra-tools", to: "api-gateway", strength: "low" },
  { from: "notifications", to: "api-gateway", strength: "low" },
  { from: "docs-portal", to: "frontend-web", strength: "low" }
];

export const universeTopInsights: UniverseInsight[] = [
  {
    id: "highest-risk",
    label: "Highest Risk Repository",
    value: "admin-panel (62)",
    tone: "critical"
  },
  {
    id: "critical-alerts",
    label: "Critical Security Alerts",
    value: "9 alerts in admin-panel",
    tone: "critical"
  },
  {
    id: "needs-attention",
    label: "Repositories Needing Attention",
    value: "6 repositories",
    tone: "needs-attention"
  },
  {
    id: "next-action",
    label: "Recommended Next Action",
    value: "Patch admin-panel and enforce branch protection",
    tone: "healthy"
  }
];

export const universeRecentActivity: UniverseActivity[] = [
  {
    id: "scan",
    event: "Repository scan completed",
    context: "14 repositories analyzed across security and governance",
    when: "2m ago",
    tone: "healthy"
  },
  {
    id: "codeql",
    event: "CodeQL enabled",
    context: "mobile-app and api-gateway now report advanced scans",
    when: "18m ago",
    tone: "healthy"
  },
  {
    id: "branch",
    event: "Branch protection updated",
    context: "auth-service requires 2 approvals before merge",
    when: "41m ago",
    tone: "healthy"
  },
  {
    id: "dependency",
    event: "Dependency update merged",
    context: "core-libraries updated 16 packages",
    when: "1h ago",
    tone: "needs-attention"
  }
];

export const universeFilters = [
  { id: "all", label: "All" },
  { id: "healthy", label: "Healthy" },
  { id: "needs-attention", label: "Needs Attention" },
  { id: "critical", label: "Critical" },
  { id: "no-data", label: "No Data" }
] as const;

export const universeDomainFilters = [
  { id: "all", label: "All Domains" },
  { id: "security", label: "Security" },
  { id: "governance", label: "Governance" },
  { id: "cicd", label: "CI/CD" },
  { id: "quality", label: "Quality" }
] as const;

export function statusLabel(status: HealthStatus): string {
  if (status === "needs-attention") {
    return "Needs Attention";
  }
  if (status === "no-data") {
    return "No Data";
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
}
