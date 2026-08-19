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

type CiCdHealthScreenProps = {
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

export function CiCdHealthScreen({
  activeNavId = "cicd",
  onNavigate,
  healthData,
  repositoryData,
  integrationState,
  connection,
  integrationError,
  onConnectGitHub,
  onRetry
}: CiCdHealthScreenProps) {
  const dataState = resolveSectionDataState(integrationState);
  const cicdSignal = healthData.categorySignals.find((signal) => signal.key === "cicd");

  const repositories = repositoryData.repositories;
  const lowCiCdRepositories = repositories.filter((repository) => repository.cicdScore > 0 && repository.cicdScore < 80);
  const highQueueRepositories = repositories.filter((repository) => repository.pullRequests >= 8);

  const deliveryRiskRepositories = [...repositories]
    .filter((repository) => repository.cicdScore > 0)
    .sort((left, right) => {
      if (left.cicdScore !== right.cicdScore) {
        return left.cicdScore - right.cicdScore;
      }

      return right.pullRequests - left.pullRequests;
    })
    .slice(0, 5);

  const cicdInsights = healthData.insights
    .filter((insight) => /ci|cd|pipeline|workflow|delivery|release|build|deploy/i.test(`${insight.title} ${insight.action}`))
    .slice(0, 3);

  const fallbackInsights = cicdInsights.length > 0 ? cicdInsights : healthData.insights.slice(0, 3);
  const showConnectAction = shouldShowSectionConnectAction(connection);
  const isConnectActionDisabled = isSectionConnectActionDisabled(connection);

  return (
    <div className="cc-shell chs-shell">
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
            Delivery Snapshot
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
              Delivery domain
            </Text>
            <Heading as="h2" size="display">
              CI / CD Health
            </Heading>
            <Text tone="secondary">
              {healthData.source === "mock"
                ? "Showing mock/demo CI / CD health posture from local fixtures."
                : "Showing API-backed CI / CD health posture from the configured GitHub source."}
            </Text>
          </div>

          <div className="cc-header-controls">
            <Badge tone={healthData.source === "mock" ? "warning" : "healthy"}>{`Source: ${healthData.source}`}</Badge>
            <Badge tone={resolveSectionConnectionTone(connection.status)}>{resolveSectionConnectionLabel(connection)}</Badge>
          </div>
        </header>

        <section className="chs-grid" aria-label="CI/CD health content">
          <Panel tone="elevated" className="chs-card chs-summary cc-reveal cc-reveal--hero">
            <div className="chs-card__header">
              <Heading as="h3" size="sm">
                Delivery Summary
              </Heading>
              <Badge tone={scoreTone(cicdSignal?.score ?? 0)}>
                {cicdSignal ? `${cicdSignal.score}` : "Unavailable"}
              </Badge>
            </div>

            <Text size="sm" tone="secondary">
              {cicdSignal
                ? `${cicdSignal.label} category signal from organization scoring.`
                : "CI / CD category signal is unavailable for the current source."}
            </Text>

            <div className="chs-meta">
              <span>Repositories evaluated: {healthData.totalRepositories}</span>
              <span>Low CI / CD score repos: {lowCiCdRepositories.length}</span>
              <span>High PR queue repos: {highQueueRepositories.length}</span>
              <span>Critical repos: {healthData.pulse.critical}</span>
              <span>Warning repos: {healthData.pulse.warning}</span>
            </div>
          </Panel>

          <Panel tone="subtle" className="chs-card cc-reveal cc-reveal--signals">
            <div className="chs-card__header">
              <Heading as="h3" size="sm">
                CI / CD Signals
              </Heading>
              <Badge tone={integrationState === "partial" ? "warning" : "neutral"}>{integrationState}</Badge>
            </div>

            {healthData.categorySignals.length === 0 ? (
              <Text size="sm" tone="muted">No category-level CI / CD signals are available.</Text>
            ) : (
              <ul className="chs-signal-list" aria-label="CI/CD category signals">
                {healthData.categorySignals
                  .filter((signal) => signal.key === "cicd" || signal.key === "quality")
                  .map((signal) => (
                    <li key={signal.key}>
                      <span>{signal.label}</span>
                      <Badge tone={signalToneBadge(signal.tone)}>{signal.score}</Badge>
                    </li>
                  ))}
              </ul>
            )}
          </Panel>

          <Panel tone="subtle" className="chs-card cc-reveal cc-reveal--pulse-late">
            <div className="chs-card__header">
              <Heading as="h3" size="sm">
                GitHub Access
              </Heading>
              <Badge tone={resolveSectionConnectionTone(connection.status)}>{connection.provider === "app" ? "GitHub App" : "PAT"}</Badge>
            </div>
            <Text size="sm" tone="secondary">
              {connection.message}
            </Text>

            {!connection.isConnected && dataState !== "loading" ? (
              <Text size="sm" tone="muted">Connect GitHub to load authenticated CI / CD posture data.</Text>
            ) : null}

            {showConnectAction ? (
              <div className="chs-actions">
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
            <Panel tone="elevated" className="chs-card chs-state">
              <Heading as="h3" size="sm">
                Loading CI / CD health
              </Heading>
              <Text size="sm" tone="secondary">GitHealth is collecting delivery and workflow-adjacent repository signals.</Text>
            </Panel>
          ) : null}

          {dataState === "empty" ? (
            <Panel tone="elevated" className="chs-card chs-state">
              <Heading as="h3" size="sm">
                No CI / CD data available
              </Heading>
              <Text size="sm" tone="secondary">
                The API request completed, but no repository CI / CD context was returned for this organization/source.
              </Text>
              <div className="chs-actions">
                <Button variant="secondary" size="md" onClick={() => onRetry?.()} aria-label="Retry CI/CD health">
                  Retry
                </Button>
              </div>
            </Panel>
          ) : null}

          {dataState === "error" ? (
            <Panel tone="elevated" className="chs-card chs-state">
              <Heading as="h3" size="sm">
                Unable to load CI / CD health
              </Heading>
              <Text size="sm" tone="secondary">
                {integrationError?.message || "An unknown integration issue occurred while loading CI / CD health."}
              </Text>
              {integrationError?.code ? <Badge tone="critical">{integrationError.code}</Badge> : null}
              <div className="chs-actions">
                <Button variant="secondary" size="md" onClick={() => onRetry?.()} aria-label="Retry CI/CD health">
                  Retry
                </Button>
              </div>
            </Panel>
          ) : null}

          <Panel tone="subtle" className="chs-card chs-repos cc-reveal cc-reveal--states">
            <Heading as="h3" size="sm">
              Repository Delivery Context
            </Heading>

            {deliveryRiskRepositories.length === 0 ? (
              <Text size="sm" tone="muted">No repository-level CI / CD context is available for the current source.</Text>
            ) : (
              <ul className="chs-repo-list" aria-label="Repository CI/CD context">
                {deliveryRiskRepositories.map((repository) => (
                  <li key={repository.id}>
                    <div>
                      <Text size="sm" tone="secondary">{repository.name}</Text>
                      <Text size="sm" tone="muted">CI / CD score: {repository.cicdScore} · Open issues: {repository.openIssues} · Pull requests: {repository.pullRequests}</Text>
                    </div>
                    <Badge tone={scoreTone(repository.cicdScore)}>{repository.cicdScore}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel tone="subtle" className="chs-card chs-insights cc-reveal cc-reveal--states">
            <Heading as="h3" size="sm">
              Delivery Insights
            </Heading>

            {fallbackInsights.length === 0 ? (
              <Text size="sm" tone="muted">No CI / CD insights are currently available for this source.</Text>
            ) : (
              <ul className="chs-insight-list" aria-label="CI/CD insights">
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

          <Panel tone="subtle" className="chs-card chs-limitations cc-reveal cc-reveal--states">
            <Heading as="h3" size="sm">
              Workflow Data Coverage
            </Heading>
            <Text size="sm" tone="secondary">
              Current frontend contracts expose category-level CI / CD scores and repository-level health context, but not workflow run, deployment frequency, lead time, or failure-rate series.
            </Text>
            <Text size="sm" tone="muted">
              This screen intentionally avoids inventing pipeline/build/deployment values and only reports metrics currently supported by GitHealth view models.
            </Text>
          </Panel>
        </section>
      </main>
    </div>
  );
}
