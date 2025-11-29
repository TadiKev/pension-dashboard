// src/lib/apiClient.js
import axios from "axios";

/**
 * Two axios clients:
 * - apiClient -> proxied to Django at /api (Vite proxy)
 * - fastapiClient -> proxied to FastAPI at /v1 (Vite proxy)
 *
 * They automatically attach Authorization header from localStorage.
 */

const apiClient = axios.create({
  baseURL: "/api/v1", // Vite proxy: '/api' -> Django, here we keep '/api/v1' as your router expects
  withCredentials: true,
  timeout: 15000,
});

const fastapiClient = axios.create({
  baseURL: "/v1", // Vite proxy '/v1' -> FastAPI
  withCredentials: true,
  timeout: 15000,
});

// request interceptor to attach token (keeps code robust if token changed)
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});
fastapiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});

export default apiClient;
export { fastapiClient };
