export type ApiErrorPayload = {
  code?: string;
  message?: string;
  upstreamStatus?: number;
  organization?: string;
  requestedOrganization?: string;
  selectedOrganization?: string;
  allowedOrganizations?: string[];
  accessibleOrganizations?: string[];
};

export class GitHubHealthApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly upstreamStatus?: number;
  public readonly organization?: string;
  public readonly requestedOrganization?: string;
  public readonly selectedOrganization?: string;
  public readonly allowedOrganizations?: string[];
  public readonly accessibleOrganizations?: string[];

  constructor(
    message: string,
    status: number,
    code = "UPSTREAM_UNAVAILABLE",
    upstreamStatus?: number,
    organization?: string,
    requestedOrganization?: string,
    selectedOrganization?: string,
    allowedOrganizations?: string[],
    accessibleOrganizations?: string[]
  ) {
    super(message);
    this.name = "GitHubHealthApiError";
    this.status = status;
    this.code = code;
    this.upstreamStatus = upstreamStatus;
    this.organization = organization;
    this.requestedOrganization = requestedOrganization;
    this.selectedOrganization = selectedOrganization;
    this.allowedOrganizations = allowedOrganizations;
    this.accessibleOrganizations = accessibleOrganizations;
  }
}

export type RequestJsonOptions = {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

function buildRequestHeaders(extraHeaders?: Record<string, string>, includeJsonBodyHeader = false): HeadersInit {
  return {
    Accept: "application/json",
    ...(includeJsonBodyHeader ? { "Content-Type": "application/json" } : {}),
    ...(extraHeaders ?? {})
  };
}

export async function requestJson<T>(url: string, options: RequestJsonOptions = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: buildRequestHeaders(options.headers, typeof options.body !== "undefined"),
      body: typeof options.body === "undefined" ? undefined : JSON.stringify(options.body),
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
      apiErrorPayload.code ?? "UPSTREAM_UNAVAILABLE",
      Number.isFinite(apiErrorPayload.upstreamStatus) ? apiErrorPayload.upstreamStatus : undefined,
      apiErrorPayload.organization,
      apiErrorPayload.requestedOrganization,
      apiErrorPayload.selectedOrganization,
      Array.isArray(apiErrorPayload.allowedOrganizations) ? apiErrorPayload.allowedOrganizations : undefined,
      Array.isArray(apiErrorPayload.accessibleOrganizations) ? apiErrorPayload.accessibleOrganizations : undefined
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
    message: typeof payload.message === "string" ? payload.message : undefined,
    upstreamStatus: typeof payload.upstreamStatus === "number" ? payload.upstreamStatus : undefined,
    organization: typeof payload.organization === "string" ? payload.organization : undefined,
    requestedOrganization: typeof payload.requestedOrganization === "string" ? payload.requestedOrganization : undefined,
    selectedOrganization: typeof payload.selectedOrganization === "string" ? payload.selectedOrganization : undefined,
    allowedOrganizations: Array.isArray(payload.allowedOrganizations)
      ? payload.allowedOrganizations.filter((value): value is string => typeof value === "string")
      : undefined,
    accessibleOrganizations: Array.isArray(payload.accessibleOrganizations)
      ? payload.accessibleOrganizations.filter((value): value is string => typeof value === "string")
      : undefined
  };
}
