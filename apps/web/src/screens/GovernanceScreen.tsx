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

type GovernanceScreenProps = {
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

export function GovernanceScreen({
  activeNavId = "governance",
  onNavigate,
  healthData,
  repositoryData,
  integrationState,
  connection,
  integrationError,
  onConnectGitHub,
  onRetry
}: GovernanceScreenProps) {
  const dataState = resolveSectionDataState(integrationState);
  const governanceSignal = healthData.categorySignals.find((signal) => signal.key === "governance");

  const repositories = repositoryData.repositories;
  const lowGovernanceRepositories = repositories.filter((repository) => repository.governanceScore > 0 && repository.governanceScore < 80);
  const repositoriesWithIssueBacklog = repositories.filter((repository) => repository.openIssues >= 20);

  const governanceRiskRepositories = [...repositories]
    .filter((repository) => repository.governanceScore > 0)
    .sort((left, right) => {
      if (left.governanceScore !== right.governanceScore) {
        return left.governanceScore - right.governanceScore;
      }

      return right.openIssues - left.openIssues;
    })
    .slice(0, 5);

  const governanceInsights = healthData.insights
    .filter((insight) => /govern|branch|review|policy|approval|compliance/i.test(`${insight.title} ${insight.action}`))
    .slice(0, 3);

  const fallbackInsights = governanceInsights.length > 0 ? governanceInsights : healthData.insights.slice(0, 3);
  const showConnectAction = shouldShowSectionConnectAction(connection);
  const isConnectActionDisabled = isSectionConnectActionDisabled(connection);

  return (
    <div className="cc-shell gvs-shell">
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
            Governance Snapshot
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
              Governance domain
            </Text>
            <Heading as="h2" size="display">
              Governance
            </Heading>
            <Text tone="secondary">
              {healthData.source === "mock"
                ? "Showing mock/demo governance posture from local fixtures."
                : "Showing API-backed governance posture from the configured GitHub source."}
            </Text>
          </div>

          <div className="cc-header-controls">
            <Badge tone={healthData.source === "mock" ? "warning" : "healthy"}>{`Source: ${healthData.source}`}</Badge>
            <Badge tone={resolveSectionConnectionTone(connection.status)}>{resolveSectionConnectionLabel(connection)}</Badge>
          </div>
        </header>

        <section className="gvs-grid" aria-label="Governance content">
          <Panel tone="elevated" className="gvs-card gvs-summary cc-reveal cc-reveal--hero">
            <div className="gvs-card__header">
              <Heading as="h3" size="sm">
                Governance Summary
              </Heading>
              <Badge tone={scoreTone(governanceSignal?.score ?? 0)}>
                {governanceSignal ? `${governanceSignal.score}` : "Unavailable"}
              </Badge>
            </div>

            <Text size="sm" tone="secondary">
              {governanceSignal
                ? `${governanceSignal.label} category signal from organization scoring.`
                : "Governance category signal is unavailable for the current source."}
            </Text>

            <div className="gvs-meta">
              <span>Repositories evaluated: {healthData.totalRepositories}</span>
              <span>Low governance score repos: {lowGovernanceRepositories.length}</span>
              <span>Issue backlog repos: {repositoriesWithIssueBacklog.length}</span>
              <span>Critical repos: {healthData.pulse.critical}</span>
              <span>Warning repos: {healthData.pulse.warning}</span>
            </div>
          </Panel>

          <Panel tone="subtle" className="gvs-card cc-reveal cc-reveal--signals">
            <div className="gvs-card__header">
              <Heading as="h3" size="sm">
                Governance Signals
              </Heading>
              <Badge tone={integrationState === "partial" ? "warning" : "neutral"}>{integrationState}</Badge>
            </div>

            {healthData.categorySignals.length === 0 ? (
              <Text size="sm" tone="muted">No category-level governance signals are available.</Text>
            ) : (
              <ul className="gvs-signal-list" aria-label="Governance category signals">
                {healthData.categorySignals
                  .filter((signal) => signal.key === "governance" || signal.key === "quality")
                  .map((signal) => (
                    <li key={signal.key}>
                      <span>{signal.label}</span>
                      <Badge tone={signalToneBadge(signal.tone)}>{signal.score}</Badge>
                    </li>
                  ))}
              </ul>
            )}
          </Panel>

          <Panel tone="subtle" className="gvs-card cc-reveal cc-reveal--pulse-late">
            <div className="gvs-card__header">
              <Heading as="h3" size="sm">
                GitHub Access
              </Heading>
              <Badge tone={resolveSectionConnectionTone(connection.status)}>{connection.provider === "app" ? "GitHub App" : "PAT"}</Badge>
            </div>
            <Text size="sm" tone="secondary">
              {connection.message}
            </Text>

            {!connection.isConnected && dataState !== "loading" ? (
              <Text size="sm" tone="muted">Connect GitHub to load authenticated governance posture data.</Text>
            ) : null}

            {showConnectAction ? (
              <div className="gvs-actions">
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
            <Panel tone="elevated" className="gvs-card gvs-state">
              <Heading as="h3" size="sm">
                Loading governance posture
              </Heading>
              <Text size="sm" tone="secondary">GitHealth is collecting governance and maintainability signals.</Text>
            </Panel>
          ) : null}

          {dataState === "empty" ? (
            <Panel tone="elevated" className="gvs-card gvs-state">
              <Heading as="h3" size="sm">
                No governance data available
              </Heading>
              <Text size="sm" tone="secondary">
                The API request completed, but no repository governance context was returned for this organization/source.
              </Text>
              <div className="gvs-actions">
                <Button variant="secondary" size="md" onClick={() => onRetry?.()} aria-label="Retry governance posture">
                  Retry
                </Button>
              </div>
            </Panel>
          ) : null}

          {dataState === "error" ? (
            <Panel tone="elevated" className="gvs-card gvs-state">
              <Heading as="h3" size="sm">
                Unable to load governance posture
              </Heading>
              <Text size="sm" tone="secondary">
                {integrationError?.message || "An unknown integration issue occurred while loading governance posture."}
              </Text>
              {integrationError?.code ? <Badge tone="critical">{integrationError.code}</Badge> : null}
              <div className="gvs-actions">
                <Button variant="secondary" size="md" onClick={() => onRetry?.()} aria-label="Retry governance posture">
                  Retry
                </Button>
              </div>
            </Panel>
          ) : null}

          <Panel tone="subtle" className="gvs-card gvs-repos cc-reveal cc-reveal--states">
            <Heading as="h3" size="sm">
              Repository Governance Context
            </Heading>

            {governanceRiskRepositories.length === 0 ? (
              <Text size="sm" tone="muted">No repository-level governance context is available for the current source.</Text>
            ) : (
              <ul className="gvs-repo-list" aria-label="Repository governance context">
                {governanceRiskRepositories.map((repository) => (
                  <li key={repository.id}>
                    <div>
                      <Text size="sm" tone="secondary">{repository.name}</Text>
                      <Text size="sm" tone="muted">Governance score: {repository.governanceScore} · Open issues: {repository.openIssues} · Pull requests: {repository.pullRequests}</Text>
                    </div>
                    <Badge tone={scoreTone(repository.governanceScore)}>{repository.governanceScore}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel tone="subtle" className="gvs-card gvs-insights cc-reveal cc-reveal--states">
            <Heading as="h3" size="sm">
              Governance Insights
            </Heading>

            {fallbackInsights.length === 0 ? (
              <Text size="sm" tone="muted">No governance insights are currently available for this source.</Text>
            ) : (
              <ul className="gvs-insight-list" aria-label="Governance insights">
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
