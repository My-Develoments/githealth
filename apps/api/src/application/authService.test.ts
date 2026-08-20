import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { createBootstrapSession, resolveAuthenticatedSession, signInOrCreateUserFromGitHubIdentity, signOutUser } from "./authService.js";
import { setAuthStoreForTests } from "../infrastructure/auth/authStore.js";
import { createTestAuthStore } from "../infrastructure/auth/testAuthStore.js";

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

describe("authService", () => {
  afterEach(() => {
    setAuthStoreForTests(undefined);
  });

  it("rejects expired sessions and removes them from persistence", async () => {
    const store = createTestAuthStore();
    await store.initialize();
    setAuthStoreForTests(store);

    const rawToken = "expired-session-token";
    const hashedToken = tokenHash(rawToken);

    await store.createUserWorkspaceSession({
      user: {
        id: "user-expired",
        email: "expired@example.com",
        displayName: "Expired User",
        passwordHash: "hash",
        defaultWorkspaceId: "workspace-expired",
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      workspace: {
        id: "workspace-expired",
        name: "Expired Workspace",
        ownerUserId: "user-expired",
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      session: {
        id: "session-expired",
        tokenHash: hashedToken,
        userId: "user-expired",
        workspaceId: "workspace-expired",
        createdAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-01-01T01:00:00.000Z"
      }
    });

    const resolved = await resolveAuthenticatedSession(rawToken);
    expect(resolved).toBeNull();

    const persisted = await store.findPersistedAuthContextByTokenHash(hashedToken);
    expect(persisted).toBeUndefined();
  });

  it("deletes active session token on sign out", async () => {
    const store = createTestAuthStore();
    await store.initialize();
    setAuthStoreForTests(store);

    const rawToken = "signout-session-token";
    const hashedToken = tokenHash(rawToken);

    await store.createUserWorkspaceSession({
      user: {
        id: "user-signout",
        email: "signout@example.com",
        displayName: "Signout User",
        passwordHash: "hash",
        defaultWorkspaceId: "workspace-signout",
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      workspace: {
        id: "workspace-signout",
        name: "Signout Workspace",
        ownerUserId: "user-signout",
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      session: {
        id: "session-signout",
        tokenHash: hashedToken,
        userId: "user-signout",
        workspaceId: "workspace-signout",
        createdAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2027-01-01T01:00:00.000Z"
      }
    });

    await signOutUser(rawToken);

    const persisted = await store.findPersistedAuthContextByTokenHash(hashedToken);
    expect(persisted).toBeUndefined();
  });

  it("creates a secure bootstrap session for OAuth-first entry", async () => {
    const store = createTestAuthStore();
    await store.initialize();
    setAuthStoreForTests(store);

    const result = await createBootstrapSession();
    const resolved = await resolveAuthenticatedSession(result.sessionToken);

    expect(result.sessionToken.length).toBeGreaterThan(20);
    expect(result.authenticatedApp.user.email.endsWith("@users.githealth.local")).toBe(true);
    expect(resolved?.workspace.id).toBe(result.authenticatedApp.workspace.id);
  });

  it("creates a new GitHealth user session from a new GitHub identity", async () => {
    const store = createTestAuthStore();
    await store.initialize();
    setAuthStoreForTests(store);

    const result = await signInOrCreateUserFromGitHubIdentity({
      githubUserId: "12345",
      githubLogin: "octocat"
    });

    expect(result.authenticatedApp.user.email).toBe("github-user-12345@users.githealth.local");
    expect(result.authenticatedApp.user.displayName).toBe("octocat");
    expect(result.sessionToken.length).toBeGreaterThan(20);
  });

  it("reuses an existing GitHealth user linked to the GitHub identity", async () => {
    const store = createTestAuthStore();
    await store.initialize();
    setAuthStoreForTests(store);

    await store.createUserWorkspaceSession({
      user: {
        id: "user-oauth-linked",
        email: "linked@example.com",
        displayName: "Linked User",
        passwordHash: "hash",
        defaultWorkspaceId: "workspace-oauth-linked",
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      workspace: {
        id: "workspace-oauth-linked",
        name: "Linked Workspace",
        ownerUserId: "user-oauth-linked",
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      session: {
        id: "session-oauth-linked",
        tokenHash: "linked-token-hash",
        userId: "user-oauth-linked",
        workspaceId: "workspace-oauth-linked",
        createdAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2027-01-01T00:00:00.000Z"
      }
    });

    await store.upsertWorkspaceGitHubOAuthConnection({
      workspaceId: "workspace-oauth-linked",
      userId: "user-oauth-linked",
      githubUserId: "99999",
      githubLogin: "linked-octocat",
      accessTokenCiphertext: "ciphertext",
      accessTokenIv: "iv",
      accessTokenTag: "tag",
      scopes: ["read:org"],
      connectedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    });

    const result = await signInOrCreateUserFromGitHubIdentity({
      githubUserId: "99999",
      githubLogin: "linked-octocat"
    });

    expect(result.authenticatedApp.user.id).toBe("user-oauth-linked");
    expect(result.authenticatedApp.workspace.id).toBe("workspace-oauth-linked");
    expect(result.sessionToken.length).toBeGreaterThan(20);
  });
});
