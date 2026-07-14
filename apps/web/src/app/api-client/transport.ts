const defaultApiUrl = resolveDefaultApiUrl();
const apiUrl = (import.meta.env.VITE_API_URL ?? defaultApiUrl).replace(/\/$/, "");
let accessToken: string | null = null;
let localRoleOverride: string | null = null;
const deviceIdStorageKey = "nomduchat-device-id";

type ApiErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

function resolveDefaultApiUrl() {
  if (!import.meta.env.PROD) return "http://127.0.0.1:4000";
  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ) {
    return "http://127.0.0.1:4000";
  }
  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "nomduchat.com" || window.location.hostname === "www.nomduchat.com")
  ) {
    return "/api";
  }

  return "https://nomduchat-api.onrender.com";
}

export function setApiAccessToken(token: string | null) {
  accessToken = token;
}

export function setApiLocalRoleOverride(role: string | null) {
  localRoleOverride = role && role !== "real" ? role : null;
}

export async function request<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  appendClientHeaders(headers);

  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers,
    });
  } catch (error) {
    throw new Error(isNetworkFetchError(error) ? "nomduchat_api_unavailable" : "nomduchat_api_request_failed");
  }

  if (!response.ok) {
    const body = await safeJson<ApiErrorResponse>(response);
    throw createHttpError(response, body);
  }

  return response.json() as Promise<T>;
}

export async function requestBlob(path: string) {
  const headers = new Headers();
  appendClientHeaders(headers);

  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      headers,
    });
  } catch (error) {
    throw new Error(isNetworkFetchError(error) ? "nomduchat_api_unavailable" : "nomduchat_api_request_failed");
  }

  if (!response.ok) {
    const body = await safeJson<ApiErrorResponse>(response);
    throw createHttpError(response, body);
  }

  return response.blob();
}

export function toPublicApiError(error: unknown, fallback = "Не удалось выполнить действие.") {
  if (error instanceof Error && error.message === "nomduchat_api_unavailable") {
    return "API nomduchat сейчас не подключен. Действие станет доступно после запуска сервера.";
  }

  if (error instanceof Error && error.message === "nomduchat_api_request_failed") {
    return fallback;
  }

  return error instanceof Error ? error.message : fallback;
}

function appendClientHeaders(headers: Headers) {
  if (accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  if (localRoleOverride && !headers.has("X-nomduchat-Local-Role")) {
    headers.set("X-nomduchat-Local-Role", localRoleOverride);
  }
  if (!headers.has("X-nomduchat-Device-Id")) {
    headers.set("X-nomduchat-Device-Id", getOrCreateDeviceId());
  }
}

function getOrCreateDeviceId() {
  if (typeof window === "undefined") return "server-render";

  const existing = window.localStorage.getItem(deviceIdStorageKey);
  if (existing) return existing;

  const nextId =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(deviceIdStorageKey, nextId);
  return nextId;
}

function isNetworkFetchError(error: unknown) {
  return error instanceof TypeError || (error instanceof Error && /failed to fetch|network|load failed/i.test(error.message));
}

function createHttpError(response: Response, body: ApiErrorResponse | null) {
  if (body?.error?.message) {
    return new Error(body.error.message);
  }

  if (response.status >= 500) {
    return new Error("nomduchat_api_unavailable");
  }

  return new Error(`nomduchat API request failed with ${response.status}.`);
}

async function safeJson<T>(response: Response) {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
