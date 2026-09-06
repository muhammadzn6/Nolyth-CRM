import { describe, expect, it } from "vitest";

import { assertDemoSeedDatabaseAllowed } from "../src/demo-seed-safety";

describe("demo seed safety", () => {
  it("refuses a shared-style database before attempting a connection", () => {
    expect(() => assertDemoSeedDatabaseAllowed({
      databaseUrl: "postgresql://orbit:orbit@127.0.0.1:1/orbit",
      nodeEnv: "test",
    })).toThrow(
      "Demo seed may only target a disposable database",
    );
  });

  it("allows a deliberately enabled non-production seed to proceed past the safety guard", () => {
    expect(() => assertDemoSeedDatabaseAllowed({
      databaseUrl: "postgresql://orbit:orbit@127.0.0.1:1/orbit",
      nodeEnv: "test",
      allowDemoSeed: true,
    })).not.toThrow();
  });

  it("never permits the override in production", () => {
    expect(() => assertDemoSeedDatabaseAllowed({
      databaseUrl: "postgresql://orbit:orbit@127.0.0.1:1/orbit",
      nodeEnv: "production",
      allowDemoSeed: true,
    })).toThrow(
      "Demo seed may only target a disposable database",
    );
  });

  it("allows named disposable databases without an override", () => {
    expect(() => assertDemoSeedDatabaseAllowed({
      databaseUrl: "postgresql://orbit:orbit@127.0.0.1:1/orbit_e2e",
      nodeEnv: "test",
    })).not.toThrow();
  });
});
