export type ApiErrorPayload = {
  code?: string;
  message?: string;
};

export class GitHubHealthApiError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(message: string, status: number, code = "UPSTREAM_UNAVAILABLE") {
    super(message);
    this.name = "GitHubHealthApiError";
    this.status = status;
    this.code = code;
  }
}

export type RequestJsonOptions = {
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

function buildRequestHeaders(extraHeaders?: Record<string, string>): HeadersInit {
  return {
    Accept: "application/json",
    ...(extraHeaders ?? {})
  };
}

export async function requestJson<T>(url: string, options: RequestJsonOptions = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: buildRequestHeaders(options.headers),
      credentials: "include",
      signal: options.signal
    });
  } catch {
    throw new GitHubHealthApiError("Unable to reach GitHealth API.", 0, "UPSTREAM_UNAVAILABLE");
  }

  const payload = await readApiPayload(response);
  const apiErrorPayload = toApiErrorPayload(payload);

  if (!response.ok) {
    throw new GitHubHealthApiError(
      apiErrorPayload.message ?? "GitHealth API request failed.",
      response.status,
      apiErrorPayload.code ?? "UPSTREAM_UNAVAILABLE"
    );
  }

  return payload as T;
}

async function readApiPayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new GitHubHealthApiError("GitHealth API returned an invalid response.", response.status || 0, "INVALID_RESPONSE");
  }
}

function toApiErrorPayload(value: unknown): ApiErrorPayload {
  if (!value || typeof value !== "object") {
    return {};
  }

  const payload = value as Record<string, unknown>;
  return {
    code: typeof payload.code === "string" ? payload.code : undefined,
    message: typeof payload.message === "string" ? payload.message : undefined
  };
}
