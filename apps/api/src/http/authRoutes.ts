import { Router, type Response } from "express";
import { AuthServiceError, resolveAuthenticatedSession, signInUser, signOutUser, signUpUser } from "../application/authService.js";
import { sendApiError } from "./errorEnvelope.js";
import { clearAuthSessionCookie, resolveAuthSessionToken, setAuthSessionCookie } from "./authSession.js";

export const authRoutes = Router();

function parseAuthBody(body: unknown): { email: string; password: string; displayName?: string } {
  if (!body || typeof body !== "object") {
    throw new AuthServiceError(400, "INVALID_REQUEST", "A valid request body is required.");
  }

  const payload = body as Record<string, unknown>;
  return {
    email: typeof payload.email === "string" ? payload.email : "",
    password: typeof payload.password === "string" ? payload.password : "",
    displayName: typeof payload.displayName === "string" ? payload.displayName : undefined
  };
}

function handleAuthError(error: unknown, res: Response): void {
  if (error instanceof AuthServiceError) {
    sendApiError(res, {
      status: error.status,
      code: error.code,
      message: error.message
    });
    return;
  }

  throw error;
}

authRoutes.post("/sign-up", async (req, res) => {
  try {
    const result = await signUpUser(parseAuthBody(req.body));
    setAuthSessionCookie(res, result.sessionToken);
    res.status(201).json(result.authenticatedApp);
  } catch (error) {
    handleAuthError(error, res);
  }
});

authRoutes.post("/sign-in", async (req, res) => {
  try {
    const payload = parseAuthBody(req.body);
    const result = await signInUser({
      email: payload.email,
      password: payload.password
    });
    setAuthSessionCookie(res, result.sessionToken);
    res.status(200).json(result.authenticatedApp);
  } catch (error) {
    handleAuthError(error, res);
  }
});

authRoutes.post("/sign-out", (req, res) => {
  void (async () => {
    await signOutUser(resolveAuthSessionToken(req));
    clearAuthSessionCookie(res);
    res.status(200).json({ ok: true });
  })().catch((error) => {
    handleAuthError(error, res);
  });
});

authRoutes.get("/session", (req, res) => {
  void (async () => {
    const authenticatedApp = await resolveAuthenticatedSession(resolveAuthSessionToken(req));
    if (!authenticatedApp) {
      clearAuthSessionCookie(res);
      sendApiError(res, {
        status: 401,
        code: "AUTH_MISSING",
        message: "Authentication is required to access GitHealth."
      });
      return;
    }

    res.status(200).json(authenticatedApp);
  })().catch((error) => {
    handleAuthError(error, res);
  });
});