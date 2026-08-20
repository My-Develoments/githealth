import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { AuthenticatedAppContext, AuthSessionRecord, UserRecord, WorkspaceRecord } from "../domain/auth/types.js";
import {
  getAuthStore
} from "../infrastructure/auth/authStore.js";
import { hashPassword, verifyPassword } from "../infrastructure/auth/passwords.js";

const AUTH_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AuthServiceError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AuthServiceError";
    this.status = status;
    this.code = code;
  }
}

export type AuthSessionResult = {
  sessionToken: string;
  authenticatedApp: AuthenticatedAppContext;
};

type CreateUserWorkspaceSessionData = {
  user: UserRecord;
  workspace: WorkspaceRecord;
  session: AuthSessionRecord;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function deriveDisplayName(email: string, providedName?: string): string {
  const trimmedName = providedName?.trim();
  if (trimmedName && trimmedName.length > 0) {
    return trimmedName;
  }

  const localPart = normalizeEmail(email).split("@")[0] ?? "GitHealth User";
  return localPart.replace(/[._-]+/g, " ").replace(/\b\w/g, (value) => value.toUpperCase());
}

function deriveWorkspaceName(displayName: string): string {
  return `${displayName}'s Workspace`;
}

function toTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

function toAuthenticatedApp(user: UserRecord, workspace: WorkspaceRecord, session: AuthSessionRecord): AuthenticatedAppContext {
  return {
    sessionId: session.id,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt
    },
    workspace: {
      id: workspace.id,
      name: workspace.name,
      ownerUserId: workspace.ownerUserId,
      createdAt: workspace.createdAt
    }
  };
}

function validateCredentials(email: string, password: string, requireDisplayName: boolean, displayName?: string): void {
  if (!EMAIL_PATTERN.test(normalizeEmail(email))) {
    throw new AuthServiceError(400, "INVALID_REQUEST", "Enter a valid email address.");
  }

  if (password.trim().length < MIN_PASSWORD_LENGTH) {
    throw new AuthServiceError(400, "INVALID_REQUEST", "Password must be at least 8 characters.");
  }

  if (requireDisplayName && (!displayName || displayName.trim().length < 2)) {
    throw new AuthServiceError(400, "INVALID_REQUEST", "Display name must be at least 2 characters.");
  }
}

async function createSessionForUser(user: UserRecord, workspace: WorkspaceRecord): Promise<AuthSessionResult> {
  const authStore = getAuthStore();
  await authStore.initialize();

  const sessionToken = createSessionToken();
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + AUTH_SESSION_TTL_MS).toISOString();
  const session: AuthSessionRecord = {
    id: randomUUID(),
    tokenHash: toTokenHash(sessionToken),
    userId: user.id,
    workspaceId: workspace.id,
    createdAt: issuedAt,
    expiresAt
  };

  await authStore.createSession(session);

  return {
    sessionToken,
    authenticatedApp: toAuthenticatedApp(user, workspace, session)
  };
}

async function persistUserWorkspaceSession(data: CreateUserWorkspaceSessionData): Promise<AuthSessionResult> {
  const authStore = getAuthStore();
  await authStore.initialize();

  try {
    await authStore.createUserWorkspaceSession(data);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505") {
      throw new AuthServiceError(409, "CONFLICT", "An account already exists for that email address.");
    }

    throw error;
  }

  return {
    sessionToken: "",
    authenticatedApp: toAuthenticatedApp(data.user, data.workspace, data.session)
  };
}

export async function signUpUser(input: { email: string; password: string; displayName?: string }): Promise<AuthSessionResult> {
  validateCredentials(input.email, input.password, true, input.displayName);

  const normalizedEmail = normalizeEmail(input.email);
  const authStore = getAuthStore();
  await authStore.initialize();

  if (await authStore.findUserByEmail(normalizedEmail)) {
    throw new AuthServiceError(409, "CONFLICT", "An account already exists for that email address.");
  }

  const createdAt = new Date().toISOString();
  const displayName = deriveDisplayName(normalizedEmail, input.displayName);
  const workspace: WorkspaceRecord = {
    id: randomUUID(),
    name: deriveWorkspaceName(displayName),
    ownerUserId: "",
    createdAt
  };

  const user: UserRecord = {
    id: randomUUID(),
    email: normalizedEmail,
    displayName,
    passwordHash: await hashPassword(input.password),
    defaultWorkspaceId: workspace.id,
    createdAt
  };

  workspace.ownerUserId = user.id;
  const sessionToken = createSessionToken();
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + AUTH_SESSION_TTL_MS).toISOString();
  const session: AuthSessionRecord = {
    id: randomUUID(),
    tokenHash: toTokenHash(sessionToken),
    userId: user.id,
    workspaceId: workspace.id,
    createdAt: issuedAt,
    expiresAt
  };

  await persistUserWorkspaceSession({
    user,
    workspace,
    session
  });

  return {
    sessionToken,
    authenticatedApp: toAuthenticatedApp(user, workspace, session)
  };
}

export async function createBootstrapSession(): Promise<AuthSessionResult> {
  const createdAt = new Date().toISOString();
  const anonymousId = randomUUID();
  const displayName = "GitHub User";
  const workspace: WorkspaceRecord = {
    id: randomUUID(),
    name: deriveWorkspaceName(displayName),
    ownerUserId: "",
    createdAt
  };

  const user: UserRecord = {
    id: randomUUID(),
    email: `github-user-${anonymousId}@users.githealth.local`,
    displayName,
    passwordHash: await hashPassword(randomBytes(24).toString("base64url")),
    defaultWorkspaceId: workspace.id,
    createdAt
  };

  workspace.ownerUserId = user.id;

  const sessionToken = createSessionToken();
  const session: AuthSessionRecord = {
    id: randomUUID(),
    tokenHash: toTokenHash(sessionToken),
    userId: user.id,
    workspaceId: workspace.id,
    createdAt,
    expiresAt: new Date(Date.now() + AUTH_SESSION_TTL_MS).toISOString()
  };

  await persistUserWorkspaceSession({
    user,
    workspace,
    session
  });

  return {
    sessionToken,
    authenticatedApp: toAuthenticatedApp(user, workspace, session)
  };
}

export async function signInOrCreateUserFromGitHubIdentity(input: {
  githubUserId: string;
  githubLogin: string;
}): Promise<AuthSessionResult> {
  const authStore = getAuthStore();
  await authStore.initialize();

  const linkedContext = await authStore.findUserWorkspaceByGitHubUserId(input.githubUserId);
  if (linkedContext) {
    return createSessionForUser(linkedContext.user, linkedContext.workspace);
  }

  const syntheticEmail = `github-user-${input.githubUserId}@users.githealth.local`;
  const existingUser = await authStore.findUserByEmail(syntheticEmail);
  if (existingUser) {
    const workspace = await authStore.findWorkspaceById(existingUser.defaultWorkspaceId);
    if (!workspace) {
      throw new AuthServiceError(500, "UPSTREAM_UNAVAILABLE", "Workspace is unavailable for this GitHub user.");
    }

    return createSessionForUser(existingUser, workspace);
  }

  return signUpUser({
    email: syntheticEmail,
    password: randomBytes(24).toString("base64url"),
    displayName: input.githubLogin
  });
}

export async function signInUser(input: { email: string; password: string }): Promise<AuthSessionResult> {
  validateCredentials(input.email, input.password, false);

  const normalizedEmail = normalizeEmail(input.email);
  const authStore = getAuthStore();
  await authStore.initialize();

  const user = await authStore.findUserByEmail(normalizedEmail);
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new AuthServiceError(401, "AUTH_INVALID", "Invalid email or password.");
  }

  const workspace = await authStore.findWorkspaceById(user.defaultWorkspaceId);
  if (!workspace) {
    throw new AuthServiceError(500, "UPSTREAM_UNAVAILABLE", "Workspace is unavailable for this user.");
  }

  return createSessionForUser(user, workspace);
}

export async function resolveAuthenticatedSession(sessionToken: string | undefined): Promise<AuthenticatedAppContext | null> {
  if (!sessionToken || sessionToken.trim().length === 0) {
    return null;
  }

  const authStore = getAuthStore();
  await authStore.initialize();

  const persisted = await authStore.findPersistedAuthContextByTokenHash(toTokenHash(sessionToken.trim()));
  if (!persisted) {
    return null;
  }

  if (new Date(persisted.session.expiresAt).getTime() <= Date.now()) {
    await authStore.deleteSessionByTokenHash(persisted.session.tokenHash);
    return null;
  }

  return toAuthenticatedApp(persisted.user, persisted.workspace, persisted.session);
}

export async function signOutUser(sessionToken: string | undefined): Promise<void> {
  if (!sessionToken || sessionToken.trim().length === 0) {
    return;
  }

  const authStore = getAuthStore();
  await authStore.initialize();
  await authStore.deleteSessionByTokenHash(toTokenHash(sessionToken.trim()));
}