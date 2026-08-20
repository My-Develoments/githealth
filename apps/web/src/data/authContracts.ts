export type AuthenticatedUserViewModel = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
};

export type WorkspaceViewModel = {
  id: string;
  name: string;
  ownerUserId: string;
  createdAt: string;
};

export type AuthSessionViewModel = {
  sessionId: string;
  user: AuthenticatedUserViewModel;
  workspace: WorkspaceViewModel;
};

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";