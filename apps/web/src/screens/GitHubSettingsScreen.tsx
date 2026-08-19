import { Badge, Button, Heading, Panel, Text } from "@githealth/ui";
import type { GitHubConnectionViewModel, GitHubHealthIntegrationState } from "../data/githubHealthContracts";
import { navItems } from "../mock/commandCenterData";
import type { AppScreen } from "../navigation";
import "./command-center.css";

type GitHubSettingsScreenProps = {
  activeNavId?: AppScreen;
  onNavigate?: (screen: AppScreen) => void;
  connection: GitHubConnectionViewModel;
  integrationState: GitHubHealthIntegrationState;
  integrationError?: {
    message: string;
    code: string;
    status: number;
  } | null;
  connectedOrganization?: string;
  onConnectGitHub?: () => void | Promise<void>;
  onRetry?: () => void;
};

type SettingsConnectionState = "loading" | "connected" | "disconnected" | "configuration" | "error";

function resolveSettingsConnectionState(
  connection: GitHubConnectionViewModel,
  integrationState: GitHubHealthIntegrationState
): SettingsConnectionState {
  if (connection.status === "not_configured") {
    return "configuration";
  }

  if (connection.status === "error" || connection.status === "unauthorized_installation") {
    return "error";
  }

  if (connection.status === "connecting" || connection.status === "installation_completed" || integrationState === "loading") {
    return "loading";
  }

  if (connection.isConnected) {
    return "connected";
  }

  return "disconnected";
}

function providerLabel(connection: GitHubConnectionViewModel): string {
  return connection.provider === "app" ? "GitHub App" : "PAT / Local development";
}

function stateLabel(state: SettingsConnectionState): string {
  if (state === "connected") {
    return "Connected";
  }

  if (state === "loading") {
    return "Loading";
  }

  if (state === "configuration") {
    return "Configuration required";
  }

  if (state === "error") {
    return "Needs attention";
  }

  return "Disconnected";
}

function stateTone(state: SettingsConnectionState): "healthy" | "warning" | "neutral" | "critical" {
  if (state === "connected") {
    return "healthy";
  }

  if (state === "loading") {
    return "neutral";
  }

  if (state === "configuration") {
    return "warning";
  }

  if (state === "error") {
    return "critical";
  }

  return "neutral";
}

function primaryActionLabel(connection: GitHubConnectionViewModel): "Connect GitHub" | "Reconnect GitHub" {
  if (connection.status === "ready_to_connect") {
    return "Connect GitHub";
  }

  return "Reconnect GitHub";
}

function resolveSummary(state: SettingsConnectionState, connection: GitHubConnectionViewModel): string {
  if (connection.provider === "pat") {
    return "Server-managed GitHub access is active for this environment.";
  }

  if (state === "loading") {
    return "Checking GitHub App connection and onboarding state.";
  }

  if (state === "connected") {
    return "GitHub App authentication is active and ready for live organization scans.";
  }

  if (state === "configuration") {
    return "GitHub App onboarding is not configured on the API deployment for this environment.";
  }

  if (state === "error") {
    return "GitHub App access requires attention before live data can be trusted.";
  }

  return "Connect GitHub App to enable live organization health analysis in this workspace.";
}

function resolveActionAvailability(connection: GitHubConnectionViewModel): { show: boolean; disabled: boolean } {
  if (connection.provider !== "app" || connection.isConnected) {
    return { show: false, disabled: true };
  }

  if (connection.status === "connecting" || connection.status === "installation_completed") {
    return { show: true, disabled: true };
  }

  if (connection.status === "not_configured") {
    return { show: true, disabled: true };
  }

  return { show: true, disabled: !connection.canConnect };
}

export function GitHubSettingsScreen({
  activeNavId = "settings",
  onNavigate,
  connection,
  integrationState,
  integrationError,
  connectedOrganization,
  onConnectGitHub,
  onRetry
}: GitHubSettingsScreenProps) {
  const currentState = resolveSettingsConnectionState(connection, integrationState);
  const action = resolveActionAvailability(connection);

  return (
    <div className="cc-shell ghs-shell">
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
            Integration Source
          </Text>
          <Heading as="h2" size="md">
            GitHub Settings
          </Heading>
          <Text size="sm" tone="secondary">
            Configure and verify GitHub connectivity without exposing secrets in the browser.
          </Text>
        </Panel>
      </aside>

      <main className="cc-main sp-main">
        <header className="cc-header cc-reveal cc-reveal--header">
          <div className="cc-header-title">
            <Text size="sm" tone="muted">
              Platform integration
            </Text>
            <Heading as="h2" size="display">
              GitHub Settings
            </Heading>
            <Text tone="secondary">{resolveSummary(currentState, connection)}</Text>
          </div>

          <div className="cc-header-controls">
            <Badge tone={stateTone(currentState)}>{stateLabel(currentState)}</Badge>
            <Badge tone="neutral">{providerLabel(connection)}</Badge>
          </div>
        </header>

        <section className="ghs-grid" aria-label="GitHub integration settings">
          <Panel tone="elevated" className="ghs-card cc-reveal cc-reveal--hero">
            <div className="ghs-card__header">
              <Heading as="h3" size="sm">
                Connection Status
              </Heading>
              <Badge tone={stateTone(currentState)}>{stateLabel(currentState)}</Badge>
            </div>

            <Text size="sm" tone="secondary">
              {connection.message}
            </Text>

            <div className="ghs-meta">
              <span>Provider: {providerLabel(connection)}</span>
              <span>{connection.isConnected ? "Live access available" : "Live access unavailable"}</span>
              <span>
                Organization: {connectedOrganization ? connectedOrganization : "Not available yet"}
              </span>
            </div>

            {action.show ? (
              <div className="ghs-actions">
                <Button
                  variant="primary"
                  size="md"
                  disabled={action.disabled}
                  onClick={() => {
                    void onConnectGitHub?.();
                  }}
                  aria-label={primaryActionLabel(connection)}
                >
                  {primaryActionLabel(connection)}
                </Button>
                {currentState === "error" ? (
                  <Button
                    variant="tertiary"
                    size="md"
                    onClick={() => onRetry?.()}
                    aria-label="Retry status"
                  >
                    Retry status
                  </Button>
                ) : null}
              </div>
            ) : null}
          </Panel>

          <Panel tone="subtle" className="ghs-card cc-reveal cc-reveal--signals">
            <Heading as="h3" size="sm">
              What This Screen Shows
            </Heading>
            <Text size="sm" tone="secondary">
              Status and provider metadata come from the existing connection status endpoint and frontend data adapters.
            </Text>
            <Text size="sm" tone="muted">
              Credentials such as PATs, private keys, JWTs, and installation access tokens are never rendered in this UI.
            </Text>
          </Panel>

          <Panel tone="subtle" className="ghs-card cc-reveal cc-reveal--pulse-late">
            <Heading as="h3" size="sm">
              Troubleshooting
            </Heading>
            <Text size="sm" tone="secondary">
              {integrationError?.message || "If GitHub connection fails, check API environment configuration and organization authorization settings."}
            </Text>
            <Text size="sm" tone="muted">
              For local PAT mode, keep credentials server-side and continue using environment-based API authentication.
            </Text>
          </Panel>
        </section>
      </main>
    </div>
  );
}
