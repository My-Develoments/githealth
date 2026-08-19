import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const REQUEST_ID_HEADER = "x-request-id";
const GITHUB_APP_SESSION_HEADER = "x-github-app-session";

type RequestContextStore = {
  requestId: string;
  githubAppSessionToken?: string;
};

const requestContextStorage = new AsyncLocalStorage<RequestContextStore>();

export function attachRequestContext(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(REQUEST_ID_HEADER);
  const requestId = incoming && incoming.trim().length > 0 ? incoming.trim() : randomUUID();
  const githubAppSessionToken = req.header(GITHUB_APP_SESSION_HEADER)?.trim();

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
