import { describe, expect, it } from "vitest";
import { GitHubAdapterError } from "./errors.js";
import { runWithRateLimitRetry } from "./rateLimit.js";

describe("runWithRateLimitRetry", () => {
  it("retries rate-limited operations and succeeds", async () => {
    let attempts = 0;

    const result = await runWithRateLimitRetry(async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new GitHubAdapterError("RATE_LIMITED", "rate limited", 429);
      }
      return "ok";
    }, {
      maxRetries: 3,
      baseDelayMs: 1
    });

    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });

  it("does not retry non-retryable errors", async () => {
    let attempts = 0;

    await expect(runWithRateLimitRetry(async () => {
      attempts += 1;
      throw new GitHubAdapterError("AUTH_INVALID", "invalid", 401);
    }, {
      maxRetries: 3,
      baseDelayMs: 1
    })).rejects.toThrowError();

    expect(attempts).toBe(1);
  });
});
