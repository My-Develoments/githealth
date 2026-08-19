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
import "./command-center.css";

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
  onExploreUniverse?: () => void;
  healthData?: CommandCenterHealthViewModel;
  activityState?: CommandCenterActivityState;
  recentActivity?: typeof recentEngineeringActivityDefaults;
};

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

export function CommandCenterScreen({ onExploreUniverse, healthData, activityState, recentActivity }: CommandCenterScreenProps) {
  const resolvedHealth: CommandCenterHealthViewModel = healthData ?? unavailableHealthViewModel;
  const isMockSource = resolvedHealth.source === "mock";

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
              variant={item.active ? "primary" : "tertiary"}
              size="md"
              selected={Boolean(item.active)}
              className="cc-nav-item"
              aria-current={item.active ? "page" : undefined}
              onClick={item.id === "repository-universe" ? onExploreUniverse : undefined}
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

        <section className="cc-grid" aria-label="Command center overview">
          <Panel tone="elevated" className="cc-hero cc-reveal cc-reveal--hero">
            <div className="cc-hero-header">
              <Heading as="h3" size="sm">
                Organization Health Score
              </Heading>
              <Badge tone="healthy">{resolvedHealth.scoreStatus}</Badge>
            </div>

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
              ) : (
                <>
                  <Text className="cc-trend" tone="secondary">
                    Trend unavailable
                  </Text>
                  <Text size="sm" tone="muted">
                    Historical trend data is not provided by the current live API.
                  </Text>
                </>
              )}
            </div>

            <div className="cc-score-contrib" aria-label="Score contributors">
              {resolvedHealth.categorySignals.map((signal) => (
                <div key={signal.key} className="cc-score-contrib-item">
                  <span>{signal.label}</span>
                  <strong>{signal.score}</strong>
                </div>
              ))}
            </div>
          </Panel>

          <Panel tone="elevated" className="cc-pulse cc-reveal cc-reveal--pulse-late">
            <Heading as="h3" size="sm">
              Organization Pulse
            </Heading>
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
          </Panel>

          <div className="cc-signals cc-reveal cc-reveal--signals" aria-label="Category health signals">
            {resolvedHealth.categorySignals.map((signal, index) => (
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
            ))}
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
                Scan progress telemetry is unavailable for the live API path.
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
                {resolvedActivity.isEmpty ? "No repository data available yet." : "No active loading jobs."}
              </Text>
            )}
          </Panel>

          <Panel tone="subtle" className="cc-state-card">
            <Heading as="h3" size="sm">
              Error Recovery
            </Heading>
            {resolvedActivity.hasError ? (
              <>
                <Text size="sm" tone="secondary">
                  Live health data is currently unavailable. Review adapter issues and retry.
                </Text>
                <Button variant="secondary" size="sm">
                  Retry Check
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
