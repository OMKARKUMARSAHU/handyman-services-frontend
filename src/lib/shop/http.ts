import { AuthApiError } from "@/lib/auth/api";
import { BROWSER_PROXY_BASE_PATH, DIRECT_BACKEND_BASE_URL, isBrowserRuntime } from "@/lib/server/backend-url";
import type { PageMeta } from "./types";

/**
 * Like `apiRequest` (@/lib/auth/api) but also returns the response `meta`
 * (page/total) that the shop's paginated list endpoints send next to `data`.
 * Same cookie-based, same-origin-proxy behaviour — nothing new about auth.
 */
export async function requestPaged<T>(path: string, init?: RequestInit): Promise<{ data: T; meta: PageMeta }> {
  const base = isBrowserRuntime() ? BROWSER_PROXY_BASE_PATH : DIRECT_BACKEND_BASE_URL;
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new AuthApiError(0, "NETWORK_ERROR", "Could not reach the server. Please check your connection and try again.");
  }
  const body = (await res.json().catch(() => null)) as
    | { success: boolean; data?: T; meta?: PageMeta; error?: { code: string; message: string; details?: unknown } }
    | null;
  if (!res.ok || !body || body.success === false || body.data === undefined) {
    throw new AuthApiError(res.status, body?.error?.code ?? "UNKNOWN_ERROR", body?.error?.message ?? "Something went wrong. Please try again.", body?.error?.details);
  }
  return {
    data: body.data,
    meta: body.meta ?? { page: 1, pageSize: Array.isArray(body.data) ? body.data.length : 0, total: Array.isArray(body.data) ? body.data.length : 0, totalPages: 1 },
  };
}

export function toQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
