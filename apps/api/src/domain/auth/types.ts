export type UserRecord = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  defaultWorkspaceId: string;
  createdAt: string;
};

export type WorkspaceRecord = {
  id: string;
  name: string;
  ownerUserId: string;
  createdAt: string;
};

export type AuthSessionRecord = {
  id: string;
  tokenHash: string;
  userId: string;
  workspaceId: string;
  createdAt: string;
  expiresAt: string;
};

export type AuthenticatedUser = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  ownerUserId: string;
  createdAt: string;
};

export type WorkspaceGitHubConnectionRecord = {
  workspaceId: string;
  provider: "app";
  organization: string;
  installationId: number;
  connectedAt: string;
  updatedAt: string;
};

export type WorkspaceGitHubOAuthConnectionRecord = {
  workspaceId: string;
  userId: string;
  githubUserId: string;
  githubLogin: string;
  accessTokenCiphertext: string;
  accessTokenIv: string;
  accessTokenTag: string;
  scopes: string[];
  selectedOrganization?: string;
  organizationOptions?: string[];
  connectedAt: string;
  updatedAt: string;
};

export type GitHubOAuthStateRecord = {
  stateHash: string;
  workspaceId: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

export type GitHubOAuthPendingStateRecord = {
  stateHash: string;
  createdAt: string;
  expiresAt: string;
};

export type AuthenticatedAppContext = {
  sessionId: string;
  user: AuthenticatedUser;
  workspace: WorkspaceSummary;
};