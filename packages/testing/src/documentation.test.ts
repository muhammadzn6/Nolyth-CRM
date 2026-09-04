import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const readme = readFileSync(new URL("../../../README.md", import.meta.url), "utf8");

describe("Orbit foundation documentation", () => {
  it("keeps the canonical local setup commands discoverable", () => {
    expect(readme).toContain("pnpm install --frozen-lockfile");
    expect(readme).toContain("cp .env.example .env");
    expect(readme).toContain("docker compose up -d");
    expect(readme).toContain("pnpm db:migrate");
    expect(readme).toContain("pnpm db:seed");
    expect(readme).toContain("pnpm dev");
    expect(readme).toContain("pnpm test:e2e");
  });
});
