import type { NextFunction, Request, Response } from "express";

const ALLOWED_DEV_ORIGINS = new Set(["http://localhost:5173", "http://localhost:5174"]);
const ALLOWED_METHODS = "GET, OPTIONS";
const ALLOWED_HEADERS = "Accept, Authorization, x-github-app-session";

function applyCorsHeaders(res: Response, origin: string): void {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS);
  res.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS);
  res.setHeader("Vary", "Origin");
}

export function localDevelopmentCors(req: Request, res: Response, next: NextFunction): void {
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

  if (req.method !== "GET") {
    next();
    return;
  }

  next();
}