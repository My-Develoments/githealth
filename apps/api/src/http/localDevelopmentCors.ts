import type { NextFunction, Request, Response } from "express";

const ALLOWED_DEV_ORIGINS = new Set([
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174"
]);
const ALLOWED_METHODS = "GET, POST, OPTIONS";
const ALLOWED_HEADERS = "Accept, Authorization, Content-Type, x-github-app-session";

export function isLocalDevelopmentCorsEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

function applyCorsHeaders(res: Response, origin: string): void {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS);
  res.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Vary", "Origin");
}

export function localDevelopmentCors(req: Request, res: Response, next: NextFunction): void {
  if (!isLocalDevelopmentCorsEnabled()) {
    next();
    return;
  }

  const origin = req.header("Origin");
  if (typeof origin !== "string" || !ALLOWED_DEV_ORIGINS.has(origin)) {
    next();
    return;
  }

  applyCorsHeaders(res, origin);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET" && req.method !== "POST") {
    next();
    return;
  }

  next();
}