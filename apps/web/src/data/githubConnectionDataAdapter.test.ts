import { afterEach, describe, expect, it, vi } from "vitest";
import {
  disconnectGitHubConnection,
  fetchGitHubConnectionOrganizations,
  fetchGitHubConnectionStatus,
  selectGitHubConnectionOrganization,
  startGitHubConnection
} from "./githubConnectionDataAdapter";

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
          provider: "oauth",
          status: "ready_to_connect",
          connectUrl: "https://github.com/login/oauth/authorize?client_id=test-client"
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

    expect(result.connectUrl).toContain("https://github.com/login/oauth/authorize");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:3000/github/connection/start");
  });

  it("disconnects current github connection via backend endpoint", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true
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

    const result = await disconnectGitHubConnection();

    expect(result.ok).toBe(true);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:3000/github/connection/disconnect");
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(requestInit.method).toBe("DELETE");
  });

  it("fetches OAuth organization options for the current connection", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          selectedOrganization: "xebia-playground",
          organizations: ["xebia-playground", "xebia"]
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

    const result = await fetchGitHubConnectionOrganizations();

    expect(result.organizations).toEqual(["xebia-playground", "xebia"]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:3000/github/connection/organizations");
  });

  it("selects OAuth organization via backend endpoint", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          selectedOrganization: "xebia",
          organizations: ["xebia-playground", "xebia"]
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

    const result = await selectGitHubConnectionOrganization("xebia");

    expect(result.selectedOrganization).toBe("xebia");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:3000/github/connection/organizations/select");
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(requestInit.method).toBe("POST");
    expect(requestInit.body).toBe(JSON.stringify({ organization: "xebia" }));
  });
});