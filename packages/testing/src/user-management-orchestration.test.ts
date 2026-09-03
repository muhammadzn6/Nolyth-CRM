import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { hasWorkspaceFile } from "./workspace";

type PackageJson = {
  scripts: Record<string, string>;
};

function readRootPackageJson(): PackageJson {
  return JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8")) as PackageJson;
}

function containsStandaloneDestructiveTestCommand(script: string): boolean {
  return /(^|[;&|]\s*)pnpm\s+test(\s|$)/.test(script);
}

function containsBackgroundOperator(script: string): boolean {
  return /(^|[^&])&(?!&)/.test(script);
}

describe("admin user-management E2E orchestration", () => {
  it("keeps destructive database tests out of the browser smoke path", () => {
    const { scripts } = readRootPackageJson();

    expect(scripts["test:e2e"]).toBe("pnpm test:e2e:services && pnpm test:e2e:smoke");
    expect(containsStandaloneDestructiveTestCommand(scripts["test:e2e"])).toBe(false);
    expect(containsBackgroundOperator(scripts["test:e2e"])).toBe(false);
    expect(scripts["test:e2e:smoke"]).toBe("turbo run test:e2e --filter=@orbit/web");
    expect(scripts["test:e2e:smoke"]).not.toContain("@orbit/database");
    expect(scripts["test:e2e:smoke"]).not.toContain("DATABASE_URL=");
  });

  it("includes the admin user-management browser smoke in the serialized Playwright stage", () => {
    expect(hasWorkspaceFile("apps/web/e2e/user-management.spec.ts")).toBe(true);
  });
});
