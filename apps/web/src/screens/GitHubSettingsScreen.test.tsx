import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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
          provider: "oauth",
          status: "connected",
          isConnected: true,
          canConnect: true,
          hasInstallationId: false,
          installUrlConfigured: false,
          callbackRedirectConfigured: true,
          message: "GitHub OAuth is connected for this workspace.",
          githubLogin: "octocat"
        })}
        integrationState="ready"
        connectedOrganization="My-Develoments"
      />
    );

    expect(screen.getAllByText("Connected").length).toBeGreaterThan(0);
    expect(screen.getByText("Provider: GitHub OAuth")).toBeTruthy();
    expect(screen.getByText("GitHub Account: octocat")).toBeTruthy();
    expect(screen.getByText("Organization: My-Develoments")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Manage Connection" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Disconnect GitHub" })).toBeTruthy();
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

  it("shows connect loading state while async connect is in progress", async () => {
    let resolveConnect: (() => void) | undefined;
    const onConnectGitHub = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveConnect = resolve;
        })
    );

    render(
      <GitHubSettingsScreen
        connection={buildConnection({ status: "ready_to_connect", canConnect: true })}
        integrationState="empty"
        onConnectGitHub={onConnectGitHub}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Connect GitHub" }));

    const button = screen.getByRole("button", { name: "Connect GitHub" });
    expect(button.textContent).toBe("Connecting...");
    expect(button.getAttribute("aria-disabled") === "true" || button.hasAttribute("disabled")).toBe(true);

    await act(async () => {
      resolveConnect?.();
    });
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

    expect(screen.getAllByText("Development fallback").length).toBeGreaterThan(0);
    expect(screen.getByText("This environment is using server-side PAT fallback for development. No personal GitHub account is connected in the UI.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Connect GitHub" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reconnect GitHub" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Disconnect GitHub" })).toBeNull();
  });

  it("invokes disconnect action for connected oauth account", () => {
    const onDisconnectGitHub = vi.fn();

    render(
      <GitHubSettingsScreen
        connection={buildConnection({
          provider: "oauth",
          status: "connected",
          isConnected: true,
          canConnect: true,
          hasInstallationId: false,
          installUrlConfigured: false,
          callbackRedirectConfigured: true,
          githubLogin: "octocat",
          message: "GitHub OAuth is connected for this workspace."
        })}
        integrationState="ready"
        onDisconnectGitHub={onDisconnectGitHub}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Disconnect GitHub" }));
    expect(onDisconnectGitHub).toHaveBeenCalledTimes(1);
  });

  it("shows organization selector for multi-org OAuth connections and switches org", () => {
    const onSelectOrganization = vi.fn();

    render(
      <GitHubSettingsScreen
        connection={buildConnection({
          provider: "oauth",
          status: "connected",
          isConnected: true,
          canConnect: true,
          hasInstallationId: false,
          installUrlConfigured: false,
          callbackRedirectConfigured: true,
          githubLogin: "octocat",
          message: "GitHub OAuth is connected for this workspace."
        })}
        integrationState="ready"
        connectedOrganization="xebia-playground"
        organizationOptions={["xebia-playground", "xebia"]}
        onSelectOrganization={onSelectOrganization}
      />
    );

    fireEvent.change(screen.getByLabelText("Select GitHub organization"), {
      target: {
        value: "xebia"
      }
    });

    fireEvent.click(screen.getByRole("button", { name: "Switch organization" }));
    expect(onSelectOrganization).toHaveBeenCalledWith("xebia");
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
