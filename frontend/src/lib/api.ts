// Thin client for the RAGI API (same-origin, cookie session, anti-CSRF header).
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function detailOf(body: unknown): string {
  if (body && typeof body === "object" && "detail" in body) {
    const d = (body as { detail: unknown }).detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d) && d[0] && typeof d[0] === "object" && "msg" in d[0]) return String(d[0].msg);
  }
  return "Something went wrong";
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`/api/v1${path}`, {
    credentials: "same-origin",
    ...rest,
    method: rest.method ?? (json !== undefined ? "POST" : "GET"),
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      "X-RAGI-Request": "1",
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const body = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : undefined;
  if (!res.ok) throw new ApiError(res.status, detailOf(body));
  return body as T;
}

export const fetcher = <T,>(path: string) => api<T>(path);
