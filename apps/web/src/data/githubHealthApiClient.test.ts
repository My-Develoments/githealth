import { afterEach, describe, expect, it, vi } from "vitest";
import { GitHubHealthApiError, requestJson } from "./githubHealthApiClient";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("requestJson", () => {
  it("sends only default json headers by default", async () => {
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
      Accept: "application/json"
    });
    expect(fetchMock.mock.calls[0]?.[1]?.credentials).toBe("include");
  });

  it("merges custom request headers without adding browser auth tokens", async () => {
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
      "x-github-app-session": "opaque-install-session"
    });
    expect(fetchMock.mock.calls[0]?.[1]?.credentials).toBe("include");
  });

  it("ignores deprecated Vite auth token configuration even if present", async () => {
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

    await requestJson<{ ok: boolean }>("https://api.example.com/health");

    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({
      Accept: "application/json"
    });
    expect(fetchMock.mock.calls[0]?.[1]?.credentials).toBe("include");
  });

  it("preserves existing request and error handling", async () => {
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

  it("sends json post bodies when provided", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await requestJson<{ ok: boolean }>("https://api.example.com/auth/sign-in", {
      method: "POST",
      body: {
        email: "kuldeep@example.com"
      }
    });

    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST");
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ email: "kuldeep@example.com" }));
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({
      Accept: "application/json",
      "Content-Type": "application/json"
    });
  });
});
