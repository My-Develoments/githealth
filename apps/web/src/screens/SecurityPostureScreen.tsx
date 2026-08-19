import { Badge, Button, Heading, Panel, Text } from "@githealth/ui";
import type { GitHubConnectionViewModel, GitHubHealthIntegrationState } from "../data/githubHealthContracts";
import type { CommandCenterHealthViewModel, RepositoryUniverseViewModel } from "../data/githubHealthViewMappers";
import { navItems } from "../mock/commandCenterData";
import type { AppScreen } from "../navigation";
import {
  isSectionConnectActionDisabled,
  resolveSectionConnectActionLabel,
  resolveSectionConnectionLabel,
  resolveSectionConnectionTone,
  resolveSectionDataState,
  scoreTone,
  shouldShowSectionConnectAction
} from "./sectionScreenShared";
import "./command-center.css";

type SecurityPostureScreenProps = {
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

function signalToneBadge(tone: CommandCenterHealthViewModel["categorySignals"][number]["tone"]): "healthy" | "warning" | "critical" | "neutral" | "unknown" {
  return tone;
}

export function SecurityPostureScreen({
  activeNavId = "security",
  onNavigate,
  healthData,
  repositoryData,
  integrationState,
  connection,
  integrationError,
  onConnectGitHub,
  onRetry
}: SecurityPostureScreenProps) {
  const dataState = resolveSectionDataState(integrationState);
  const securitySignal = healthData.categorySignals.find((signal) => signal.key === "security");

  const repositories = repositoryData.repositories;
  const repositoriesWithAlerts = repositories.filter((repository) => repository.securityAlerts > 0);
  const totalSecurityAlerts = repositories.reduce((sum, repository) => sum + repository.securityAlerts, 0);

  const highestRiskRepositories = [...repositories]
    .filter((repository) => repository.securityScore > 0)
    .sort((left, right) => {
      if (left.securityScore !== right.securityScore) {
        return left.securityScore - right.securityScore;
      }

      return right.securityAlerts - left.securityAlerts;
    })
    .slice(0, 5);

  const securityInsights = healthData.insights
    .filter((insight) => /security|vulnerab|codeql|alert|cve|secret/i.test(`${insight.title} ${insight.action}`))
    .slice(0, 3);

  const fallbackInsights = securityInsights.length > 0 ? securityInsights : healthData.insights.slice(0, 3);
  const showConnectAction = shouldShowSectionConnectAction(connection);
  const isConnectActionDisabled = isSectionConnectActionDisabled(connection);

  return (
    <div className="cc-shell shs-shell">
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
            Security Snapshot
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
              Security domain
            </Text>
            <Heading as="h2" size="display">
              Security Posture
            </Heading>
            <Text tone="secondary">
              {healthData.source === "mock"
                ? "Showing mock/demo security posture from local fixtures."
                : "Showing API-backed security posture from the configured GitHub source."}
            </Text>
          </div>

          <div className="cc-header-controls">
            <Badge tone={healthData.source === "mock" ? "warning" : "healthy"}>{`Source: ${healthData.source}`}</Badge>
            <Badge tone={resolveSectionConnectionTone(connection.status)}>{resolveSectionConnectionLabel(connection)}</Badge>
          </div>
        </header>

        <section className="shs-grid" aria-label="Security posture content">
          <Panel tone="elevated" className="shs-card shs-summary cc-reveal cc-reveal--hero">
            <div className="shs-card__header">
              <Heading as="h3" size="sm">
                Security Summary
              </Heading>
              <Badge tone={scoreTone(securitySignal?.score ?? 0)}>
                {securitySignal ? `${securitySignal.score}` : "Unavailable"}
              </Badge>
            </div>

            <Text size="sm" tone="secondary">
              {securitySignal ? `${securitySignal.label} category signal from organization scoring.` : "Security category signal is unavailable for the current source."}
            </Text>

            <div className="shs-meta">
              <span>Repositories evaluated: {healthData.totalRepositories}</span>
              <span>Repositories with alerts: {repositoriesWithAlerts.length}</span>
              <span>Total security alerts: {totalSecurityAlerts}</span>
              <span>Critical repos: {healthData.pulse.critical}</span>
              <span>Warning repos: {healthData.pulse.warning}</span>
            </div>
          </Panel>

          <Panel tone="subtle" className="shs-card cc-reveal cc-reveal--signals">
            <div className="shs-card__header">
              <Heading as="h3" size="sm">
                Security Signals
              </Heading>
              <Badge tone={integrationState === "partial" ? "warning" : "neutral"}>{integrationState}</Badge>
            </div>

            {healthData.categorySignals.length === 0 ? (
              <Text size="sm" tone="muted">No category-level security signals are available.</Text>
            ) : (
              <ul className="shs-signal-list" aria-label="Security category signals">
                {healthData.categorySignals
                  .filter((signal) => signal.key === "security" || signal.key === "governance")
                  .map((signal) => (
                    <li key={signal.key}>
                      <span>{signal.label}</span>
                      <Badge tone={signalToneBadge(signal.tone)}>{signal.score}</Badge>
                    </li>
                  ))}
              </ul>
            )}
          </Panel>

          <Panel tone="subtle" className="shs-card cc-reveal cc-reveal--pulse-late">
            <div className="shs-card__header">
              <Heading as="h3" size="sm">
                GitHub Access
              </Heading>
              <Badge tone={resolveSectionConnectionTone(connection.status)}>{connection.provider === "app" ? "GitHub App" : "PAT"}</Badge>
            </div>
            <Text size="sm" tone="secondary">
              {connection.message}
            </Text>

            {!connection.isConnected && dataState !== "loading" ? (
              <Text size="sm" tone="muted">Connect GitHub to load authenticated security posture data.</Text>
            ) : null}

            {showConnectAction ? (
              <div className="shs-actions">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    void onConnectGitHub?.();
                  }}
                  disabled={isConnectActionDisabled}
                  aria-label={resolveSectionConnectActionLabel(connection)}
                >
                  {resolveSectionConnectActionLabel(connection)}
                </Button>
              </div>
            ) : null}
          </Panel>

          {dataState === "loading" ? (
            <Panel tone="elevated" className="shs-card shs-state">
              <Heading as="h3" size="sm">
                Loading security posture
              </Heading>
              <Text size="sm" tone="secondary">GitHealth is collecting security-related repository signals.</Text>
            </Panel>
          ) : null}

          {dataState === "empty" ? (
            <Panel tone="elevated" className="shs-card shs-state">
              <Heading as="h3" size="sm">
                No security posture data available
              </Heading>
              <Text size="sm" tone="secondary">
                The API request completed, but no repository security context was returned for this organization/source.
              </Text>
              <div className="shs-actions">
                <Button variant="secondary" size="md" onClick={() => onRetry?.()} aria-label="Retry security posture">
                  Retry
                </Button>
              </div>
            </Panel>
          ) : null}

          {dataState === "error" ? (
            <Panel tone="elevated" className="shs-card shs-state">
              <Heading as="h3" size="sm">
                Unable to load security posture
              </Heading>
              <Text size="sm" tone="secondary">
                {integrationError?.message || "An unknown integration issue occurred while loading security posture."}
              </Text>
              {integrationError?.code ? <Badge tone="critical">{integrationError.code}</Badge> : null}
              <div className="shs-actions">
                <Button variant="secondary" size="md" onClick={() => onRetry?.()} aria-label="Retry security posture">
                  Retry
                </Button>
              </div>
            </Panel>
          ) : null}

          <Panel tone="subtle" className="shs-card shs-repos cc-reveal cc-reveal--states">
            <Heading as="h3" size="sm">
              Repository Security Context
            </Heading>

            {highestRiskRepositories.length === 0 ? (
              <Text size="sm" tone="muted">No repository-level security context is available for the current source.</Text>
            ) : (
              <ul className="shs-repo-list" aria-label="Repository security context">
                {highestRiskRepositories.map((repository) => (
                  <li key={repository.id}>
                    <div>
                      <Text size="sm" tone="secondary">{repository.name}</Text>
                      <Text size="sm" tone="muted">Alerts: {repository.securityAlerts} · Open issues: {repository.openIssues}</Text>
                    </div>
                    <Badge tone={scoreTone(repository.securityScore)}>{repository.securityScore}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel tone="subtle" className="shs-card shs-insights cc-reveal cc-reveal--states">
            <Heading as="h3" size="sm">
              Security Insights
            </Heading>

            {fallbackInsights.length === 0 ? (
              <Text size="sm" tone="muted">No security insights are currently available for this source.</Text>
            ) : (
              <ul className="shs-insight-list" aria-label="Security insights">
                {fallbackInsights.map((insight) => (
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
        </section>
      </main>
    </div>
  );
}
