// src/lib/http.js
// Axios-based clients for FastAPI and Django with token helpers and good dev diagnostics.
//
// Usage:
//  import { fastapiClient, postFastAPI, getAuthToken, setAuthToken, clearAuthToken } from '../lib/http';

import axios from "axios";

/* ---------------------------
   Token helpers (storage + setters)
   --------------------------- */
export function getAuthToken() {
  try {
    const candidates = ["access", "access_token", "accessToken", "token", "auth_token"];
    for (const k of candidates) {
      const v = localStorage.getItem(k);
      if (v) return v;
    }
    // fallback: some dev setups keep token in sessionStorage
    const s = sessionStorage.getItem("access") || sessionStorage.getItem("access_token");
    if (s) return s;
  } catch (err) {
    console.warn("getAuthToken error", err);
  }
  return null;
}

export function setAuthToken(token) {
  try {
    if (!token) return;
    localStorage.setItem("access", token);
    // keep axios default headers in sync
    fastapiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
    djangoClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  } catch (e) {
    console.warn("setAuthToken error", e);
  }
}

export function clearAuthToken() {
  try {
    localStorage.removeItem("access");
    localStorage.removeItem("access_token");
    sessionStorage.removeItem("access");
    // remove axios defaults
    delete fastapiClient.defaults.headers.common.Authorization;
    delete djangoClient.defaults.headers.common.Authorization;
  } catch (e) {
    console.warn("clearAuthToken error", e);
  }
}

/* ---------------------------
   Configurable base paths (Vite env or defaults)
   --------------------------- */
const FASTAPI_BASE = (import.meta.env.VITE_FASTAPI_BASE || "/v1").replace(/\/$/, "");
const DJANGO_BASE = (import.meta.env.VITE_DJANGO_BASE || "/api/v1").replace(/\/$/, "");

/* ---------------------------
   Axios instances
   --------------------------- */
export const fastapiClient = axios.create({ baseURL: FASTAPI_BASE, timeout: 15000 });
export const djangoClient = axios.create({ baseURL: DJANGO_BASE, timeout: 15000, withCredentials: true });

/* ---------------------------
   small helper to read cookie (for CSRF)
   --------------------------- */
function getCookie(name) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

/* ---------------------------
   Interceptors: add headers + dev debug
   --------------------------- */
fastapiClient.interceptors.request.use((cfg) => {
  cfg.headers = { ...(cfg.headers || {}), "Content-Type": "application/json" };
  const token = getAuthToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;

  // DEV diagnostics
  if (import.meta.env.DEV) {
    console.debug("[fastapiClient] req:", cfg.method, cfg.url, "hasAuth:", !!token);
  }
  return cfg;
});

djangoClient.interceptors.request.use((cfg) => {
  cfg.headers = { ...(cfg.headers || {}), "Content-Type": "application/json" };
  const token = getAuthToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;

  // Django CSRF (if cookie present)
  const csrft = getCookie("csrftoken");
  if (csrft) cfg.headers["X-CSRFToken"] = csrft;

  if (import.meta.env.DEV) {
    console.debug("[djangoClient] req:", cfg.method, cfg.url, "hasAuth:", !!token, "hasCsrf:", !!csrft);
  }
  return cfg;
});

/* ---------------------------
   Response interceptor: emits an event on 401 so auth layer can react
   --------------------------- */
function handle401(err) {
  const status = err?.response?.status;
  if (status === 401) {
    try {
      window.dispatchEvent(new CustomEvent("auth:unauthorized", { detail: { url: err?.config?.url } }));
    } catch {
      // ignore
    }
  }
  return Promise.reject(err);
}
fastapiClient.interceptors.response.use((r) => r, handle401);
djangoClient.interceptors.response.use((r) => r, handle401);

/* ---------------------------
   Path normalizer + helper wrappers
   --------------------------- */
function normalizePath(path) {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export async function postFastAPI(path, body, opts = {}) {
  const p = normalizePath(path);
  try {
    const resp = await fastapiClient.post(p, body, opts);
    return resp;
  } catch (err) {
    const e = new Error(err.message || "FastAPI request failed");
    e.status = err?.response?.status;
    e.data = err?.response?.data;
    e.original = err;
    throw e;
  }
}

export async function postDjango(path, body, opts = {}) {
  const p = normalizePath(path);
  try {
    const resp = await djangoClient.post(p, body, opts);
    return resp;
  } catch (err) {
    const e = new Error(err.message || "Django proxy request failed");
    e.status = err?.response?.status;
    e.data = err?.response?.data;
    e.original = err;
    throw e;
  }
}
