import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir),
    },
  },
  test: {
    environment: "node",
    fileParallelism: false,
    globals: true,
    hookTimeout: 30000,
    testTimeout: 30000,
    setupFiles: [path.resolve(rootDir, "vitest.setup.ts")],
    include: ["**/*.{test,spec}.ts", "**/*.{test,spec}.tsx"],
    exclude: ["**/node_modules/**", ".next", "**/e2e/**"],
  },
});
