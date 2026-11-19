import { getToken } from "../state/session";

export const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN || "http://127.0.0.1:8787").replace(/\/$/, "");

/** Pages builds with no API origin should not pretend localhost is the public server. */
export function pageCanReachApi() {
  const host = location.hostname;
  const local = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  return local || Boolean(import.meta.env.VITE_API_ORIGIN);
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    const record = typeof body === "object" && body ? (body as { error?: string; message?: string }) : null;
    const msg = record?.message
      ? String(record.message)
      : record?.error
        ? String(record.error).replaceAll("_", " ")
        : `http_${status}`;
    super(msg);
    this.status = status;
    this.body = body;
  }
}

export async function api<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type") && init.body) {
    headers.set("content-type", "application/json");
  }
  if (init.auth !== false) {
    const token = getToken();
    if (token) headers.set("authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_ORIGIN}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export async function pingHealth(): Promise<boolean> {
  try {
    const h = await api<{ ok: boolean }>("/health", { auth: false });
    return Boolean(h.ok);
  } catch {
    return false;
  }
}
