import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchGitHubConnectionStatus, startGitHubConnection } from "./githubConnectionDataAdapter";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("githubConnectionDataAdapter", () => {
  it("fetches connection status from the connection endpoint", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          provider: "app",
          status: "ready_to_connect",
          isConnected: false,
          canConnect: true,
          hasInstallationId: false,
          installUrlConfigured: true,
          callbackRedirectConfigured: true,
          message: "GitHub App is configured and ready to connect."
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchGitHubConnectionStatus();

    expect(result.status).toBe("ready_to_connect");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:3000/github/connection/status");
  });

  it("starts onboarding via the backend start endpoint", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          provider: "app",
          status: "ready_to_connect",
          connectUrl: "https://github.com/apps/githealth/installations/new"
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await startGitHubConnection();

    expect(result.connectUrl).toBe("https://github.com/apps/githealth/installations/new");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:3000/github/connection/start");
  });
});