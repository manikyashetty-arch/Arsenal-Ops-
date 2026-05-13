/**
 * Shared authenticated-fetch helper for use inside react-query ``queryFn``
 * and ``mutationFn`` callbacks.
 *
 * Why this exists:
 *
 * - Reads the auth token from ``localStorage`` at fetch time (not from a
 *   captured ``useAuth()`` value). If the queryFn closed over the context's
 *   ``token`` value, the closure would hold the old token after rotation
 *   until react-query rebuilt the queryFn. Reading localStorage per fetch
 *   sidesteps the closure-capture problem entirely.
 * - Throws ``ApiError`` on non-2xx so react-query's ``error`` state
 *   surfaces a useful status code + detail message instead of an opaque
 *   ``Error("HTTP 401")``.
 * - Handles 204 No Content by returning ``undefined`` cast to ``T``.
 */
import { API_BASE_URL } from '@/config/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');

  // Don't set Content-Type on GET/DELETE or when body is FormData/URLSearchParams.
  // For JSON-bodied mutations the caller is expected to JSON.stringify the body
  // and pass it in init.body — we default to application/json then.
  const isJsonBody =
    init.body !== undefined &&
    !(init.body instanceof FormData) &&
    !(init.body instanceof URLSearchParams);

  const headers: Record<string, string> = {
    ...(isJsonBody ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init.headers as Record<string, string>) ?? {}),
  };

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  if (!res.ok) {
    let detail: string;
    try {
      const body = await res.json();
      detail = body.detail ?? res.statusText;
    } catch {
      detail = res.statusText;
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
