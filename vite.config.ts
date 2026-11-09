import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    // Pin the API base URL so a local .env never changes test expectations.
    env: { VITE_API_URL: "http://localhost:3000" },
  },
});
