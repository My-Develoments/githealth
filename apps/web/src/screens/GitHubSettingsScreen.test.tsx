import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GitHubSettingsScreen } from "./GitHubSettingsScreen";
import type { GitHubConnectionViewModel, GitHubHealthIntegrationState } from "../data/githubHealthContracts";

afterEach(() => {
  cleanup();
});

describe("GitHubSettingsScreen", () => {
  it("shows loading state while connection status is resolving", () => {
    render(
      <GitHubSettingsScreen
        connection={buildConnection({ status: "connecting", canConnect: false })}
        integrationState="loading"
      />
    );

    expect(screen.getAllByText("Loading").length).toBeGreaterThan(0);
    expect(screen.getByText("Checking GitHub App connection and onboarding state.")).toBeTruthy();
  });

  it("shows connected organization and provider when connected", () => {
    render(
      <GitHubSettingsScreen
        connection={buildConnection({
          status: "connected",
          isConnected: true,
          canConnect: true,
          hasInstallationId: true,
          callbackRedirectConfigured: true,
          message: "GitHub App installation is connected."
        })}
        integrationState="ready"
        connectedOrganization="My-Develoments"
      />
    );

    expect(screen.getAllByText("Connected").length).toBeGreaterThan(0);
    expect(screen.getByText("Provider: GitHub App")).toBeTruthy();
    expect(screen.getByText("Organization: My-Develoments")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Connect GitHub" })).toBeNull();
  });

  it("uses Connect GitHub for ready-to-connect app mode", () => {
    const onConnectGitHub = vi.fn();

    render(
      <GitHubSettingsScreen
        connection={buildConnection({ status: "ready_to_connect", canConnect: true })}
        integrationState="empty"
        onConnectGitHub={onConnectGitHub}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Connect GitHub" }));
    expect(onConnectGitHub).toHaveBeenCalledTimes(1);
  });

  it("uses Reconnect GitHub when connection requires attention", () => {
    const onConnectGitHub = vi.fn();
    const onRetry = vi.fn();

    render(
      <GitHubSettingsScreen
        connection={buildConnection({
          status: "unauthorized_installation",
          canConnect: true,
          message: "Installed app is not authorized for this organization."
        })}
        integrationState="error"
        integrationError={{
          code: "PERMISSION_DENIED",
          message: "Installed app is not authorized for this organization.",
          status: 403
        }}
        onConnectGitHub={onConnectGitHub}
        onRetry={onRetry}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Reconnect GitHub" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry status" }));

    expect(onConnectGitHub).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("preserves PAT local-development behavior without connect action", () => {
    render(
      <GitHubSettingsScreen
        connection={{
          provider: "pat",
          status: "connected",
          isConnected: true,
          canConnect: false,
          hasInstallationId: false,
          installUrlConfigured: false,
          callbackRedirectConfigured: false,
          message: "Server-side GitHub PAT authentication is configured."
        }}
        integrationState="ready"
      />
    );

    expect(screen.getByText("PAT / Local development")).toBeTruthy();
    expect(screen.getByText("Server-managed GitHub access is active for this environment.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Connect GitHub" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reconnect GitHub" })).toBeNull();
  });

  it("shows configuration-required state when app onboarding is unavailable", () => {
    render(
      <GitHubSettingsScreen
        connection={buildConnection({
          status: "not_configured",
          canConnect: false,
          installUrlConfigured: false,
          callbackRedirectConfigured: false,
          message: "GitHub App onboarding is unavailable because GITHUB_APP_INSTALL_URL is not configured."
        })}
        integrationState="empty"
      />
    );

    const reconnect = screen.getByRole("button", { name: "Reconnect GitHub" });
    expect(reconnect.getAttribute("aria-disabled") === "true" || reconnect.hasAttribute("disabled")).toBe(true);
    expect(screen.getAllByText("Configuration required").length).toBeGreaterThan(0);
  });
});

function buildConnection(overrides: Partial<GitHubConnectionViewModel>): GitHubConnectionViewModel {
  return {
    provider: "app",
    status: "ready_to_connect",
    isConnected: false,
    canConnect: true,
    hasInstallationId: false,
    installUrlConfigured: true,
    callbackRedirectConfigured: true,
    message: "GitHub App is configured and ready to connect.",
    ...overrides
  };
}
