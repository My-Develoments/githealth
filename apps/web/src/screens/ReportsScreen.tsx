import { Badge, Button, Heading, Panel, Text } from "@githealth/ui";
import type { GitHubConnectionViewModel, GitHubHealthIntegrationState } from "../data/githubHealthContracts";
import type { CommandCenterHealthViewModel, RepositoryUniverseViewModel } from "../data/githubHealthViewMappers";
import { navItems } from "../mock/commandCenterData";
import type { AppScreen } from "../navigation";
import "./command-center.css";

type ReportsScreenProps = {
  activeNavId?: AppScreen;
  onNavigate?: (screen: AppScreen) => void;
  healthData: CommandCenterHealthViewModel;
  repositoryData: RepositoryUniverseViewModel;
  integrationState: GitHubHealthIntegrationState;
  connection: GitHubConnectionViewModel;
  integrationError?: {
    message: string;
    code: string;
    status: number;
  } | null;
  onConnectGitHub?: () => void | Promise<void>;
  onRetry?: () => void;
};

type ReportsDataState = "loading" | "ready" | "empty" | "error";

function resolveDataState(state: GitHubHealthIntegrationState): ReportsDataState {
  if (state === "loading") {
    return "loading";
  }

  if (state === "error" || state === "failed") {
    return "error";
  }

  if (state === "empty") {
    return "empty";
  }

  return "ready";
}

function connectionTone(status: GitHubConnectionViewModel["status"]): "healthy" | "warning" | "neutral" | "critical" | "unknown" {
  if (status === "connected") {
    return "healthy";
  }

  if (status === "ready_to_connect" || status === "connecting" || status === "installation_completed") {
    return "neutral";
  }

  if (status === "error" || status === "unauthorized_installation") {
    return "critical";
  }

  if (status === "not_configured") {
    return "warning";
  }

  return "unknown";
}

function connectionLabel(connection: GitHubConnectionViewModel): string {
  if (connection.status === "connected") {
    return "Connected";
  }

  if (connection.status === "ready_to_connect") {
    return "Ready to connect";
  }

  if (connection.status === "connecting") {
    return "Connecting";
  }

  if (connection.status === "installation_completed") {
    return "Installation completed";
  }

  if (connection.status === "unauthorized_installation") {
    return "Unauthorized installation";
  }

  if (connection.status === "not_configured") {
    return "Not configured";
  }

  return "Connection error";
}

function connectActionLabel(connection: GitHubConnectionViewModel): "Connect GitHub" | "Reconnect GitHub" {
  if (connection.status === "ready_to_connect") {
    return "Connect GitHub";
  }

  return "Reconnect GitHub";
}

function scoreTone(score: number): "healthy" | "warning" | "critical" | "unknown" {
  if (score >= 85) {
    return "healthy";
  }

  if (score >= 70) {
    return "warning";
  }

  if (score > 0) {
    return "critical";
  }

  return "unknown";
}

function signalToneBadge(tone: CommandCenterHealthViewModel["categorySignals"][number]["tone"]): "healthy" | "warning" | "critical" | "neutral" | "unknown" {
  return tone;
}

export function ReportsScreen({
  activeNavId = "reports",
  onNavigate,
  healthData,
  repositoryData,
  integrationState,
  connection,
  integrationError,
  onConnectGitHub,
  onRetry
}: ReportsScreenProps) {
  const dataState = resolveDataState(integrationState);
  const repositories = repositoryData.repositories;
  const topRepositoryContext = [...repositories]
    .filter((repository) => repository.healthScore > 0)
    .sort((left, right) => right.healthScore - left.healthScore)
    .slice(0, 5);

  const categorySignals = healthData.categorySignals.slice(0, 4);
  const reportInsights = healthData.insights.slice(0, 3);
  const repositoryUniverseHighlights = repositoryData.insights.slice(0, 3);
  const showConnectAction = connection.provider === "app" && !connection.isConnected;
  const isConnectActionDisabled = connection.status === "connecting" || connection.status === "installation_completed" || !connection.canConnect;

  return (
    <div className="cc-shell rhs-shell">
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
              onClick={() => onNavigate?.(item.id as AppScreen)}
            >
              {item.label}
            </Button>
          ))}
        </nav>

        <Panel tone="elevated" className="cc-rail-status cc-reveal cc-reveal--xp">
          <Text size="sm" tone="muted">
            Reporting Snapshot
          </Text>
          <Heading as="h2" size="md">
            {healthData.organization}
          </Heading>
          <Text size="sm" tone="secondary">
            {connection.message}
          </Text>
        </Panel>
      </aside>

      <main className="cc-main sp-main">
        <header className="cc-header cc-reveal cc-reveal--header">
          <div className="cc-header-title">
            <Text size="sm" tone="muted">
              Reporting domain
            </Text>
            <Heading as="h2" size="display">
              Reports
            </Heading>
            <Text tone="secondary">
              {healthData.source === "mock"
                ? "Showing mock/demo report summaries from local fixtures."
                : "Showing API-backed report summaries from the configured GitHub source."}
            </Text>
          </div>

          <div className="cc-header-controls">
            <Badge tone={healthData.source === "mock" ? "warning" : "healthy"}>{`Source: ${healthData.source}`}</Badge>
            <Badge tone={connectionTone(connection.status)}>{connectionLabel(connection)}</Badge>
          </div>
        </header>

        <section className="rhs-grid" aria-label="Reports content">
          <Panel tone="elevated" className="rhs-card rhs-summary cc-reveal cc-reveal--hero">
            <div className="rhs-card__header">
              <Heading as="h3" size="sm">
                Executive Summary
              </Heading>
              <Badge tone={scoreTone(healthData.score)}>{healthData.scoreStatus}</Badge>
            </div>

            <div className="rhs-score">
              <span className="rhs-score__value">{healthData.score}</span>
              <span className="rhs-score__label">Overall score</span>
            </div>

            <div className="rhs-meta">
              <span>Repositories: {healthData.totalRepositories}</span>
              <span>Healthy: {healthData.pulse.healthy}</span>
              <span>Warning: {healthData.pulse.warning}</span>
              <span>Critical: {healthData.pulse.critical}</span>
              <span>Last scan: {healthData.pulse.lastScan}</span>
            </div>
          </Panel>

          <Panel tone="subtle" className="rhs-card cc-reveal cc-reveal--signals">
            <div className="rhs-card__header">
              <Heading as="h3" size="sm">
                Report Signals
              </Heading>
              <Badge tone={integrationState === "partial" ? "warning" : "neutral"}>{integrationState}</Badge>
            </div>

            {categorySignals.length === 0 ? (
              <Text size="sm" tone="muted">No category signals are available for the current source.</Text>
            ) : (
              <ul className="rhs-signal-list" aria-label="Report category signals">
                {categorySignals.map((signal) => (
                  <li key={signal.key}>
                    <span>{signal.label}</span>
                    <Badge tone={signalToneBadge(signal.tone)}>{signal.score}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel tone="subtle" className="rhs-card cc-reveal cc-reveal--pulse-late">
            <div className="rhs-card__header">
              <Heading as="h3" size="sm">
                Data Readiness
              </Heading>
              <Badge tone={connectionTone(connection.status)}>{connection.provider === "app" ? "GitHub App" : "PAT"}</Badge>
            </div>

            <Text size="sm" tone="secondary">
              {connection.message}
            </Text>
            <Text size="sm" tone="muted">
              Command center fetch status: {healthData.fetchStatus}. Repository context fetch status: {repositoryData.fetchStatus}.
            </Text>

            {!connection.isConnected && dataState !== "loading" ? (
              <Text size="sm" tone="muted">Connect GitHub to load authenticated reporting data.</Text>
            ) : null}

            {showConnectAction ? (
              <div className="rhs-actions">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    void onConnectGitHub?.();
                  }}
                  disabled={isConnectActionDisabled}
                  aria-label={connectActionLabel(connection)}
                >
                  {connectActionLabel(connection)}
                </Button>
              </div>
            ) : null}
          </Panel>

          {dataState === "loading" ? (
            <Panel tone="elevated" className="rhs-card rhs-state">
              <Heading as="h3" size="sm">
                Loading reports
              </Heading>
              <Text size="sm" tone="secondary">GitHealth is compiling report-ready organization and repository summaries.</Text>
            </Panel>
          ) : null}

          {dataState === "empty" ? (
            <Panel tone="elevated" className="rhs-card rhs-state">
              <Heading as="h3" size="sm">
                No report data available
              </Heading>
              <Text size="sm" tone="secondary">
                The API request completed, but no organization or repository report context was returned for this source.
              </Text>
              <div className="rhs-actions">
                <Button variant="secondary" size="md" onClick={() => onRetry?.()} aria-label="Retry reports">
                  Retry
                </Button>
              </div>
            </Panel>
          ) : null}

          {dataState === "error" ? (
            <Panel tone="elevated" className="rhs-card rhs-state">
              <Heading as="h3" size="sm">
                Unable to load reports
              </Heading>
              <Text size="sm" tone="secondary">
                {integrationError?.message || "An unknown integration issue occurred while loading reports."}
              </Text>
              {integrationError?.code ? <Badge tone="critical">{integrationError.code}</Badge> : null}
              <div className="rhs-actions">
                <Button variant="secondary" size="md" onClick={() => onRetry?.()} aria-label="Retry reports">
                  Retry
                </Button>
              </div>
            </Panel>
          ) : null}

          <Panel tone="subtle" className="rhs-card rhs-repos cc-reveal cc-reveal--states">
            <Heading as="h3" size="sm">
              Repository Health Context
            </Heading>

            {topRepositoryContext.length === 0 ? (
              <Text size="sm" tone="muted">No repository-level report context is available for the current source.</Text>
            ) : (
              <ul className="rhs-repo-list" aria-label="Repository report context">
                {topRepositoryContext.map((repository) => (
                  <li key={repository.id}>
                    <div>
                      <Text size="sm" tone="secondary">{repository.name}</Text>
                      <Text size="sm" tone="muted">Health: {repository.healthScore} · Security: {repository.securityScore} · Governance: {repository.governanceScore} · CI / CD: {repository.cicdScore}</Text>
                    </div>
                    <Badge tone={scoreTone(repository.healthScore)}>{repository.healthScore}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel tone="subtle" className="rhs-card rhs-insights cc-reveal cc-reveal--states">
            <Heading as="h3" size="sm">
              Actionable Insights
            </Heading>

            {reportInsights.length === 0 ? (
              <Text size="sm" tone="muted">No report insights are currently available for this source.</Text>
            ) : (
              <ul className="rhs-insight-list" aria-label="Report insights">
                {reportInsights.map((insight) => (
                  <li key={insight.id}>
                    <div>
                      <Text size="sm" tone="secondary">{insight.title}</Text>
                      <Text size="sm" tone="muted">{insight.action}</Text>
                    </div>
                    <Badge tone={insight.tone}>{insight.impact}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel tone="subtle" className="rhs-card rhs-highlights cc-reveal cc-reveal--states">
            <Heading as="h3" size="sm">
              Report Highlights
            </Heading>

            {repositoryUniverseHighlights.length === 0 ? (
              <Text size="sm" tone="muted">No additional report highlight cards are available for the current source.</Text>
            ) : (
              <ul className="rhs-highlight-list" aria-label="Report highlights">
                {repositoryUniverseHighlights.map((insight) => (
                  <li key={insight.id}>
                    <Text size="sm" tone="secondary">{insight.label}</Text>
                    <Text size="sm" tone="muted">{insight.value}</Text>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel tone="subtle" className="rhs-card rhs-limitations cc-reveal cc-reveal--states">
            <Heading as="h3" size="sm">
              Export Availability
            </Heading>
            <Text size="sm" tone="secondary">
              Current frontend contracts support rendered report summaries, but do not expose export or download actions for PDFs, CSVs, or scheduled report delivery.
            </Text>
            <Text size="sm" tone="muted">
              This screen intentionally avoids faking an export workflow and only presents report content supported by the current GitHealth data model.
            </Text>
          </Panel>
        </section>
      </main>
    </div>
  );
}