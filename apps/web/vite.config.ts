import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/health": {
        target: "http://localhost:4000",
        changeOrigin: true
      },
      "/health-score": {
        target: "http://localhost:4000",
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      "@githealth/ui": path.resolve(__dirname, "../../packages/ui/src/index.ts")
    }
  }
});
