import { Badge, Button, Heading, Panel, Text } from "@githealth/ui";
import type { GitHubConnectionViewModel } from "../data/githubHealthContracts";
import { navItems } from "../mock/commandCenterData";
import type { AppRouteDefinition, AppScreen } from "../navigation";
import "./command-center.css";

type SectionPlaceholderScreenProps = {
  activeScreen: AppScreen;
  route: AppRouteDefinition;
  connection: GitHubConnectionViewModel;
  onNavigate: (screen: AppScreen) => void;
  onConnectGitHub?: () => void | Promise<void>;
};

function resolveStatusTone(availability: AppRouteDefinition["availability"]): "healthy" | "warning" {
  return availability === "live" ? "healthy" : "warning";
}

export function SectionPlaceholderScreen({ activeScreen, route, connection, onNavigate, onConnectGitHub }: SectionPlaceholderScreenProps) {
  const canConnect = connection.provider === "app" && !connection.isConnected && connection.canConnect;

  return (
    <div className="cc-shell sp-shell">
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
              variant={item.id === activeScreen ? "primary" : "tertiary"}
              size="md"
              selected={item.id === activeScreen}
              className="cc-nav-item"
              aria-current={item.id === activeScreen ? "page" : undefined}
              onClick={() => onNavigate(item.id as AppScreen)}
            >
              {item.label}
            </Button>
          ))}
        </nav>

        <Panel tone="elevated" className="cc-rail-status cc-reveal cc-reveal--xp">
          <Text size="sm" tone="muted">
            Navigation Ready
          </Text>
          <Heading as="h2" size="md">
            {route.title}
          </Heading>
          <Text size="sm" tone="secondary">
            {route.availability === "live" ? "Section is active." : "Section scaffold is available while data integration is in progress."}
          </Text>
        </Panel>
      </aside>

      <main className="cc-main sp-main">
        <header className="cc-header cc-reveal cc-reveal--header">
          <div className="cc-header-title">
            <Text size="sm" tone="muted">
              GitHealth platform section
            </Text>
            <Heading as="h2" size="display">
              {route.title}
            </Heading>
            <Text tone="secondary">
              {route.description}
            </Text>
          </div>

          <div className="cc-header-controls">
            <Badge tone={resolveStatusTone(route.availability)}>{route.availability === "live" ? "Live" : "Coming Soon"}</Badge>
            <Badge tone={connection.isConnected ? "healthy" : connection.canConnect ? "neutral" : "unknown"}>
              {connection.provider === "app" ? "GitHub App" : "PAT"}
            </Badge>
          </div>
        </header>

        <section className="sp-grid" aria-label={`${route.title} section overview`}>
          <Panel tone="elevated" className="sp-hero cc-reveal cc-reveal--hero">
            <div className="sp-hero__header">
              <Heading as="h3" size="sm">
                Section Status
              </Heading>
              <Badge tone={resolveStatusTone(route.availability)}>{route.availability === "live" ? "Available" : "Planned"}</Badge>
            </div>
            <Text size="sm" tone="secondary">
              {route.availability === "live"
                ? "This section is wired into the current GitHealth experience."
                : "This section is intentionally present in navigation, but it does not yet expose live API-backed data in this repository."}
            </Text>
            <Text size="sm" tone="muted">
              The screen exists to preserve stable navigation, browser history support, and a clear product information architecture while the remaining domain-specific implementation is added.
            </Text>
          </Panel>

          <Panel tone="subtle" className="sp-card cc-reveal cc-reveal--signals">
            <Heading as="h3" size="sm">
              Current Purpose
            </Heading>
            <Text size="sm" tone="secondary">
              {route.description}
            </Text>
            <Text size="sm" tone="muted">
              No synthetic live metrics are shown here. When domain data is implemented, this section can adopt the same GitHealth visual system without changing routes.
            </Text>
          </Panel>

          <Panel tone="subtle" className="sp-card cc-reveal cc-reveal--pulse-late">
            <Heading as="h3" size="sm">
              GitHub Access
            </Heading>
            <Text size="sm" tone="secondary">
              {connection.message}
            </Text>
            <Text size="sm" tone="muted">
              {connection.isConnected
                ? "GitHub access is ready for future data-backed views in this section."
                : "Connect GitHub first if you want this section to consume live organization data once implemented."}
            </Text>
            {canConnect ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void onConnectGitHub?.();
                }}
                aria-label="Connect GitHub"
              >
                Connect GitHub
              </Button>
            ) : null}
          </Panel>
        </section>
      </main>
    </div>
  );
}