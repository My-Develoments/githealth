import { Badge, Button, Heading, Panel, Text } from "@githealth/ui";
import { useEffect, useMemo, useState } from "react";
import {
  achievements,
  commandCenterData,
  healthTrendKeyPoints,
  healthTrend30Day,
  healthTrendLabels,
  navItems,
  pulseSeries,
  recentEngineeringActivity as recentEngineeringActivityDefaults,
  repoConnections,
  repoNodes,
  scanStages
} from "../mock/commandCenterData";
import type {
  CommandCenterActivityState,
  CommandCenterHealthViewModel
} from "../data/githubHealthViewMappers";
import type { GitHubConnectionViewModel } from "../data/githubHealthContracts";
import type { AppScreen } from "../navigation";
import { useAsyncActionState } from "./useAsyncActionState";
import "./command-center.css";

function resolveConnectionTone(status: GitHubConnectionViewModel["status"]): "healthy" | "warning" | "neutral" | "critical" | "unknown" {
  if (status === "connected") {
    return "healthy";
  }

  if (status === "installation_completed") {
    return "healthy";
  }

  if (status === "ready_to_connect" || status === "connecting") {
    return "neutral";
  }

  if (status === "error" || status === "unauthorized_installation") {
    return "critical";
  }

  return "unknown";
}

function resolveConnectionLabel(connection: GitHubConnectionViewModel): string {
  if (connection.provider === "pat") {
    return "Development fallback";
  }

  if (connection.status === "not_configured") {
    return "Not configured";
  }

  if (connection.status === "ready_to_connect") {
    return "Ready to connect";
  }

  if (connection.status === "installation_completed") {
    return "Installation completed";
  }

  if (connection.status === "connecting") {
    return "Connecting";
  }

  if (connection.status === "unauthorized_installation") {
    return "Unauthorized installation";
  }

  if (connection.status === "connected") {
    return "Connected";
  }

  return "Connection error";
}

function resolveConnectionActionLabel(connection: GitHubConnectionViewModel): string {
  if (connection.provider === "oauth") {
    if (connection.status === "connecting") {
      return "Connecting...";
    }

    return "Continue with GitHub";
  }

  if (connection.status === "not_configured") {
    return "GitHub App unavailable";
  }

  if (connection.status === "ready_to_connect") {
    return "Install GitHub App";
  }

  if (connection.status === "connecting") {
    return "Connecting...";
  }

  return "Connect GitHub";
}

function resolveConnectionGuidance(connection: GitHubConnectionViewModel): string {
  if (connection.provider === "oauth") {
    if (connection.status === "ready_to_connect") {
      return "Continue with GitHub to authorize your account and load your live organization health data through secure backend APIs.";
    }

    if (connection.status === "connecting") {
      return "GitHealth is preparing your secure GitHub OAuth redirect.";
    }

    if (connection.status === "connected") {
      return "Your GitHub account is connected. Live organization health data now loads through the authenticated backend session.";
    }

    if (connection.status === "error" || connection.status === "unauthorized_installation") {
      return "GitHub OAuth onboarding is currently blocked. Retry the connection check or reconnect your GitHub account.";
    }

    return "Connect your GitHub account to unlock live organization scans, health scoring, and repository insights.";
  }

  if (connection.provider === "pat") {
    return "This environment is using backend PAT fallback for development. It can support local testing, but it is not the authenticated user's GitHub identity.";
  }

  if (connection.status === "not_configured") {
    return "GitHub App onboarding is not configured for this environment yet. Live scans stay unavailable until the app setup is completed on the API deployment.";
  }

  if (connection.status === "ready_to_connect") {
    return "Install the GitHub App to unlock live organization scans, health scoring, and repository insights.";
  }

  if (connection.status === "installation_completed") {
    return "Installation completed. GitHealth is finalizing the authenticated session for live organization access.";
  }

  if (connection.status === "connected") {
    return "GitHub App authentication is active. Live organization health data is ready to scan and explore.";
  }

  if (connection.status === "unauthorized_installation") {
    return "The installed GitHub App does not match an allowed organization for this environment. Install the app for an authorized organization or update the server allowlist.";
  }

  return "GitHub App onboarding is currently blocked. Retry the connection check or reconnect the app.";
}

function renderConnectionCard(
  connection: GitHubConnectionViewModel,
  isConnectActionPending: boolean,
  onConnectAction: () => void,
  options: { className: string; tone?: "base" | "subtle" | "elevated" | "stronger" }
) {
  const showConnectAction = connection.provider !== "pat" && !connection.isConnected && connection.canConnect;

  return (
    <Panel tone={options.tone ?? "subtle"} className={options.className}>
      <div className="cc-connection-card__header">
        <div className="cc-connection-card__title-block">
          <Text size="sm" tone="muted">
            GitHub Connection
          </Text>
          <Heading as="h3" size="md">
            {connection.provider === "oauth"
              ? "GitHub OAuth Connection"
              : connection.provider === "app"
                ? "GitHub App Onboarding"
                : "Server GitHub Access"}
          </Heading>
        </div>
        <Badge tone={resolveConnectionTone(connection.status)}>{resolveConnectionLabel(connection)}</Badge>
      </div>

      <Text size="sm" tone="secondary">
        {connection.message}
      </Text>
      <Text size="sm" tone="muted">
        {resolveConnectionGuidance(connection)}
      </Text>

      <div className="cc-connection-card__meta">
        <span>Provider: {connection.provider === "oauth" ? "GitHub OAuth" : connection.provider === "app" ? "GitHub App" : "Personal access token"}</span>
        {connection.githubLogin ? <span>Account: {connection.githubLogin}</span> : null}
        <span>{connection.isConnected ? "Live access ready" : connection.canConnect ? "Action required" : "Configuration required"}</span>
      </div>

      {showConnectAction ? (
        <div className="cc-connection-card__actions">
          <Button
            variant="primary"
            size="md"
            onClick={onConnectAction}
            disabled={connection.status === "connecting" || isConnectActionPending}
            aria-label="Connect GitHub"
          >
            {isConnectActionPending ? "Connecting..." : resolveConnectionActionLabel(connection)}
          </Button>
        </div>
      ) : null}
    </Panel>
  );
}

function impactTone(impact: "High" | "Medium" | "Low"): "critical" | "warning" | "neutral" {
  if (impact === "High") {
    return "critical";
  }
  if (impact === "Medium") {
    return "warning";
  }
  return "neutral";
}

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return reducedMotion;
}

function useAnimatedNumber(target: number, durationMs: number, reducedMotion: boolean, startDelayMs = 0) {
  const [value, setValue] = useState(reducedMotion ? target : 0);

  useEffect(() => {
    if (reducedMotion) {
      setValue(target);
      return;
    }

    let raf = 0;
    const startTime = performance.now() + startDelayMs;

    const tick = (now: number) => {
      if (now < startTime) {
        raf = requestAnimationFrame(tick);
        return;
      }

      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [target, durationMs, reducedMotion, startDelayMs]);

  return value;
}

function sparklinePath(values: number[], width: number, height: number) {
  if (values.length === 0) {
    return "";
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const step = width / (values.length - 1);

  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function pulsePath(values: number[], width: number, height: number) {
  return sparklinePath(values, width, height);
}

type CommandCenterScreenProps = {
  activeNavId?: AppScreen;
  onNavigate?: (screen: AppScreen) => void;
  onExploreUniverse?: () => void;
  healthData?: CommandCenterHealthViewModel;
  activityState?: CommandCenterActivityState;
  isRefreshing?: boolean;
  connection?: GitHubConnectionViewModel;
  integrationError?: {
    message: string;
    code: string;
    status: number;
  } | null;
  onConnectGitHub?: () => void | Promise<void>;
  onRetry?: () => void;
  recentActivity?: typeof recentEngineeringActivityDefaults;
};

function resolveErrorGuidance(error: CommandCenterScreenProps["integrationError"]): { title: string; action: string } {
  if (!error) {
    return {
      title: "Live health data is currently unavailable.",
      action: "Retry the health check to refresh engineering signals."
    };
  }

  if (error.code === "AUTH_MISSING" || error.code === "AUTH_INVALID") {
    return {
      title: "GitHub authentication is required.",
      action: "Update GitHub credentials in environment configuration, then retry."
    };
  }

  if (error.code === "PERMISSION_DENIED") {
    return {
      title: "GitHub permissions are insufficient.",
      action: "Grant required read access to organization health data, then retry."
    };
  }

  if (error.code === "NOT_FOUND" || error.status === 404) {
    return {
      title: "GitHub organization or repository was not found.",
      action: "Confirm the selected organization and repository visibility, then retry the health check."
    };
  }

  if (error.code === "RATE_LIMITED") {
    return {
      title: "GitHub rate limit reached.",
      action: "Wait for the rate-limit window to reset, then retry the health check."
    };
  }

  if (error.code === "UPSTREAM_UNAVAILABLE" || error.status === 0) {
    return {
      title: "GitHub or network service is unavailable.",
      action: "Verify network/API availability and retry when connectivity is restored."
    };
  }

  return {
    title: "Unable to load live health data.",
    action: "Retry the health check. If the issue persists, inspect adapter diagnostics."
  };
}

const unavailableHealthViewModel: CommandCenterHealthViewModel = {
  source: "live",
  organization: "Unavailable",
  score: 0,
  scoreStatus: "Unavailable",
  totalRepositories: 0,
  pulse: {
    healthy: 0,
    warning: 0,
    critical: 0,
    lastScan: "Unavailable"
  },
  categorySignals: [],
  insights: [],
  fetchStatus: "failed",
  adapterIssues: []
};

export function CommandCenterScreen({
  activeNavId = "command-center",
  onNavigate,
  onExploreUniverse,
  healthData,
  activityState,
  isRefreshing = false,
  connection,
  integrationError,
  onConnectGitHub,
  onRetry,
  recentActivity
}: CommandCenterScreenProps) {
  const resolvedHealth: CommandCenterHealthViewModel = healthData ?? unavailableHealthViewModel;
  const isMockSource = resolvedHealth.source === "mock";
  const resolvedConnection: GitHubConnectionViewModel =
    connection ?? {
      provider: isMockSource ? "pat" : "app",
      status: isMockSource ? "connected" : "not_configured",
      isConnected: isMockSource,
      canConnect: false,
      hasInstallationId: false,
      installUrlConfigured: false,
      callbackRedirectConfigured: false,
      message: isMockSource ? "Mock GitHub source is active." : "GitHub connection is unavailable."
    };

  const resolvedActivity: CommandCenterActivityState =
    activityState ??
    (isMockSource
      ? {
          isLoading: commandCenterData.activity.isLoading,
          isEmpty: commandCenterData.activity.isEmpty,
          hasError: commandCenterData.activity.hasError
        }
      : {
          isLoading: true,
          isEmpty: true,
          hasError: false
        });

  const resolvedRecentActivity = recentActivity ?? (isMockSource ? recentEngineeringActivityDefaults : []);
  const reducedMotion = usePrefersReducedMotion();
  const connectAction = useAsyncActionState();
  const retryAction = useAsyncActionState();
  const errorGuidance = resolveErrorGuidance(integrationError);
  const shouldPromptConnection =
    resolvedConnection.provider !== "pat" &&
    !resolvedConnection.isConnected &&
    (resolvedConnection.status === "ready_to_connect" || resolvedConnection.status === "not_configured");
  const showLoadingPlaceholders = resolvedActivity.isLoading && !isMockSource && !isRefreshing;
  const showResolvedMetrics = !showLoadingPlaceholders && !resolvedActivity.hasError && resolvedHealth.totalRepositories > 0;
  const showErrorState = !showLoadingPlaceholders && resolvedActivity.hasError;
  const showEmptyLiveState = !showLoadingPlaceholders && !resolvedActivity.hasError && !showResolvedMetrics;

  const animatedScore = useAnimatedNumber(resolvedHealth.score, 1180, reducedMotion, 260);
  const animatedRepositories = useAnimatedNumber(resolvedHealth.totalRepositories, 960, reducedMotion, 760);

  const [activeNodeId, setActiveNodeId] = useState<string>("api-gateway");
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStageIndex, setScanStageIndex] = useState<number>(-1);
  const [scanComplete, setScanComplete] = useState(false);
  const [activeTrendIndex, setActiveTrendIndex] = useState(healthTrend30Day.length - 1);

  const activeNode = repoNodes.find((node) => node.id === activeNodeId);
  const activeNodeLabel = activeNodeId === "org-core" ? resolvedHealth.organization : activeNode?.label ?? repoNodes[0].label;
  const activeNodeGroup = activeNodeId === "org-core" ? "organization" : activeNode?.group ?? repoNodes[0].group;
  const activeNodeTone = activeNode?.tone ?? "neutral";

  const linkedNodeIds = useMemo(() => {
    const links = new Set<string>();
    repoConnections.forEach((connection) => {
      if (connection.from === activeNodeId) {
        links.add(connection.to);
      }
      if (connection.to === activeNodeId) {
        links.add(connection.from);
      }
    });
    return links;
  }, [activeNodeId]);

  const linkedCount = linkedNodeIds.size;

  useEffect(() => {
    if (!isScanning) {
      return;
    }

    setScanComplete(false);
    setScanProgress(0);
    setScanStageIndex(0);

    const totalStages = scanStages.length;
    let currentStage = 0;
    const stageInterval = reducedMotion ? 240 : 820;

    const timer = window.setInterval(() => {
      currentStage += 1;
      const progress = Math.min(Math.round((currentStage / totalStages) * 100), 100);
      setScanProgress(progress);
      setScanStageIndex(Math.min(currentStage, totalStages - 1));

      if (currentStage >= totalStages) {
        window.clearInterval(timer);
        setIsScanning(false);
        setScanComplete(true);
      }
    }, stageInterval);

    return () => {
      window.clearInterval(timer);
    };
  }, [isScanning, reducedMotion]);

  const pulseTrendPath = pulsePath(pulseSeries, 320, 58);
  const healthTrendPath = pulsePath(healthTrend30Day, 300, 82);

  const trendMin = Math.min(...healthTrend30Day);
  const trendMax = Math.max(...healthTrend30Day);
  const trendRange = Math.max(trendMax - trendMin, 1);
  const trendLast = healthTrend30Day[healthTrend30Day.length - 1];
  const trendActiveScore = healthTrend30Day[activeTrendIndex] ?? trendLast;
  const trendActiveX = (activeTrendIndex / (healthTrend30Day.length - 1)) * 300;
  const trendActiveY = 82 - ((trendActiveScore - trendMin) / trendRange) * 82;
  const showScanDetails = isScanning || scanComplete;

  const shellStateClass = scanComplete ? "cc-shell cc-shell--scan-complete" : "cc-shell";

  return (
    <div className={shellStateClass}>
      <aside className="cc-rail cc-reveal cc-reveal--rail" aria-label="Primary navigation">
        <div className="cc-brand">
          <div className="cc-brand-mark" aria-hidden="true">
            GH
          </div>
          <div>
            <Heading as="h1" size="lg">
              GitHealth
            </Heading>
            <Text size="sm" tone="muted">
              Engineering Intelligence
            </Text>
          </div>
        </div>

        <nav className="cc-nav">
          {navItems.map((item) => (
            <Button
              key={item.id}
              variant={item.id === activeNavId ? "primary" : "tertiary"}
              size="md"
              selected={item.id === activeNavId}
              className="cc-nav-item"
              aria-current={item.id === activeNavId ? "page" : undefined}
              onClick={() => {
                if (item.id === "repository-universe") {
                  onExploreUniverse?.();
                  return;
                }

                onNavigate?.(item.id as AppScreen);
              }}
            >
              {item.label}
            </Button>
          ))}
        </nav>

        <Panel tone="elevated" className="cc-rail-status cc-reveal cc-reveal--xp">
          <Text size="sm" tone="muted">
            Level 08
          </Text>
          <Heading as="h2" size="md">
            1,840 / 2,000 XP
          </Heading>
          <div className="cc-progress" role="progressbar" aria-valuemin={0} aria-valuemax={2000} aria-valuenow={1840}>
            <span style={{ width: "92%" }} />
          </div>
          <Text size="sm" tone="secondary">
            Next reward: Security Champion
          </Text>
        </Panel>
      </aside>

      <main className="cc-main">
        <header className="cc-header cc-reveal cc-reveal--header">
          <div className="cc-header-title">
            <Text size="sm" tone="muted">
              {isMockSource ? `Good morning, ${commandCenterData.userName}.` : "GitHub organization health overview."}
            </Text>
            <Heading as="h2" size="display">
              Engineering Intelligence Center
            </Heading>
            <Text tone="secondary">
              Real-time health monitoring for {resolvedHealth.organization}.
            </Text>
          </div>

          <div className="cc-header-controls">
            <Badge tone="neutral">{isMockSource ? commandCenterData.periodLabel : `Source: ${resolvedHealth.source}`}</Badge>
            {isRefreshing ? <Badge tone="neutral">Refreshing</Badge> : null}
            <label className="cc-search" htmlFor="command-search">
              <span className="sr-only">Search commands</span>
              <input
                id="command-search"
                placeholder="Search or run command"
                defaultValue=""
                aria-label="Search or run command"
              />
            </label>
            <Button
              variant="primary"
              size="lg"
              className="cc-scan-action"
              onClick={() => {
                if (!isScanning) {
                  setScanComplete(false);
                  setIsScanning(true);
                }
              }}
              disabled={isScanning}
              selected={isScanning}
            >
              {isScanning ? `Scanning ${scanProgress}%` : "Scan Organization"}
            </Button>
          </div>
        </header>

        {renderConnectionCard(
          resolvedConnection,
          connectAction.isPending,
          () => {
            void connectAction.run(onConnectGitHub);
          },
          {
          className: "cc-connection-banner cc-reveal cc-reveal--hero",
          tone: "elevated"
          }
        )}

        <section className="cc-grid" aria-label="Command center overview">
          <Panel tone="elevated" className="cc-hero cc-reveal cc-reveal--hero">
            <div className="cc-hero-header">
              <Heading as="h3" size="sm">
                Organization Health Score
              </Heading>
              <Badge tone={showLoadingPlaceholders ? "neutral" : showResolvedMetrics ? "healthy" : showErrorState ? "critical" : "unknown"}>
                {showLoadingPlaceholders ? "Loading" : showResolvedMetrics ? resolvedHealth.scoreStatus : showErrorState ? "Error" : "No data"}
              </Badge>
            </div>

            {showLoadingPlaceholders ? (
              <>
                <div className="cc-skeleton cc-skeleton--orb" aria-label="Loading organization health score">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="cc-skeleton" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
              </>
            ) : showResolvedMetrics ? (
              <>
                <div className="cc-score-orb" aria-label={`Health score ${animatedScore}`}>
                  <div className="cc-score-ring" style={{ ["--score" as string]: String(animatedScore) }}>
                    <div className="cc-score-core">
                      <span className="cc-score-value">{animatedScore}</span>
                      <span className="cc-score-label">{resolvedHealth.scoreStatus}</span>
                    </div>
                  </div>
                </div>

                <div className="cc-score-trend-wrap">
                  {isMockSource ? (
                    <>
                      <Text className="cc-trend" tone="primary">
                        {commandCenterData.scoreTrend}
                      </Text>
                      <Text size="sm" tone="muted">
                        {commandCenterData.scoreTrendContext}
                      </Text>
                    </>
                  ) : showResolvedMetrics ? (
                    <>
                      <Text className="cc-trend" tone="secondary">
                        Trend unavailable
                      </Text>
                      <Text size="sm" tone="muted">
                        Historical trend data is not provided by the current live API.
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text className="cc-trend" tone="secondary">
                        Awaiting live data
                      </Text>
                      <Text size="sm" tone="muted">
                        Connect GitHub and rerun the health check to populate live trend and score data.
                      </Text>
                    </>
                  )}
                </div>

                <div className="cc-score-contrib" aria-label="Score contributors">
                  {showResolvedMetrics
                    ? resolvedHealth.categorySignals.map((signal) => (
                        <div key={signal.key} className="cc-score-contrib-item">
                          <span>{signal.label}</span>
                          <strong>{signal.score}</strong>
                        </div>
                      ))
                    : null}
                </div>
              </>
            ) : showErrorState ? (
              <div className="cc-empty-live-state" role="status" aria-live="polite">
                <Text className="cc-trend" tone="primary">
                  Live GitHub data could not be loaded
                </Text>
                <Text size="sm" tone="secondary">
                  {integrationError?.message || errorGuidance.title}
                </Text>
                <Text size="sm" tone="muted">
                  {errorGuidance.action}
                </Text>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    void retryAction.run(onRetry);
                  }}
                  disabled={retryAction.isPending}
                  aria-label="Retry health check"
                >
                  {retryAction.isPending ? "Retrying..." : "Retry Check"}
                </Button>
              </div>
            ) : (
              <div className="cc-empty-live-state" role="status" aria-live="polite">
                <Text className="cc-trend" tone="secondary">
                  Live GitHub data is pending
                </Text>
                <Text size="sm" tone="secondary">
                  {shouldPromptConnection
                    ? "Connect GitHub and choose an allowlisted organization to start live scoring."
                    : "No repositories are available yet for the connected organization."}
                </Text>
              </div>
            )}
          </Panel>

          <Panel tone="elevated" className="cc-pulse cc-reveal cc-reveal--pulse-late">
            <Heading as="h3" size="sm">
              Organization Pulse
            </Heading>
            {showLoadingPlaceholders ? (
              <div className="cc-skeleton" aria-label="Loading organization pulse">
                <span />
                <span />
                <span />
              </div>
            ) : showResolvedMetrics ? (
              <>
                <ul className="cc-pulse-list">
                  <li>
                    <Text size="sm" tone="muted">
                      Total repositories
                    </Text>
                    <Heading as="h4" size="lg">
                      {animatedRepositories}
                    </Heading>
                  </li>
                  <li>
                    <Badge tone="healthy">{resolvedHealth.pulse.healthy} Healthy</Badge>
                    <Badge tone="warning">{resolvedHealth.pulse.warning} Needs attention</Badge>
                    <Badge tone="critical">{resolvedHealth.pulse.critical} Critical</Badge>
                  </li>
                  <li>
                    <Text size="sm" tone="secondary">
                      Last scan: {resolvedHealth.pulse.lastScan}
                    </Text>
                  </li>
                </ul>
                <div className="cc-pulse-wave" aria-hidden="true">
                  <svg viewBox="0 0 320 60" preserveAspectRatio="none">
                    <path d={pulseTrendPath} />
                  </svg>
                </div>
              </>
            ) : (
              <Text size="sm" tone="muted">
                {resolvedActivity.hasError
                  ? integrationError?.message || "Unable to load live organization pulse data."
                  : "Connect GitHub to load your live organization pulse metrics."}
              </Text>
            )}
          </Panel>

          <div className="cc-signals cc-reveal cc-reveal--signals" aria-label="Category health signals">
            {showLoadingPlaceholders
              ? [0, 1, 2, 3].map((index) => (
                  <Panel key={`loading-signal-${index}`} tone="subtle" className="cc-signal-card" style={{ animationDelay: `${index * 90 + 250}ms` }}>
                    <div className="cc-skeleton" aria-label="Loading health metric card">
                      <span />
                      <span />
                      <span />
                    </div>
                  </Panel>
                ))
              : showResolvedMetrics
                ? resolvedHealth.categorySignals.map((signal, index) => (
                    <Panel key={signal.key} tone="subtle" className="cc-signal-card" style={{ animationDelay: `${index * 90 + 250}ms` }}>
                      <Text size="sm" tone="muted">
                        {signal.label}
                      </Text>
                      <div className="cc-signal-main">
                        <Heading as="h3" size="xl">
                          {Math.round((animatedScore / Math.max(resolvedHealth.score, 1)) * signal.score)}
                        </Heading>
                        <Badge tone={signal.tone}>{signal.tone}</Badge>
                      </div>
                      <svg className="cc-sparkline" viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden="true">
                        <path d={sparklinePath(signal.sparkline, 120, 26)} />
                      </svg>
                      <Text size="sm" tone="secondary">
                        Trend {signal.trend}
                      </Text>
                    </Panel>
                  ))
                : [
                    <Panel key="empty-signal" tone="subtle" className="cc-signal-card">
                      <Text size="sm" tone="muted">
                        {resolvedActivity.hasError
                          ? "Health metrics are unavailable until the live API request succeeds."
                          : "Connect GitHub to load live health metrics for this organization."}
                      </Text>
                    </Panel>
                  ]}
          </div>

          <Panel tone="base" className="cc-universe cc-reveal cc-reveal--universe">
            <div className="cc-universe-header">
              <Heading as="h3" size="sm">
                Repository Universe Preview
              </Heading>
              <Text size="sm" tone="muted">
                {resolvedHealth.totalRepositories} repositories
              </Text>
            </div>

            {isMockSource ? (
              <div className="cc-universe-canvas" role="img" aria-label="Repository relationship preview map">
                <svg className="cc-connections" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  {repoConnections.map((connection) => {
                    const fromNode = repoNodes.find((node) => node.id === connection.from);
                    const toNode = repoNodes.find((node) => node.id === connection.to);
                    if (!fromNode || !toNode) {
                      return null;
                    }

                    const isConnected =
                      activeNodeId === connection.from ||
                      activeNodeId === connection.to ||
                      activeNodeId === "org-core";

                    return (
                      <line
                        key={`${connection.from}-${connection.to}`}
                        x1={fromNode.x}
                        y1={fromNode.y}
                        x2={toNode.x}
                        y2={toNode.y}
                        className={`cc-link cc-link--${connection.strength}`}
                        data-active={isConnected ? "true" : "false"}
                      />
                    );
                  })}
                </svg>

                <button
                  type="button"
                  className="cc-universe-core"
                  onMouseEnter={() => setActiveNodeId("org-core")}
                  onFocus={() => setActiveNodeId("org-core")}
                  aria-label="GitHealth organization core"
                >
                  <span>GH</span>
                  <small>Org</small>
                </button>

                {repoNodes.map((node, index) => (
                  <button
                    key={node.id}
                    className={`cc-node cc-node--${node.tone}`}
                    style={{ left: `${node.x}%`, top: `${node.y}%` }}
                    aria-label={`${node.label} ${node.tone} ${node.group}`}
                    type="button"
                    data-active={activeNodeId === node.id ? "true" : "false"}
                    data-linked={linkedNodeIds.has(node.id) ? "true" : "false"}
                    onMouseEnter={() => setActiveNodeId(node.id)}
                    onFocus={() => setActiveNodeId(node.id)}
                  >
                    <span className="cc-node-halo" style={{ animationDelay: `${index * 140}ms` }} />
                    <span className="cc-node-label" aria-hidden="true">
                      {node.label}
                    </span>
                    <span className="sr-only">{node.label}</span>
                  </button>
                ))}

                <div className="cc-universe-tooltip" role="status" aria-live="polite">
                  <strong>{activeNodeLabel}</strong>
                  <span>
                    {activeNodeGroup}
                    {activeNodeId !== "org-core" ? ` · ${activeNodeTone}` : ""}
                  </span>
                  <span>{activeNodeId === "org-core" ? `${repoConnections.length} active links` : `${linkedCount} linked services`}</span>
                </div>
              </div>
            ) : (
              <Text size="sm" tone="muted">
                Relationship preview is unavailable because topology data is not provided by the live API.
              </Text>
            )}

            <Button variant="primary" size="sm" onClick={onExploreUniverse}>
              Explore Universe
            </Button>
          </Panel>

          <aside className="cc-intel-column" aria-label="Health intelligence and trends">
            <Panel tone="base" className="cc-insights cc-reveal cc-reveal--insights">
              <div className="cc-insights-header">
                <Heading as="h3" size="sm">
                  Health Intelligence
                </Heading>
                <Text size="sm" tone="muted">
                  {resolvedHealth.insights.length} recommendations
                </Text>
              </div>

              <ol className="cc-insights-list">
                {resolvedHealth.insights.map((insight, index) => (
                  <li key={insight.id}>
                    <span className="cc-insight-index">{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <Text size="sm">{insight.title}</Text>
                      <Text size="sm" tone="secondary">
                        {insight.action}
                      </Text>
                    </div>
                    <Badge tone={impactTone(insight.impact)}>{insight.impact} Impact</Badge>
                  </li>
                ))}
              </ol>
            </Panel>

            <Panel tone="subtle" className="cc-trend-panel cc-reveal cc-reveal--intel-secondary">
              <div className="cc-insights-header">
                <Heading as="h3" size="sm">
                  30-Day Health Trend
                </Heading>
                <Badge tone={isMockSource ? "healthy" : "unknown"}>{isMockSource ? trendActiveScore : "N/A"}</Badge>
              </div>
              {isMockSource ? (
                <div
                  className="cc-health-trend"
                  role="img"
                  aria-label={`Health trend over 30 days from ${trendMin} to ${trendMax}. Focused day score is ${trendActiveScore}.`}
                  onMouseMove={(event) => {
                    const bounds = event.currentTarget.getBoundingClientRect();
                    const clampedX = Math.max(0, Math.min(event.clientX - bounds.left, bounds.width));
                    const ratio = bounds.width === 0 ? 1 : clampedX / bounds.width;
                    const index = Math.round(ratio * (healthTrend30Day.length - 1));
                    setActiveTrendIndex(index);
                  }}
                  onMouseLeave={() => setActiveTrendIndex(healthTrend30Day.length - 1)}
                >
                  <svg viewBox="0 0 300 92" preserveAspectRatio="none" aria-hidden="true">
                    <g className="cc-health-grid">
                      <line x1="0" y1="10" x2="300" y2="10" />
                      <line x1="0" y1="46" x2="300" y2="46" />
                      <line x1="0" y1="82" x2="300" y2="82" />
                    </g>
                    <path className="cc-health-area" d={`${healthTrendPath} L300,92 L0,92 Z`} />
                    <path className="cc-health-line" d={healthTrendPath} />
                    <circle className="cc-health-marker" cx={trendActiveX} cy={trendActiveY} r="4" />
                  </svg>
                  <div className="cc-health-labels">
                    {healthTrendLabels.map((label, idx) => (
                      <button
                        key={label}
                        type="button"
                        className="cc-health-label-button"
                        onMouseEnter={() => setActiveTrendIndex(healthTrendKeyPoints[idx])}
                        onFocus={() => setActiveTrendIndex(healthTrendKeyPoints[idx])}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <Text size="sm" tone="secondary">
                    Day {activeTrendIndex + 1}: {trendActiveScore} health score
                  </Text>
                </div>
              ) : (
                <Text size="sm" tone="muted">
                  Historical trend data is unavailable from the current live API source.
                </Text>
              )}
            </Panel>

            <Panel tone="subtle" className="cc-achievements cc-reveal cc-reveal--intel-secondary">
              <Heading as="h3" size="sm">
                Engineering Achievements
              </Heading>
              {isMockSource ? (
                <ul>
                  {achievements.map((achievement) => (
                    <li key={achievement.id}>
                      <div className="cc-achievement-row">
                        <Badge tone={achievement.tone}>{achievement.title}</Badge>
                        <Text size="sm" tone="muted">
                          {achievement.xpGain}
                        </Text>
                      </div>
                      <Text size="sm" tone="secondary">
                        {achievement.detail}
                      </Text>
                      <div className="cc-achievement-progress" aria-hidden="true">
                        <span style={{ width: `${achievement.progress}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Text size="sm" tone="muted">
                  Achievement data is unavailable in live mode.
                </Text>
              )}
            </Panel>

            <Panel tone="subtle" className="cc-recent-activity cc-reveal cc-reveal--pulse">
              <Heading as="h3" size="sm">
                Recent Engineering Activity
              </Heading>
              {resolvedRecentActivity.length > 0 ? (
                <ul>
                  {resolvedRecentActivity.map((item) => (
                    <li key={item.id}>
                      <span className={`cc-activity-dot cc-activity-dot--${item.tone}`} aria-hidden="true" />
                      <div>
                        <Text size="sm">{item.event}</Text>
                        <Text size="sm" tone="secondary">
                          {item.context}
                        </Text>
                      </div>
                      <Text size="sm" tone="muted">
                        {item.when}
                      </Text>
                    </li>
                  ))}
                </ul>
              ) : (
                <Text size="sm" tone="muted">
                  Recent engineering activity is unavailable from the current source.
                </Text>
              )}
            </Panel>
          </aside>
        </section>

        <section className="cc-states cc-reveal cc-reveal--states" aria-label="Operational states">
          <Panel tone="subtle" className="cc-state-card cc-state-card--scan">
            <div className="cc-state-header">
              <Heading as="h3" size="sm">
                Organization Scan
              </Heading>
              <Badge tone={isMockSource ? (scanComplete ? "healthy" : isScanning ? "neutral" : "unknown") : "unknown"}>
                {isMockSource ? (scanComplete ? "Completed" : isScanning ? `${scanProgress}%` : "Idle") : "Unavailable"}
              </Badge>
            </div>
            {isMockSource ? (
              <>
                <div className="cc-scan-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={scanProgress}>
                  <span style={{ width: `${scanProgress}%` }} />
                </div>
                {showScanDetails ? (
                  <ul className="cc-scan-stages">
                    {scanStages.map((stage, index) => {
                      const status =
                        index < scanStageIndex ? "done" : index === scanStageIndex && isScanning ? "active" : scanComplete ? "done" : "pending";
                      return (
                        <li key={stage.id} data-status={status}>
                          <span aria-hidden="true" />
                          <Text size="sm" tone={status === "pending" ? "muted" : "primary"}>
                            {stage.label}
                          </Text>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <Text size="sm" tone="secondary">
                    Ready to run a full organization scan across repositories, security, governance, and CI/CD quality.
                  </Text>
                )}
              </>
            ) : (
              <Text size="sm" tone="muted">
                {shouldPromptConnection
                  ? "Connect GitHub to enable live organization scans and live telemetry in this workspace."
                  : "Scan progress telemetry is unavailable for the live API path."}
              </Text>
            )}
          </Panel>

          <Panel tone="subtle" className="cc-state-card">
            <Heading as="h3" size="sm">
              Data Loading
            </Heading>
            {resolvedActivity.isLoading ? (
              <div className="cc-skeleton" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            ) : (
              <Text size="sm" tone="muted">
                {resolvedActivity.isEmpty
                  ? shouldPromptConnection
                    ? "Connect GitHub to load live repository health data."
                    : "No repository data available yet."
                  : "No active loading jobs."}
              </Text>
            )}
          </Panel>

          <Panel tone="subtle" className="cc-state-card">
            <Heading as="h3" size="sm">
              Error Recovery
            </Heading>
            {resolvedActivity.hasError || resolvedConnection.status === "error" || resolvedConnection.status === "unauthorized_installation" ? (
              <>
                <Text size="sm" tone="secondary">
                  {resolvedConnection.status === "error" || resolvedConnection.status === "unauthorized_installation"
                    ? "GitHub connection setup needs attention."
                    : errorGuidance.title}
                </Text>
                <Text size="sm" tone="muted">
                  {resolvedConnection.status === "error" || resolvedConnection.status === "unauthorized_installation"
                    ? resolvedConnection.message
                    : errorGuidance.action}
                </Text>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    void retryAction.run(onRetry);
                  }}
                  disabled={retryAction.isPending}
                  aria-label="Retry health check"
                >
                  {retryAction.isPending ? "Retrying..." : "Retry Check"}
                </Button>
              </>
            ) : (
              <Text size="sm" tone="muted">
                All checks are passing.
              </Text>
            )}
          </Panel>
        </section>
      </main>
    </div>
  );
}
