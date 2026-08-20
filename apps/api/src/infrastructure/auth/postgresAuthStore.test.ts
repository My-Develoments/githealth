import { describe, expect, it } from "vitest";
import { createTestAuthStore } from "./testAuthStore.js";

describe("postgresAuthStore", () => {
  it("persists sessions and workspace github connections in the configured auth store", async () => {
    const store = createTestAuthStore();
    await store.initialize();

    await store.createUserWorkspaceSession({
      user: {
        id: "user-1",
        email: "kuldeep@example.com",
        displayName: "Kuldeep",
        passwordHash: "hash",
        defaultWorkspaceId: "workspace-1",
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      workspace: {
        id: "workspace-1",
        name: "Kuldeep's Workspace",
        ownerUserId: "user-1",
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      session: {
        id: "session-1",
        tokenHash: "token-hash-1",
        userId: "user-1",
        workspaceId: "workspace-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-01-08T00:00:00.000Z"
      }
    });

    await store.upsertWorkspaceGitHubConnection({
      workspaceId: "workspace-1",
      provider: "app",
      organization: "githealth-labs",
      installationId: 77,
      connectedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    });

    const persistedContext = await store.findPersistedAuthContextByTokenHash("token-hash-1");
    const workspaceConnection = await store.findWorkspaceGitHubConnection("workspace-1");

    expect(persistedContext?.user.email).toBe("kuldeep@example.com");
    expect(persistedContext?.workspace.name).toBe("Kuldeep's Workspace");
    expect(workspaceConnection?.installationId).toBe(77);
    expect(workspaceConnection?.organization).toBe("githealth-labs");
  });

  it("deletes sessions by token hash", async () => {
    const store = createTestAuthStore();
    await store.initialize();

    await store.createUserWorkspaceSession({
      user: {
        id: "user-2",
        email: "kuldeep2@example.com",
        displayName: "Kuldeep 2",
        passwordHash: "hash",
        defaultWorkspaceId: "workspace-2",
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      workspace: {
        id: "workspace-2",
        name: "Kuldeep 2 Workspace",
        ownerUserId: "user-2",
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      session: {
        id: "session-2",
        tokenHash: "token-hash-2",
        userId: "user-2",
        workspaceId: "workspace-2",
        createdAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-01-08T00:00:00.000Z"
      }
    });

    await store.deleteSessionByTokenHash("token-hash-2");
    const context = await store.findPersistedAuthContextByTokenHash("token-hash-2");

    expect(context).toBeUndefined();
  });

  it("supports delete for workspace github connections", async () => {
    const store = createTestAuthStore();
    await store.initialize();

    await store.createUserWorkspaceSession({
      user: {
        id: "user-3",
        email: "kuldeep3@example.com",
        displayName: "Kuldeep 3",
        passwordHash: "hash",
        defaultWorkspaceId: "workspace-3",
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      workspace: {
        id: "workspace-3",
        name: "Kuldeep 3 Workspace",
        ownerUserId: "user-3",
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      session: {
        id: "session-3",
        tokenHash: "token-hash-3",
        userId: "user-3",
        workspaceId: "workspace-3",
        createdAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-01-08T00:00:00.000Z"
      }
    });

    await store.upsertWorkspaceGitHubConnection({
      workspaceId: "workspace-3",
      provider: "app",
      organization: "githealth-labs",
      installationId: 101,
      connectedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    });

    await store.deleteWorkspaceGitHubConnection("workspace-3");

    expect(await store.findWorkspaceGitHubConnection("workspace-3")).toBeUndefined();
  });

  it("prevents assigning the same installation id to different workspaces", async () => {
    const store = createTestAuthStore();
    await store.initialize();

    await store.createUserWorkspaceSession({
      user: {
        id: "user-4",
        email: "kuldeep4@example.com",
        displayName: "Kuldeep 4",
        passwordHash: "hash",
        defaultWorkspaceId: "workspace-4",
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      workspace: {
        id: "workspace-4",
        name: "Kuldeep 4 Workspace",
        ownerUserId: "user-4",
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      session: {
        id: "session-4",
        tokenHash: "token-hash-4",
        userId: "user-4",
        workspaceId: "workspace-4",
        createdAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-01-08T00:00:00.000Z"
      }
    });

    await store.createUserWorkspaceSession({
      user: {
        id: "user-5",
        email: "kuldeep5@example.com",
        displayName: "Kuldeep 5",
        passwordHash: "hash",
        defaultWorkspaceId: "workspace-5",
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      workspace: {
        id: "workspace-5",
        name: "Kuldeep 5 Workspace",
        ownerUserId: "user-5",
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      session: {
        id: "session-5",
        tokenHash: "token-hash-5",
        userId: "user-5",
        workspaceId: "workspace-5",
        createdAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-01-08T00:00:00.000Z"
      }
    });

    await store.upsertWorkspaceGitHubConnection({
      workspaceId: "workspace-4",
      provider: "app",
      organization: "githealth-labs",
      installationId: 303,
      connectedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    });

    await expect(
      store.upsertWorkspaceGitHubConnection({
        workspaceId: "workspace-5",
        provider: "app",
        organization: "githealth-labs",
        installationId: 303,
        connectedAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      })
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("enforces user-workspace ownership integrity during signup transaction", async () => {
    const store = createTestAuthStore();
    await store.initialize();

    await expect(
      store.createUserWorkspaceSession({
        user: {
          id: "user-6",
          email: "kuldeep6@example.com",
          displayName: "Kuldeep 6",
          passwordHash: "hash",
          defaultWorkspaceId: "workspace-6",
          createdAt: "2026-01-01T00:00:00.000Z"
        },
        workspace: {
          id: "workspace-6",
          name: "Kuldeep 6 Workspace",
          ownerUserId: "user-7",
          createdAt: "2026-01-01T00:00:00.000Z"
        },
        session: {
          id: "session-6",
          tokenHash: "token-hash-6",
          userId: "user-6",
          workspaceId: "workspace-6",
          createdAt: "2026-01-01T00:00:00.000Z",
          expiresAt: "2026-01-08T00:00:00.000Z"
        }
      })
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("stores and consumes OAuth state exactly once", async () => {
    const store = createTestAuthStore();
    await store.initialize();

    await store.createUserWorkspaceSession({
      user: {
        id: "user-8",
        email: "kuldeep8@example.com",
        displayName: "Kuldeep 8",
        passwordHash: "hash",
        defaultWorkspaceId: "workspace-8",
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      workspace: {
        id: "workspace-8",
        name: "Kuldeep 8 Workspace",
        ownerUserId: "user-8",
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      session: {
        id: "session-8",
        tokenHash: "token-hash-8",
        userId: "user-8",
        workspaceId: "workspace-8",
        createdAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-01-08T00:00:00.000Z"
      }
    });

    await store.createGitHubOAuthState({
      stateHash: "oauth-state-hash",
      workspaceId: "workspace-8",
      userId: "user-8",
      createdAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-01T00:10:00.000Z"
    });

    const consumed = await store.consumeGitHubOAuthState("oauth-state-hash");
    const consumedAgain = await store.consumeGitHubOAuthState("oauth-state-hash");

    expect(consumed?.workspaceId).toBe("workspace-8");
    expect(consumed?.userId).toBe("user-8");
    expect(consumedAgain).toBeUndefined();
  });

  it("persists encrypted OAuth credential metadata per workspace user", async () => {
    const store = createTestAuthStore();
    await store.initialize();

    await store.createUserWorkspaceSession({
      user: {
        id: "user-9",
        email: "kuldeep9@example.com",
        displayName: "Kuldeep 9",
        passwordHash: "hash",
        defaultWorkspaceId: "workspace-9",
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      workspace: {
        id: "workspace-9",
        name: "Kuldeep 9 Workspace",
        ownerUserId: "user-9",
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      session: {
        id: "session-9",
        tokenHash: "token-hash-9",
        userId: "user-9",
        workspaceId: "workspace-9",
        createdAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-01-08T00:00:00.000Z"
      }
    });

    await store.upsertWorkspaceGitHubOAuthConnection({
      workspaceId: "workspace-9",
      userId: "user-9",
      githubUserId: "12345",
      githubLogin: "octocat",
      accessTokenCiphertext: "ciphertext",
      accessTokenIv: "iv",
      accessTokenTag: "tag",
      scopes: ["read:org", "repo"],
      selectedOrganization: "githealth-labs",
      connectedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    });

    const persisted = await store.findWorkspaceGitHubOAuthConnection("workspace-9", "user-9");

    expect(persisted?.githubLogin).toBe("octocat");
    expect(persisted?.accessTokenCiphertext).toBe("ciphertext");
    expect(persisted?.scopes).toEqual(["read:org", "repo"]);

    await store.deleteWorkspaceGitHubOAuthConnection("workspace-9", "user-9");
    expect(await store.findWorkspaceGitHubOAuthConnection("workspace-9", "user-9")).toBeUndefined();
  });
});