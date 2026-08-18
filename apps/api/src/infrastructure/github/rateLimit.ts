import { GitHubAdapterError } from "./errors.js";

export type RetryOptions = {
  maxRetries: number;
  baseDelayMs: number;
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runWithRateLimitRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let attempts = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      const isRetryable =
        error instanceof GitHubAdapterError &&
        (error.code === "RATE_LIMITED" || error.code === "UPSTREAM_UNAVAILABLE");

      if (!isRetryable || attempts >= options.maxRetries) {
        throw error;
      }

      attempts += 1;
      const delay = options.baseDelayMs * attempts;
      await wait(delay);
    }
  }
}
