import { afterEach, describe, expect, it, vi } from "vitest";
import { GitHubHealthApiError, requestJson } from "./githubHealthApiClient";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("requestJson", () => {
  it("sends the optional bearer token and accepts json", async () => {
    vi.stubEnv("VITE_API_AUTH_TOKEN", "test-api-token");

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestJson<{ ok: boolean }>("https://api.example.com/health");

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({
      Accept: "application/json",
      Authorization: "Bearer test-api-token"
    });
  });

  it("merges custom request headers with the API bearer token", async () => {
    vi.stubEnv("VITE_API_AUTH_TOKEN", "test-api-token");

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await requestJson<{ ok: boolean }>("https://api.example.com/health", {
      headers: {
        "x-github-app-session": "opaque-install-session"
      }
    });

    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({
      Accept: "application/json",
      Authorization: "Bearer test-api-token",
      "x-github-app-session": "opaque-install-session"
    });
  });

  it("keeps the request unauthenticated when no token is configured", async () => {
    vi.stubEnv("VITE_API_AUTH_TOKEN", "");

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await requestJson<{ ok: boolean }>("https://api.example.com/health");

    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({
      Accept: "application/json"
    });
  });

  it("preserves existing request and error handling", async () => {
    vi.stubEnv("VITE_API_AUTH_TOKEN", "test-api-token");

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ code: "PERMISSION_DENIED", message: "Forbidden" }), {
        status: 403,
        headers: {
          "content-type": "application/json"
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestJson("https://api.example.com/health")).rejects.toMatchObject({
      name: "GitHubHealthApiError",
      status: 403,
      code: "PERMISSION_DENIED",
      message: "Forbidden"
    });
  });

  it("maps network failures to upstream unavailable", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestJson("https://api.example.com/health")).rejects.toMatchObject({
      name: "GitHubHealthApiError",
      status: 0,
      code: "UPSTREAM_UNAVAILABLE",
      message: "Unable to reach GitHealth API."
    } satisfies Partial<GitHubHealthApiError>);
  });
});
