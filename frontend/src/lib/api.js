// frontend/src/lib/api.js
// Lightweight API helper using fetch and Vite envs.
// Exports: API_BASE, FASTAPI_BASE, getAuthToken(), apiFetch(), fastapiPost()

export const API_BASE = import.meta.env.VITE_API_URL || "/api/v1";
export const FASTAPI_BASE = import.meta.env.VITE_FASTAPI_URL || "/calc";

/**
 * Find the JWT access token in storage (try common keys + sessionStorage).
 * Returns the raw token string (no "Bearer ") or null.
 * Only returns tokens that look like JWTs (three dot-separated parts).
 */
export function getAuthToken() {
  const keys = [
    () => localStorage.getItem("access_token"),
    () => localStorage.getItem("access"),
    () => localStorage.getItem("token"),
    () => localStorage.getItem("auth_token"),
    () => sessionStorage.getItem("access_token"),
    () => sessionStorage.getItem("token"),
    () => sessionStorage.getItem("auth_token"),
  ];
  for (const fn of keys) {
    try {
      const raw = (fn() || "").trim();
      if (!raw) continue;
      if (raw.split(".").length === 3) return raw;
    } catch {
      // ignore storage errors and continue
    }
  }
  return null;
}

/** Return Authorization header object if token is present/valid */
function getAuthHeader() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function isFormData(body) {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

/**
 * Generic fetch wrapper for Django-backed API
 * - path: "/uploads/" or "auth/me/"
 * - opts: fetch options (method, body, headers, etc.)
 */
export async function apiFetch(path, opts = {}) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE}${normalizedPath}`;

  const headers = new Headers(opts.headers || {});

  // Inject Authorization if available
  const auth = getAuthHeader();
  if (auth.Authorization) headers.set("Authorization", auth.Authorization);

  // Only set JSON content-type when body is NOT FormData and user didn't already set it
  if (!isFormData(opts.body) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, { ...opts, headers, credentials: "include" });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let body;
    try { body = JSON.parse(text); } catch { body = text || response.statusText; }
    const err = new Error(`API request failed: ${response.status}`);
    err.status = response.status;
    err.body = body;
    throw err;
  }

  try { return await response.json(); } catch { return null; }
}

/**
 * Post to FastAPI endpoints.
 * - body may be FormData or JSON object.
 */
export async function fastapiPost(path, body, opts = {}) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${FASTAPI_BASE}${normalizedPath}`;

  const headers = new Headers(opts.headers || {});
  const auth = getAuthHeader();
  if (auth.Authorization) headers.set("Authorization", auth.Authorization);

  if (!isFormData(body) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: isFormData(body) ? body : JSON.stringify(body),
    credentials: "include",
    ...opts,
  });

  if (!response.ok) {
    const txt = await response.text().catch(() => "");
    const err = new Error(`FastAPI error ${response.status}: ${txt}`);
    err.status = response.status;
    err.body = txt;
    throw err;
  }

  try { return await response.json(); } catch { return null; }
}
