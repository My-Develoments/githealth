import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const REQUEST_ID_HEADER = "x-request-id";
const GITHUB_APP_SESSION_HEADER = "x-github-app-session";
export const GITHUB_APP_SESSION_COOKIE = "githealth_github_app_session";

type RequestContextStore = {
  requestId: string;
  githubAppSessionToken?: string;
};

const requestContextStorage = new AsyncLocalStorage<RequestContextStore>();

function readCookieValue(cookieHeader: string | undefined, name: string): string | undefined {
  if (typeof cookieHeader !== "string" || cookieHeader.trim().length === 0) {
    return undefined;
  }

  for (const cookiePart of cookieHeader.split(";")) {
    const [rawName, ...rawValueParts] = cookiePart.split("=");
    if (typeof rawName !== "string") {
      continue;
    }

    if (rawName.trim() !== name) {
      continue;
    }

    const rawValue = rawValueParts.join("=").trim();
    return rawValue.length > 0 ? decodeURIComponent(rawValue) : undefined;
  }

  return undefined;
}

export function attachRequestContext(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(REQUEST_ID_HEADER);
  const requestId = incoming && incoming.trim().length > 0 ? incoming.trim() : randomUUID();
  const githubAppSessionToken =
    req.header(GITHUB_APP_SESSION_HEADER)?.trim() ?? readCookieValue(req.header("cookie"), GITHUB_APP_SESSION_COOKIE);

  res.setHeader(REQUEST_ID_HEADER, requestId);
  (res.locals as { requestId?: string }).requestId = requestId;
  requestContextStorage.run(
    {
      requestId,
      githubAppSessionToken: githubAppSessionToken && githubAppSessionToken.length > 0 ? githubAppSessionToken : undefined
    },
    next
  );
}

export function getRequestId(res: Response): string {
  return (res.locals as { requestId?: string }).requestId ?? "unknown";
}

export function getGitHubAppSessionToken(): string | undefined {
  return requestContextStorage.getStore()?.githubAppSessionToken;
}
