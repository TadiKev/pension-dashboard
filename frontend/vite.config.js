// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Django API - use IPv4 127.0.0.1 to avoid localhost/IPv6 issues
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, "/api"),
        // slightly larger timeout to avoid quick proxy timeouts during heavy processing
        proxyTimeout: 60000,
      },

      // FastAPI mapping - use 127.0.0.1 as well
      "/v1": {
        target: "http://127.0.0.1:8001",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/v1/, "/v1"),
        proxyTimeout: 60000,
      },

      // Keep /calc routing to FastAPI /v1
      "/calc": {
        target: "http://127.0.0.1:8001",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/calc/, "/v1"),
        proxyTimeout: 60000,
      },
    },
  },
});
