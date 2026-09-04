import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

const workspaceRoot = resolve(__dirname, "../..");
const webOrigin = process.env.ORBIT_E2E_WEB_ORIGIN ?? "http://localhost:3100";
const apiOrigin = process.env.ORBIT_E2E_API_ORIGIN ?? "http://localhost:3101";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "line",
  use: {
    baseURL: webOrigin,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "node scripts/start-foundation.mjs",
    cwd: workspaceRoot,
    env: {
      API_PORT: new URL(apiOrigin).port,
      APP_BASE_URL: webOrigin,
      DATABASE_URL:
        process.env.DATABASE_URL ?? "postgresql://orbit:orbit@localhost:5432/orbit",
      NEXT_PUBLIC_API_BASE_URL: `${apiOrigin}/api/v1`,
      NEXT_PUBLIC_APP_BASE_URL: webOrigin,
      ORBIT_SEED_ADMIN_PASSWORD: process.env.ORBIT_SEED_ADMIN_PASSWORD ?? "",
      PORT: new URL(webOrigin).port,
      REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
      S3_ACCESS_KEY: process.env.S3_ACCESS_KEY ?? "orbit",
      S3_BUCKET: process.env.S3_BUCKET ?? "orbit-local",
      S3_ENDPOINT: process.env.S3_ENDPOINT ?? "http://localhost:9000",
      S3_SECRET_KEY: process.env.S3_SECRET_KEY ?? "orbit-secret",
      SESSION_SECRET: process.env.SESSION_SECRET ?? "local-e2e-session-secret",
    },
    url: `${webOrigin}/login`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
