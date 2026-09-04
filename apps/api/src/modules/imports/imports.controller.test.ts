import { describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "@orbit/backend";
import { ImportsController } from "./imports.controller";

const admin = { id: "10000000-0000-4000-8000-000000000001", role: "ADMIN", isActive: true } as const;

describe("ImportsController", () => {
  it("imports valid candidate rows and reports row-level failures", async () => {
    const candidates = { createCandidate: vi.fn().mockResolvedValueOnce({ id: "candidate-1" }).mockRejectedValueOnce(new Error("duplicate email")) };
    const controller = new ImportsController({} as never, candidates as never);
    await expect(controller.candidatesImport({ csv: "first_name,last_name,email\nAvery,\"Chen, Jr.\",avery@example.com\nBroken,Row,bad@example.com" }, { actor: admin } as never)).resolves.toEqual({ imported: 1, failed: 1, errors: [{ row: 3, message: "duplicate email" }] });
    expect(candidates.createCandidate).toHaveBeenCalledWith(admin, expect.objectContaining({ firstName: "Avery", lastName: "Chen, Jr.", email: "avery@example.com" }));
  });

  it("rejects non-admin actors before reading the CSV", async () => {
    const candidates = { createCandidate: vi.fn() };
    const controller = new ImportsController({} as never, candidates as never);
    await expect(controller.candidatesImport({ csv: "first_name,last_name\nAvery,Chen" }, { actor: { id: "x", role: "BD", isActive: true } } as never)).rejects.toBeInstanceOf(AuthorizationError);
    expect(candidates.createCandidate).not.toHaveBeenCalled();
  });
});
