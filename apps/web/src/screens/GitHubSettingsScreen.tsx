import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Heading, Panel, Text } from "@githealth/ui";
import type { GitHubConnectionViewModel, GitHubHealthIntegrationState } from "../data/githubHealthContracts";
import { navItems } from "../mock/commandCenterData";
import type { AppScreen } from "../navigation";
import { useAsyncActionState } from "./useAsyncActionState";
import "./command-center.css";

type GitHubSettingsScreenProps = {
  activeNavId?: AppScreen;
  onNavigate?: (screen: AppScreen) => void;
  connection: GitHubConnectionViewModel;
  integrationState: GitHubHealthIntegrationState;
  isRefreshing?: boolean;
  integrationError?: {
    message: string;
    code: string;
    status: number;
  } | null;
  connectedOrganization?: string;
  organizationOptions?: string[];
  currentUserName?: string;
  currentWorkspaceName?: string;
  onConnectGitHub?: () => void | Promise<void>;
  onDisconnectGitHub?: () => void | Promise<void>;
  onSelectOrganization?: (organization: string) => void | Promise<void>;
  onRetry?: () => void;
  onLogout?: () => void | Promise<void>;
};

type SettingsConnectionState = "loading" | "connected" | "disconnected" | "configuration" | "development" | "error";

function resolveSettingsConnectionState(
  connection: GitHubConnectionViewModel,
  integrationState: GitHubHealthIntegrationState
): SettingsConnectionState {
  if (connection.provider === "pat") {
    return "development";
  }

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
  if (connection.provider === "oauth") {
    return "GitHub OAuth";
  }

  return connection.provider === "app" ? "GitHub App" : "Development fallback";
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

  if (state === "development") {
    return "Development fallback";
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

  if (state === "development") {
    return "warning";
  }

  return "neutral";
}

function primaryActionLabel(connection: GitHubConnectionViewModel): "Connect GitHub" | "Reconnect GitHub" | "Manage Connection" {
  if (connection.isConnected) {
    return "Manage Connection";
  }

  if (connection.status === "ready_to_connect") {
    return "Connect GitHub";
  }

  return "Reconnect GitHub";
}

function showDisconnectAction(connection: GitHubConnectionViewModel): boolean {
  return connection.provider === "oauth" && connection.isConnected;
}

function resolveSummary(state: SettingsConnectionState, connection: GitHubConnectionViewModel): string {
  if (connection.provider === "oauth") {
    if (state === "loading") {
      return "Checking GitHub OAuth connection state.";
    }

    if (state === "connected") {
      return "GitHub OAuth authentication is active for this user and workspace.";
    }

    if (state === "error") {
      return "GitHub OAuth connection requires attention before live data can be trusted.";
    }

    return "Connect your GitHub account to enable live organization health analysis in this workspace.";
  }

  if (connection.provider === "pat") {
    return "This environment is using server-side PAT fallback for development. No personal GitHub account is connected in the UI.";
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
  if (connection.provider === "oauth") {
    if (connection.status === "connecting") {
      return { show: true, disabled: true };
    }

    return { show: true, disabled: !connection.canConnect };
  }

  if (connection.provider !== "app") {
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
  isRefreshing = false,
  integrationError,
  connectedOrganization,
  organizationOptions = [],
  currentUserName,
  currentWorkspaceName,
  onConnectGitHub,
  onDisconnectGitHub,
  onSelectOrganization,
  onRetry,
  onLogout
}: GitHubSettingsScreenProps) {
  const currentState = resolveSettingsConnectionState(connection, integrationState);
  const action = resolveActionAvailability(connection);
  const normalizedOrganizationOptions = useMemo(
    () => [...new Set(organizationOptions.filter((organization) => organization.trim().length > 0))],
    [organizationOptions]
  );
  const effectiveSelectedOrganization = connectedOrganization ?? connection.organization ?? normalizedOrganizationOptions[0];
  const [pendingOrganization, setPendingOrganization] = useState(effectiveSelectedOrganization ?? "");

  useEffect(() => {
    setPendingOrganization(effectiveSelectedOrganization ?? "");
  }, [effectiveSelectedOrganization]);

  const showOrganizationSelector =
    connection.provider === "oauth" &&
    connection.isConnected &&
    normalizedOrganizationOptions.length > 1 &&
    typeof onSelectOrganization === "function";
  const connectAction = useAsyncActionState();
  const disconnectAction = useAsyncActionState();
  const selectOrganizationAction = useAsyncActionState();
  const retryAction = useAsyncActionState();
  const logoutAction = useAsyncActionState();

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
            {isRefreshing ? <Badge tone="neutral">Refreshing</Badge> : null}
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
              <span>
                {connection.provider === "pat"
                  ? "OAuth unavailable in this environment"
                  : connection.isConnected
                    ? "Live access available"
                    : "Live access unavailable"}
              </span>
              {connection.githubLogin ? <span>GitHub Account: {connection.githubLogin}</span> : null}
              <span>
                Organization: {effectiveSelectedOrganization ? effectiveSelectedOrganization : "Not available yet"}
              </span>
            </div>

            {showOrganizationSelector ? (
              <div className="ghs-org-selector">
                <label htmlFor="oauth-org-selector">Organization</label>
                <select
                  id="oauth-org-selector"
                  value={pendingOrganization}
                  onChange={(event) => setPendingOrganization(event.target.value)}
                  aria-label="Select GitHub organization"
                >
                  {normalizedOrganizationOptions.map((organization) => (
                    <option key={organization} value={organization}>
                      {organization}
                    </option>
                  ))}
                </select>
                <Button
                  variant="secondary"
                  size="md"
                  disabled={
                    !pendingOrganization ||
                    pendingOrganization === effectiveSelectedOrganization ||
                    selectOrganizationAction.isPending
                  }
                  onClick={() => {
                    if (!pendingOrganization || pendingOrganization === effectiveSelectedOrganization) {
                      return;
                    }

                    void selectOrganizationAction.run(() => onSelectOrganization?.(pendingOrganization));
                  }}
                  aria-label="Switch organization"
                >
                  {selectOrganizationAction.isPending ? "Switching..." : "Switch organization"}
                </Button>
              </div>
            ) : null}

            {action.show ? (
              <div className="ghs-actions">
                <Button
                  variant="primary"
                  size="md"
                  disabled={action.disabled || connectAction.isPending}
                  onClick={() => {
                    void connectAction.run(onConnectGitHub);
                  }}
                  aria-label={primaryActionLabel(connection)}
                >
                  {connectAction.isPending ? "Connecting..." : primaryActionLabel(connection)}
                </Button>
                {showDisconnectAction(connection) ? (
                  <Button
                    variant="tertiary"
                    size="md"
                    onClick={() => {
                      void disconnectAction.run(onDisconnectGitHub);
                    }}
                    disabled={disconnectAction.isPending}
                    aria-label="Disconnect GitHub"
                  >
                    {disconnectAction.isPending ? "Disconnecting..." : "Disconnect GitHub"}
                  </Button>
                ) : null}
                {currentState === "error" ? (
                  <Button
                    variant="tertiary"
                    size="md"
                    onClick={() => {
                      void retryAction.run(onRetry);
                    }}
                    disabled={retryAction.isPending}
                    aria-label="Retry status"
                  >
                    {retryAction.isPending ? "Retrying..." : "Retry status"}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </Panel>

          <Panel tone="subtle" className="ghs-card cc-reveal cc-reveal--signals">
            <Heading as="h3" size="sm">
              Workspace Access
            </Heading>
            <Text size="sm" tone="secondary">
              Signed in as {currentUserName ?? "Authenticated user"}.
            </Text>
            <Text size="sm" tone="muted">
              Workspace: {currentWorkspaceName ?? "Workspace unavailable"}. Credentials and access tokens are never rendered in this UI.
            </Text>
            <div className="ghs-actions">
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  void logoutAction.run(onLogout);
                }}
                disabled={logoutAction.isPending}
                aria-label="Log out of GitHealth"
              >
                {logoutAction.isPending ? "Logging out..." : "Log out"}
              </Button>
            </div>
          </Panel>

          <Panel tone="subtle" className="ghs-card cc-reveal cc-reveal--pulse-late">
            <Heading as="h3" size="sm">
              Troubleshooting
            </Heading>
            <Text size="sm" tone="secondary">
              {integrationError?.message || "If GitHub connection fails, check API environment configuration and organization authorization settings."}
            </Text>
            <Text size="sm" tone="muted">
              {connection.provider === "pat"
                ? "PAT remains a backend-only local development fallback. It is not treated as the signed-in user's GitHub identity and is never exposed in the browser."
                : "OAuth and any server-managed credentials stay on the API side and are never exposed in the browser."}
            </Text>
          </Panel>
        </section>
      </main>
    </div>
  );
}
