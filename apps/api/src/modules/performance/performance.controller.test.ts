import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";
import { ValidationError, type PerformanceService } from "@orbit/backend";

import { PerformanceController } from "./performance.controller";

const admin = { id: "10000000-0000-4000-8000-000000000001", displayName: "Admin", email: "admin@orbit.test", role: "ADMIN" as const, isActive: true };

describe("PerformanceController", () => {
  it("validates admin performance filters before reaching the service", async () => {
    const service = { getAdminBdPerformance: vi.fn() };
    const controller = new PerformanceController(service as unknown as PerformanceService);

    expect(() => controller.admin({ from: "not-a-date", to: "2026-09-05T00:00:00.000Z" }, { actor: admin, cookies: {} })).toThrow(expect.objectContaining({ statusCode: 422, code: new ValidationError().code }));
    expect(service.getAdminBdPerformance).not.toHaveBeenCalled();
  });

  it("passes a validated duplicate review decision to the service", async () => {
    const service = { reviewDuplicateOverride: vi.fn().mockResolvedValue({ status: "APPROVED" }) };
    const controller = new PerformanceController(service as unknown as PerformanceService);

    await expect(controller.review(
      "10000000-0000-4000-8000-000000000002",
      { status: "APPROVED", reviewReason: "Verified reposting", expectedVersion: 1 },
      { actor: admin, cookies: {} },
    )).resolves.toEqual({ status: "APPROVED" });
    expect(service.reviewDuplicateOverride).toHaveBeenCalledWith(admin, "10000000-0000-4000-8000-000000000002", expect.objectContaining({ status: "APPROVED" }));
  });
});
