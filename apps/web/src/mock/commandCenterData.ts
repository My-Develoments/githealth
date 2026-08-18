export type NavItem = {
  id: string;
  label: string;
  active?: boolean;
};

export type CategorySignal = {
  key: string;
  label: string;
  score: number;
  tone: "healthy" | "warning" | "critical" | "neutral" | "unknown";
  trend: string;
  sparkline: number[];
};

export type Insight = {
  id: string;
  title: string;
  repositories: number;
  impact: "High" | "Medium" | "Low";
  tone: "critical" | "warning" | "neutral";
  action: string;
};

export type RepoNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  tone: "healthy" | "warning" | "critical" | "neutral";
  group: "platform" | "application" | "service";
};

export type RepoConnection = {
  from: string;
  to: string;
  strength: "low" | "medium" | "high";
};

export type ScanStage = {
  id: string;
  label: string;
};

export type Achievement = {
  id: string;
  title: string;
  detail: string;
  tone: "healthy" | "warning" | "critical" | "neutral";
  progress: number;
  xpGain: string;
};

export type RecentActivity = {
  id: string;
  event: string;
  context: string;
  when: string;
  tone: "healthy" | "warning" | "critical" | "neutral";
};

export const navItems: NavItem[] = [
  { id: "command-center", label: "Command Center", active: true },
  { id: "repository-universe", label: "Repository Universe" },
  { id: "security", label: "Security" },
  { id: "governance", label: "Governance" },
  { id: "cicd", label: "CI / CD" },
  { id: "health-intelligence", label: "Health Intelligence" },
  { id: "reports", label: "Reports" },
  { id: "settings", label: "Settings" }
];

export const categorySignals: CategorySignal[] = [
  { key: "security", label: "Security", score: 94, tone: "healthy", trend: "+2.1%", sparkline: [62, 64, 63, 68, 71, 72, 76] },
  {
    key: "governance",
    label: "Governance",
    score: 86,
    tone: "healthy",
    trend: "+1.3%",
    sparkline: [54, 56, 58, 57, 60, 62, 64]
  },
  { key: "cicd", label: "CI / CD", score: 81, tone: "neutral", trend: "+0.8%", sparkline: [48, 46, 51, 53, 52, 56, 58] },
  { key: "quality", label: "Quality", score: 89, tone: "healthy", trend: "+2.8%", sparkline: [57, 59, 62, 64, 66, 67, 70] }
];

export const insights: Insight[] = [
  {
    id: "branch-protection",
    title: "4 repositories lack branch protection",
    repositories: 4,
    impact: "High",
    tone: "critical",
    action: "Enable mandatory reviews and status checks"
  },
  {
    id: "codeql",
    title: "CodeQL is not enabled on 2 repositories",
    repositories: 2,
    impact: "Medium",
    tone: "warning",
    action: "Activate CodeQL workflow in security baseline"
  },
  {
    id: "dependencies",
    title: "3 repositories have outdated dependencies",
    repositories: 3,
    impact: "Medium",
    tone: "warning",
    action: "Run dependency refresh and enforce monthly cadence"
  }
];

export const repoNodes: RepoNode[] = [
  { id: "frontend-web", label: "Frontend Web", x: 17, y: 46, tone: "healthy", group: "application" },
  { id: "api-gateway", label: "API Gateway", x: 36, y: 29, tone: "healthy", group: "platform" },
  { id: "core-libraries", label: "Core Libraries", x: 50, y: 71, tone: "neutral", group: "platform" },
  { id: "mobile-app", label: "Mobile App", x: 77, y: 41, tone: "neutral", group: "application" },
  { id: "admin-panel", label: "Admin Panel", x: 69, y: 63, tone: "critical", group: "application" },
  { id: "authentication", label: "Authentication", x: 29, y: 61, tone: "warning", group: "service" },
  { id: "analytics", label: "Analytics", x: 58, y: 24, tone: "healthy", group: "service" },
  { id: "infra-tools", label: "Infra Tools", x: 82, y: 56, tone: "warning", group: "platform" }
];

export const repoConnections: RepoConnection[] = [
  { from: "api-gateway", to: "frontend-web", strength: "high" },
  { from: "api-gateway", to: "mobile-app", strength: "high" },
  { from: "api-gateway", to: "authentication", strength: "medium" },
  { from: "api-gateway", to: "core-libraries", strength: "medium" },
  { from: "core-libraries", to: "admin-panel", strength: "low" },
  { from: "core-libraries", to: "infra-tools", strength: "medium" },
  { from: "analytics", to: "admin-panel", strength: "low" }
];

export const scanStages: ScanStage[] = [
  { id: "inventory", label: "Scanning repository inventory" },
  { id: "signals", label: "Reviewing health signals" },
  { id: "security", label: "Checking security posture" },
  { id: "governance", label: "Auditing governance" },
  { id: "cicd", label: "Evaluating CI/CD quality" },
  { id: "score", label: "Calculating organizational health" }
];

export const pulseSeries = [62, 60, 64, 67, 63, 70, 72, 69, 74, 71, 77, 80, 78, 82, 87];

export const healthTrend30Day = [
  63, 64, 62, 65, 67, 66, 68, 69, 67, 70, 71, 72, 73, 71, 72,
  74, 75, 73, 76, 77, 78, 79, 80, 79, 81, 82, 83, 84, 85, 87
];

export const healthTrendLabels = ["Day 1", "Day 10", "Day 20", "Day 30"];

export const healthTrendKeyPoints = [0, 9, 19, 29];

export const achievements: Achievement[] = [
  {
    id: "security-champion",
    title: "Security Champion",
    detail: "12 repos with advanced security policies",
    tone: "healthy",
    progress: 92,
    xpGain: "+240 XP"
  },
  {
    id: "cicd-master",
    title: "CI/CD Master",
    detail: "97% successful deployment runs in last cycle",
    tone: "neutral",
    progress: 86,
    xpGain: "+180 XP"
  },
  {
    id: "governance-guardian",
    title: "Governance Guardian",
    detail: "Policy compliance improved by 14%",
    tone: "healthy",
    progress: 78,
    xpGain: "+120 XP"
  },
  {
    id: "zero-critical",
    title: "Zero Critical Issues",
    detail: "Core platform repos stayed critical-free for 21 days",
    tone: "healthy",
    progress: 100,
    xpGain: "+300 XP"
  }
];

export const recentEngineeringActivity: RecentActivity[] = [
  {
    id: "scan-complete",
    event: "Organization scan completed",
    context: "24 repositories evaluated across security and governance",
    when: "2m ago",
    tone: "healthy"
  },
  {
    id: "codeql-enabled",
    event: "CodeQL enabled",
    context: "Activated for api-gateway and mobile-app",
    when: "14m ago",
    tone: "neutral"
  },
  {
    id: "branch-protection",
    event: "Branch protection updated",
    context: "Main branch now requires 2 approvals",
    when: "31m ago",
    tone: "healthy"
  },
  {
    id: "dependency-update",
    event: "Dependency update merged",
    context: "14 security patches shipped in core-libraries",
    when: "1h ago",
    tone: "warning"
  }
];

export const commandCenterData = {
  userName: "Kuldeep",
  organization: "GitHealth Labs",
  score: 87,
  scoreStatus: "Excellent",
  scoreTrend: "+4.8%",
  scoreTrendContext: "vs last month",
  totalRepositories: 24,
  periodLabel: "This Month",
  pulse: {
    healthy: 18,
    warning: 4,
    critical: 2,
    lastScan: "2 min ago"
  },
  activity: {
    isLoading: true,
    isEmpty: false,
    hasError: true
  }
} as const;
