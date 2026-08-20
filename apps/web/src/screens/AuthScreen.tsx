import { Badge, Button, Heading, Panel, Text } from "@githealth/ui";

type AuthScreenProps = {
  isLoading: boolean;
  error?: string | null;
  onContinueWithGitHub: () => void | Promise<void>;
};

export function AuthScreen({ isLoading, error, onContinueWithGitHub }: AuthScreenProps) {
  return (
    <main className="auth-shell" aria-label="Authentication">
      <section className="auth-hero auth-reveal">
        <Badge tone="healthy">GitHealth Workspace Access</Badge>
        <Heading as="h1" size="display">
          Continue with GitHub
        </Heading>
        <Text tone="secondary">
          GitHub authentication is used to securely access your GitHealth workspace and load your organization data through protected server-side APIs.
        </Text>
        <div className="auth-hero__highlights">
          <span>Server-side sessions</span>
          <span>Workspace isolation foundation</span>
          <span>GitHub App onboarding compatible</span>
        </div>
      </section>

      <Panel tone="elevated" className="auth-panel auth-reveal" aria-live="polite">
        <div className="auth-panel__header">
          <div>
            <Text size="sm" tone="muted">Welcome to GitHealth</Text>
            <Heading as="h2" size="xl">Continue with GitHub</Heading>
          </div>
          <Badge tone="healthy">Primary sign-in</Badge>
        </div>

        <Text size="sm" tone="muted">
          Continue with GitHub to authenticate, provision or find your GitHealth user and workspace, and enter your command center.
        </Text>

        <div className="auth-actions">
          <Button
            type="button"
            variant="primary"
            size="lg"
            disabled={isLoading}
            aria-label="Continue with GitHub"
            onClick={() => {
              void onContinueWithGitHub();
            }}
          >
            {isLoading ? "Redirecting to GitHub..." : "Continue with GitHub"}
          </Button>
        </div>

        {error ? <Text className="auth-error" size="sm">{error}</Text> : null}
      </Panel>
    </main>
  );
}

export function AuthLoadingScreen() {
  return (
    <main className="auth-shell" aria-label="Authentication loading state">
      <Panel tone="elevated" className="auth-panel auth-panel--loading">
        <Badge tone="neutral">Resolving session</Badge>
        <Heading as="h1" size="xl">Preparing your GitHealth workspace</Heading>
        <Text tone="secondary">
          Verifying your secure session before the application loads protected engineering data.
        </Text>
      </Panel>
    </main>
  );
}