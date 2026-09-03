import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { hasWorkspaceFile, readWorkspacePackageMetadata } from "./workspace";

describe("Orbit workspace", () => {
  it("declares all applications and five shared packages", () => {
    const metadata = readWorkspacePackageMetadata();

    expect(metadata.map(({ name }) => name)).toEqual([
      "@orbit/web",
      "@orbit/api",
      "@orbit/worker",
      "@orbit/config",
      "@orbit/contracts",
      "@orbit/database",
      "@orbit/backend",
      "@orbit/ui",
      "@orbit/testing",
    ]);

    expect(metadata.every(({ exports }) => exports["."] === "./src/index.ts")).toBe(true);
  });

  it("provides foundation lint, web build, and e2e entrypoints", () => {
    expect(hasWorkspaceFile("eslint.config.mjs")).toBe(true);
    expect(hasWorkspaceFile("apps/web/app/layout.tsx")).toBe(true);
    expect(hasWorkspaceFile("apps/web/app/page.tsx")).toBe(true);
    expect(hasWorkspaceFile("apps/api/vitest.e2e.config.ts")).toBe(true);
    expect(hasWorkspaceFile("apps/worker/vitest.e2e.config.ts")).toBe(true);
  });

  it("runs service e2e checks before browser smoke without the destructive database suite", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts["test:e2e"]).toBe(
      "pnpm test:e2e:services && pnpm test:e2e:smoke",
    );
    expect(packageJson.scripts["test:e2e:services"]).toBe(
      "turbo run test:e2e --filter=@orbit/api --filter=@orbit/worker",
    );
    expect(packageJson.scripts["test:e2e:smoke"]).toBe(
      "turbo run test:e2e --filter=@orbit/web",
    );
  });
});
