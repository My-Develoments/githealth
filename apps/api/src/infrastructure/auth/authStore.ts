import type {
  AuthSessionRecord,
  GitHubOAuthPendingStateRecord,
  GitHubOAuthStateRecord,
  UserRecord,
  WorkspaceGitHubConnectionRecord,
  WorkspaceGitHubOAuthConnectionRecord,
  WorkspaceRecord
} from "../../domain/auth/types.js";
import { createPgMemAuthStore, createPostgresAuthStore } from "./postgresAuthStore.js";

export type PersistedAuthContext = {
  session: AuthSessionRecord;
  user: UserRecord;
  workspace: WorkspaceRecord;
};

export type PersistedUserWorkspaceContext = {
  user: UserRecord;
  workspace: WorkspaceRecord;
};

export type CreateUserWorkspaceSessionInput = {
  user: UserRecord;
  workspace: WorkspaceRecord;
  session: AuthSessionRecord;
};

export interface AuthStore {
  initialize(): Promise<void>;
  createUserWorkspaceSession(input: CreateUserWorkspaceSessionInput): Promise<void>;
  findUserByEmail(email: string): Promise<UserRecord | undefined>;
  findUserById(userId: string): Promise<UserRecord | undefined>;
  findWorkspaceById(workspaceId: string): Promise<WorkspaceRecord | undefined>;
  createSession(session: AuthSessionRecord): Promise<void>;
  findPersistedAuthContextByTokenHash(tokenHash: string): Promise<PersistedAuthContext | undefined>;
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;
  upsertWorkspaceGitHubConnection(connection: WorkspaceGitHubConnectionRecord): Promise<void>;
  findWorkspaceGitHubConnection(workspaceId: string): Promise<WorkspaceGitHubConnectionRecord | undefined>;
  deleteWorkspaceGitHubConnection(workspaceId: string): Promise<void>;
  createGitHubOAuthState(state: GitHubOAuthStateRecord): Promise<void>;
  consumeGitHubOAuthState(stateHash: string): Promise<GitHubOAuthStateRecord | undefined>;
  createGitHubOAuthPendingState(state: GitHubOAuthPendingStateRecord): Promise<void>;
  consumeGitHubOAuthPendingState(stateHash: string): Promise<GitHubOAuthPendingStateRecord | undefined>;
  upsertWorkspaceGitHubOAuthConnection(connection: WorkspaceGitHubOAuthConnectionRecord): Promise<void>;
  findWorkspaceGitHubOAuthConnection(
    workspaceId: string,
    userId: string
  ): Promise<WorkspaceGitHubOAuthConnectionRecord | undefined>;
  findUserWorkspaceByGitHubUserId(githubUserId: string): Promise<PersistedUserWorkspaceContext | undefined>;
  deleteWorkspaceGitHubOAuthConnection(workspaceId: string, userId: string): Promise<void>;
}

let authStore: AuthStore | undefined;

export function getAuthStore(): AuthStore {
  if (!authStore) {
    authStore = process.env.NODE_ENV === "test"
      ? createPgMemAuthStore()
      : createPostgresAuthStore();
  }

  return authStore;
}

export function setAuthStoreForTests(store: AuthStore | undefined): void {
  authStore = store;
}