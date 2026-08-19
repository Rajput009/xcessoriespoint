import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
    watch: {
      // SQLite writes (server/store.db*) must not trigger dev-server reloads
      ignored: ["**/server/**", "**/shots/**", "**/*.mjs.timestamp*"],
    },
    proxy: {
      "/api": {
        target: "http://localhost:4173",
        changeOrigin: true,
        xfwd: true, // forward real client IP so per-IP rate limits work correctly
      },
    },
  },
});
