import { useCallback, useEffect, useState } from "react";
import type { AuthSessionViewModel, AuthStatus } from "./authContracts";
import {
  fetchCurrentAuthSession,
  signInWithCredentials,
  startGitHubOAuthSession,
  signOutCurrentSession,
  signUpWithCredentials
} from "./authDataAdapter";
import { GitHubHealthApiError } from "./githubHealthApiClient";

type AuthError = {
  code: string;
  message: string;
  status: number;
};

type CredentialsInput = {
  email: string;
  password: string;
  displayName?: string;
};

export type UseAuthSessionResult = {
  status: AuthStatus;
  session: AuthSessionViewModel | null;
  error: AuthError | null;
  isContinuingWithGitHub: boolean;
  signIn: (input: CredentialsInput) => Promise<void>;
  signUp: (input: CredentialsInput) => Promise<void>;
  continueWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
  reload: () => void;
};

function toAuthError(error: unknown): AuthError {
  if (error instanceof GitHubHealthApiError) {
    return {
      code: error.code,
      message: error.message,
      status: error.status
    };
  }

  return {
    code: "UPSTREAM_UNAVAILABLE",
    message: "Unable to complete authentication right now.",
    status: 0
  };
}

export function useAuthSession(): UseAuthSessionResult {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<AuthSessionViewModel | null>(null);
  const [error, setError] = useState<AuthError | null>(null);
  const [isContinuingWithGitHub, setIsContinuingWithGitHub] = useState(false);
  const [reloadSeed, setReloadSeed] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setError(null);

    void (async () => {
      try {
        const authenticatedSession = await fetchCurrentAuthSession(controller.signal);
        if (controller.signal.aborted) {
          return;
        }

        setSession(authenticatedSession);
        setStatus("authenticated");
      } catch (caughtError) {
        if (controller.signal.aborted) {
          return;
        }

        const resolvedError = toAuthError(caughtError);
        if (resolvedError.status === 401) {
          setSession(null);
          setStatus("unauthenticated");
          setError(null);
          return;
        }

        setSession(null);
        setStatus("unauthenticated");
        setError(resolvedError);
      }
    })();

    return () => controller.abort();
  }, [reloadSeed]);

  const reload = useCallback(() => {
    setReloadSeed((value) => value + 1);
  }, []);

  const signIn = useCallback(async (input: CredentialsInput) => {
    setStatus("loading");
    setError(null);

    try {
      const authenticatedSession = await signInWithCredentials({
        email: input.email,
        password: input.password
      });
      setSession(authenticatedSession);
      setStatus("authenticated");
    } catch (caughtError) {
      setSession(null);
      setStatus("unauthenticated");
      setError(toAuthError(caughtError));
    }
  }, []);

  const signUp = useCallback(async (input: CredentialsInput) => {
    setStatus("loading");
    setError(null);

    try {
      const authenticatedSession = await signUpWithCredentials({
        email: input.email,
        password: input.password,
        displayName: input.displayName
      });
      setSession(authenticatedSession);
      setStatus("authenticated");
    } catch (caughtError) {
      setSession(null);
      setStatus("unauthenticated");
      setError(toAuthError(caughtError));
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await signOutCurrentSession();
    } finally {
      setSession(null);
      setStatus("unauthenticated");
      setError(null);
    }
  }, []);

  const continueWithGitHub = useCallback(async () => {
    setError(null);
    setIsContinuingWithGitHub(true);

    try {
      const result = await startGitHubOAuthSession();
      window.location.assign(result.connectUrl);
    } catch (caughtError) {
      setSession(null);
      setStatus("unauthenticated");
      setError(toAuthError(caughtError));
      setIsContinuingWithGitHub(false);
    }
  }, []);

  return {
    status,
    session,
    error,
    isContinuingWithGitHub,
    signIn,
    signUp,
    continueWithGitHub,
    signOut,
    reload
  };
}