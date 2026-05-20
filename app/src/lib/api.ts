/**
 * Shared authenticated-fetch helper for use inside react-query ``queryFn``
 * and ``mutationFn`` callbacks.
 *
 * Why this exists:
 *
 * - Sends the auth cookie automatically via ``credentials: 'include'`` (the
 *   server issues an httpOnly JWT cookie on login — see F-S2).
 * - Throws ``ApiError`` on non-2xx so react-query's ``error`` state
 *   surfaces a useful status code + detail message instead of an opaque
 *   ``Error("HTTP 401")``.
 * - On 401 (expired/missing session), notifies a registered auth-failure
 *   handler so the app can log the user out and redirect to /login instead
 *   of letting queries silently fail.
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

// Registered by AuthProvider on mount. Called once per 401 from any fetch.
// Stored at module scope (not in React context) so apiFetch can stay a pure
// function that any caller — react-query, raw effects, ad-hoc handlers —
// can use without threading the context through.
let authFailureHandler: (() => void) | null = null;
let authFailureFired = false;

export function setAuthFailureHandler(fn: (() => void) | null) {
  authFailureHandler = fn;
  authFailureFired = false;
}

export function resetAuthFailureLatch() {
  authFailureFired = false;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Don't set Content-Type on GET/DELETE or when body is FormData/URLSearchParams.
  // For JSON-bodied mutations the caller is expected to JSON.stringify the body
  // and pass it in init.body — we default to application/json then.
  const isJsonBody =
    init.body !== undefined &&
    !(init.body instanceof FormData) &&
    !(init.body instanceof URLSearchParams);

  const headers: Record<string, string> = {
    ...(isJsonBody ? { 'Content-Type': 'application/json' } : {}),
    ...((init.headers as Record<string, string>) ?? {}),
  };

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    if (res.status === 401 && authFailureHandler && !authFailureFired) {
      authFailureFired = true;
      authFailureHandler();
    }
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
