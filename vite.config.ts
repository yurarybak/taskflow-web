import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        // React and the router change rarely, so they get their own
        // long-cacheable chunk instead of sharing one with app code.
        manualChunks(id) {
          if (
            /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/.test(
              id,
            )
          )
            return "vendor-react";
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    // Pin the API base URL so a local .env never changes test expectations.
    env: { VITE_API_URL: "http://localhost:3000" },
    // Component tests render whole lazy-loaded pages and may wait up to 5s in
    // a single findBy (asyncUtilTimeout in setup.ts), so a test needs more
    // than the default 5s budget on a busy machine or CI runner.
    testTimeout: 15_000,
  },
});
