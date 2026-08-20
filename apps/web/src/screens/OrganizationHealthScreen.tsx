import { Badge, Button, Heading, Panel, Text } from "@githealth/ui";
import type { CommandCenterHealthViewModel } from "../data/githubHealthViewMappers";
import type { GitHubConnectionViewModel, GitHubHealthIntegrationState } from "../data/githubHealthContracts";
import { navItems } from "../mock/commandCenterData";
import type { AppScreen } from "../navigation";
import {
  isSectionConnectActionDisabled,
  resolveSectionConnectActionLabel,
  resolveSectionConnectionLabel,
  resolveSectionConnectionTone,
  resolveSectionDataState,
  resolveSectionProviderLabel,
  scoreTone,
  shouldShowSectionConnectAction
} from "./sectionScreenShared";
import { useAsyncActionState } from "./useAsyncActionState";
import "./command-center.css";

type OrganizationHealthScreenProps = {
  activeNavId?: AppScreen;
  onNavigate?: (screen: AppScreen) => void;
  healthData: CommandCenterHealthViewModel;
  integrationState: GitHubHealthIntegrationState;
  isRefreshing?: boolean;
  connection: GitHubConnectionViewModel;
  integrationError?: {
    message: string;
    code: string;
    status: number;
  } | null;
  onConnectGitHub?: () => void | Promise<void>;
  onRetry?: () => void;
};

function signalToneClass(tone: CommandCenterHealthViewModel["categorySignals"][number]["tone"]): "healthy" | "warning" | "critical" | "neutral" | "unknown" {
  return tone;
}

export function OrganizationHealthScreen({
  activeNavId = "health-intelligence",
  onNavigate,
  healthData,
  integrationState,
  isRefreshing = false,
  connection,
  integrationError,
  onConnectGitHub,
  onRetry
}: OrganizationHealthScreenProps) {
  const dataState = resolveSectionDataState(integrationState);
  const hasLiveData = dataState === "ready" && healthData.totalRepositories > 0;
  const isLoading = dataState === "loading";
  const providerLabel = resolveSectionProviderLabel(connection);
  const connectAction = useAsyncActionState();
  const retryAction = useAsyncActionState();

  return (
    <div className="cc-shell ohs-shell">
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
            Organization Snapshot
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
              Organization overview
            </Text>
            <Heading as="h2" size="display">
              Organization Health
            </Heading>
            <Text tone="secondary">
              {healthData.source === "mock"
                ? "Showing mock/demo organization health signals from local fixtures."
                : "Showing API-backed organization health signals from the configured GitHub source."}
            </Text>
          </div>

          <div className="cc-header-controls">
            <Badge tone={healthData.source === "mock" ? "warning" : "healthy"}>{`Source: ${healthData.source}`}</Badge>
            <Badge tone={resolveSectionConnectionTone(connection.status)}>{resolveSectionConnectionLabel(connection)}</Badge>
            {isRefreshing ? <Badge tone="neutral">Refreshing</Badge> : null}
          </div>
        </header>

        <section className="ohs-grid" aria-label="Organization health content">
          <Panel tone="elevated" className="ohs-card ohs-summary cc-reveal cc-reveal--hero">
            <div className="ohs-card__header">
              <Heading as="h3" size="sm">
                Overall Health
              </Heading>
              <Badge tone={isLoading ? "neutral" : scoreTone(healthData.score)}>
                {isLoading ? "Loading" : healthData.scoreStatus}
              </Badge>
            </div>

            {isLoading ? (
              <div className="cc-skeleton" aria-label="Loading overall health score">
                <span />
                <span />
                <span />
              </div>
            ) : hasLiveData ? (
              <>
                <div className="ohs-score">
                  <span className="ohs-score__value">{healthData.score}</span>
                  <span className="ohs-score__label">Overall score</span>
                </div>

                <div className="ohs-meta">
                  <span>Repositories: {healthData.totalRepositories}</span>
                  <span>Healthy: {healthData.pulse.healthy}</span>
                  <span>Warning: {healthData.pulse.warning}</span>
                  <span>Critical: {healthData.pulse.critical}</span>
                  <span>Last scan: {healthData.pulse.lastScan}</span>
                </div>
              </>
            ) : (
              <Text size="sm" tone="muted">
                {integrationError?.message || "Connect GitHub and run a live scan to load organization health metrics."}
              </Text>
            )}
          </Panel>

          <Panel tone="subtle" className="ohs-card cc-reveal cc-reveal--signals">
            <div className="ohs-card__header">
              <Heading as="h3" size="sm">
                Category Signals
              </Heading>
              <Badge tone={integrationState === "partial" ? "warning" : "neutral"}>{integrationState}</Badge>
            </div>

            {isLoading ? (
              <div className="cc-skeleton" aria-label="Loading organization category signals">
                <span />
                <span />
                <span />
              </div>
            ) : healthData.categorySignals.length === 0 ? (
              <Text size="sm" tone="muted">No category signals are available for the current source.</Text>
            ) : (
              <ul className="ohs-signal-list" aria-label="Health category signals">
                {healthData.categorySignals.map((signal) => (
                  <li key={signal.key}>
                    <span>{signal.label}</span>
                    <Badge tone={signalToneClass(signal.tone)}>{signal.score}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel tone="subtle" className="ohs-card cc-reveal cc-reveal--pulse-late">
            <div className="ohs-card__header">
              <Heading as="h3" size="sm">
                GitHub Connection
              </Heading>
              <Badge tone={resolveSectionConnectionTone(connection.status)}>{providerLabel}</Badge>
            </div>
            <Text size="sm" tone="secondary">
              {connection.message}
            </Text>
            {!hasLiveData && dataState !== "loading" ? (
              <Text size="sm" tone="muted">
                {connection.isConnected
                  ? "Organization health data is currently unavailable from the selected source."
                  : "Connect GitHub to load live organization health data."}
              </Text>
            ) : null}

            {shouldShowSectionConnectAction(connection) ? (
              <div className="ohs-actions">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    void connectAction.run(onConnectGitHub);
                  }}
                  disabled={isSectionConnectActionDisabled(connection) || connectAction.isPending}
                  aria-label={resolveSectionConnectActionLabel(connection)}
                >
                  {connectAction.isPending ? "Connecting..." : resolveSectionConnectActionLabel(connection)}
                </Button>
              </div>
            ) : null}
          </Panel>

          {dataState === "loading" ? (
            <Panel tone="elevated" className="ohs-card ohs-state">
              <Heading as="h3" size="sm">
                Loading organization health
              </Heading>
              <Text size="sm" tone="secondary">
                GitHealth is collecting organization-level health signals.
              </Text>
            </Panel>
          ) : null}

          {dataState === "empty" ? (
            <Panel tone="elevated" className="ohs-card ohs-state">
              <Heading as="h3" size="sm">
                No organization data available
              </Heading>
              <Text size="sm" tone="secondary">
                The API request completed, but no repositories were returned for this organization/source.
              </Text>
              <div className="ohs-actions">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    void retryAction.run(onRetry);
                  }}
                  disabled={retryAction.isPending}
                  aria-label="Retry organization health"
                >
                  {retryAction.isPending ? "Retrying..." : "Retry"}
                </Button>
              </div>
            </Panel>
          ) : null}

          {dataState === "error" ? (
            <Panel tone="elevated" className="ohs-card ohs-state">
              <Heading as="h3" size="sm">
                Unable to load organization health
              </Heading>
              <Text size="sm" tone="secondary">
                {integrationError?.message || "An unknown integration issue occurred while loading organization health."}
              </Text>
              {integrationError?.code ? <Badge tone="critical">{integrationError.code}</Badge> : null}
              <div className="ohs-actions">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    void retryAction.run(onRetry);
                  }}
                  disabled={retryAction.isPending}
                  aria-label="Retry organization health"
                >
                  {retryAction.isPending ? "Retrying..." : "Retry"}
                </Button>
              </div>
            </Panel>
          ) : null}

          <Panel tone="subtle" className="ohs-card ohs-insights cc-reveal cc-reveal--states">
            <Heading as="h3" size="sm">
              Top Insights
            </Heading>
            {healthData.insights.length === 0 ? (
              <Text size="sm" tone="muted">No insights are currently available for this organization.</Text>
            ) : (
              <ul className="ohs-insight-list" aria-label="Organization insights">
                {healthData.insights.slice(0, 3).map((insight) => (
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
