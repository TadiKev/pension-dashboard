// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const AuthContext = createContext(null);

function ensureLeadingSlash(p) {
  if (!p) return "/";
  return p.startsWith("/") ? p : `/${p}`;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem("access_token"));
  const [profile, setProfile] = useState(null);

  // FASTAPI_BASE may be "http://localhost:8001" or "http://localhost:8001/v1"
  const FASTAPI_BASE_RAW = import.meta.env.VITE_FASTAPI_BASE || "http://localhost:8001";

  // Normalize FASTAPI base so we always have exactly one '/v1' segment and no trailing slash
  const FASTAPI_BASE = (() => {
    const b = String(FASTAPI_BASE_RAW).replace(/\/+$/, ""); // strip trailing slashes
    return b.endsWith("/v1") ? b : `${b}/v1`;
  })();

  useEffect(() => {
    if (token) {
      sessionStorage.setItem("access_token", token);
      // fetch profile but do not block render
      fetchProfile(token);
    } else {
      sessionStorage.removeItem("access_token");
      setProfile(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const login = useCallback(async (username, password) => {
    const resp = await fetch("/api/v1/auth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(txt || "Login failed");
    }
    const data = await resp.json();
    setToken(data.access);
    return data;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setProfile(null);
  }, []);

  const fetchProfile = useCallback(async (tok) => {
    const auth = tok ? `Bearer ${tok}` : (token ? `Bearer ${token}` : null);
    if (!auth) return;
    try {
      const resp = await fetch("/api/v1/auth/me/", {
        headers: { Authorization: auth },
        credentials: "include",
      });
      if (resp.ok) {
        const data = await resp.json();
        setProfile(data);
      } else {
        // if the token is rejected, clear local state to force re-login
        setToken(null);
        setProfile(null);
      }
    } catch (e) {
      console.error("fetchProfile error", e);
    }
  }, [token]);

  async function callDjango(path, opts = {}) {
    const headers = opts.headers ? { ...opts.headers } : {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const url = `/api/v1${ensureLeadingSlash(path)}`;
    const res = await fetch(url, { ...opts, headers, credentials: "include" });
    return res;
  }

  async function callFastAPI(path, body = null, opts = {}) {
    const headers = opts.headers ? { ...opts.headers } : {};

    // If body is FormData, don't set Content-Type (browser will set boundary)
    if (!headers["Content-Type"] && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    if (token) headers["Authorization"] = `Bearer ${token}`;

    // Ensure path has leading slash
    const p = ensureLeadingSlash(path);

    // Build final URL without duplicating /v1
    const url = `${FASTAPI_BASE}${p}`;

    const res = await fetch(url, {
      method: opts.method || (body ? "POST" : "GET"),
      body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
      headers,
      credentials: opts.credentials ?? "same-origin",
    });
    return res;
  }

  return (
    <AuthContext.Provider value={{ token, login, logout, profile, callDjango, callFastAPI }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
