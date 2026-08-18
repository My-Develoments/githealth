import { describe, expect, it } from "vitest";
import { normalizeGitHubHttpError } from "./errors.js";

describe("normalizeGitHubHttpError", () => {
  it("maps auth and permission failures deterministically", () => {
    expect(normalizeGitHubHttpError(401, "x").code).toBe("AUTH_INVALID");
    expect(normalizeGitHubHttpError(403, "x").code).toBe("PERMISSION_DENIED");
  });

  it("maps not found and rate limit deterministically", () => {
    expect(normalizeGitHubHttpError(404, "x").code).toBe("NOT_FOUND");
    expect(normalizeGitHubHttpError(429, "x").code).toBe("RATE_LIMITED");
  });

  it("maps 5xx to upstream unavailable", () => {
    expect(normalizeGitHubHttpError(500, "x").code).toBe("UPSTREAM_UNAVAILABLE");
  });

  it("maps secondary throttling 403 to RATE_LIMITED", () => {
    const headers = {
      get(name: string) {
        if (name.toLowerCase() === "x-ratelimit-remaining") {
          return "0";
        }
        return null;
      }
    };

    const error = normalizeGitHubHttpError(403, "x", {
      message: "You have exceeded a secondary rate limit.",
      headers
    });

    expect(error.code).toBe("RATE_LIMITED");
  });

  it("keeps ordinary 403 as PERMISSION_DENIED", () => {
    const headers = {
      get() {
        return null;
      }
    };

    const error = normalizeGitHubHttpError(403, "x", {
      message: "Resource not accessible by integration",
      headers
    });

    expect(error.code).toBe("PERMISSION_DENIED");
  });
});
