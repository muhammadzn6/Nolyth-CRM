import "reflect-metadata";

import type { CandidatesService, SessionRequest } from "@orbit/backend";
import {
  AuthenticationError,
  AuthorizationError,
  StaleVersionError,
  ValidationError,
} from "@orbit/backend";
import type { SessionUser } from "@orbit/contracts";
import { describe, expect, it, vi } from "vitest";

import { CandidatesController } from "./candidates.controller";

const trustedOrigin = "https://orbit.example.com";
const candidateId = "20000000-0000-4000-8000-000000000001";
const profileId = "30000000-0000-4000-8000-000000000001";
const assignmentId = "40000000-0000-4000-8000-000000000001";
const userId = "10000000-0000-4000-8000-000000000002";

const admin: SessionUser = {
  id: "10000000-0000-4000-8000-000000000001",
  displayName: "Admin User",
  email: "admin@orbit.test",
  role: "ADMIN",
  isActive: true,
};

type TestRequest = SessionRequest & {
  actor?: SessionUser;
  headers: { origin?: string | string[] };
};

function requestFor(origin: string | string[] | undefined = trustedOrigin): TestRequest {
  return {
    actor: admin,
    cookies: {},
    headers: origin === undefined ? {} : { origin },
  };
}

function requestWithoutOrigin(): TestRequest {
  return { actor: admin, cookies: {}, headers: {} };
}

function createHarness() {
  const service = {
    listCandidates: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    createCandidate: vi.fn().mockResolvedValue({ id: candidateId }),
    getCandidate: vi.fn().mockResolvedValue({ id: candidateId, profiles: [] }),
    updateCandidate: vi.fn().mockResolvedValue({ id: candidateId, version: 2 }),
    archiveCandidate: vi.fn().mockResolvedValue({ id: candidateId, status: "ARCHIVED" }),
    restoreCandidate: vi.fn().mockResolvedValue({ id: candidateId, status: "ACTIVE" }),
    listProfiles: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    createProfile: vi.fn().mockResolvedValue({ id: profileId }),
    getProfile: vi.fn().mockResolvedValue({ id: profileId }),
    updateProfile: vi.fn().mockResolvedValue({ id: profileId, version: 2 }),
    transitionProfile: vi.fn().mockResolvedValue({ id: profileId, version: 2 }),
    listBdAssignments: vi.fn().mockResolvedValue([]),
    assignBd: vi.fn().mockResolvedValue({ id: assignmentId }),
    endBdAssignment: vi.fn().mockResolvedValue(undefined),
    listCloserEligibility: vi.fn().mockResolvedValue([]),
    setCloserEligibility: vi.fn().mockResolvedValue({ id: assignmentId }),
    endCloserEligibility: vi.fn().mockResolvedValue(undefined),
  };

  return {
    controller: new CandidatesController(
      service as unknown as CandidatesService,
      `${trustedOrigin}/app`,
    ),
    service,
  };
}

describe("CandidatesController", () => {
  it("requires an authenticated actor before reads reach the service", async () => {
    const { controller, service } = createHarness();
    const request: TestRequest = { cookies: {}, headers: {} };

    await expect(
      Promise.resolve().then(() => controller.listCandidates({}, request)),
    ).rejects.toEqual(
      new AuthenticationError(),
    );
    expect(service.listCandidates).not.toHaveBeenCalled();
  });

  it("validates and forwards candidate reads", async () => {
    const { controller, service } = createHarness();

    await controller.listCandidates({ search: "  Ada  ", limit: "10" }, requestFor());
    await controller.getCandidate(candidateId, requestFor());

    expect(service.listCandidates).toHaveBeenCalledWith(admin, {
      search: "Ada",
      limit: 10,
    });
    expect(service.getCandidate).toHaveBeenCalledWith(admin, candidateId);
  });

  it("validates and forwards candidate mutations with concurrency inputs", async () => {
    const { controller, service } = createHarness();

    await controller.createCandidate(
      { firstName: " Ada ", lastName: " Lovelace ", timezone: "UTC" },
      requestFor(),
    );
    await controller.updateCandidate(
      candidateId,
      { firstName: " Augusta ", expectedVersion: 1 },
      requestFor(),
    );
    await controller.archiveCandidate(
      candidateId,
      { reason: " Duplicate record ", expectedVersion: 2 },
      requestFor(),
    );
    await controller.restoreCandidate(candidateId, { expectedVersion: 3 }, requestFor());

    expect(service.createCandidate).toHaveBeenCalledWith(admin, {
      firstName: "Ada",
      lastName: "Lovelace",
      timezone: "UTC",
    });
    expect(service.updateCandidate).toHaveBeenCalledWith(
      admin,
      candidateId,
      { firstName: "Augusta" },
      1,
    );
    expect(service.archiveCandidate).toHaveBeenCalledWith(
      admin,
      candidateId,
      "Duplicate record",
      2,
    );
    expect(service.restoreCandidate).toHaveBeenCalledWith(admin, candidateId, 3);
  });

  it("validates and forwards profile reads and status commands", async () => {
    const { controller, service } = createHarness();

    await controller.listProfiles({ candidateId, status: "ACTIVE", limit: "25" }, requestFor());
    await controller.getProfile(profileId, requestFor());
    await controller.createProfile({ candidateId, name: " Platform " }, requestFor());
    await controller.updateProfile(
      profileId,
      { name: " Backend ", expectedVersion: 1 },
      requestFor(),
    );
    await controller.activateProfile(profileId, { expectedVersion: 2 }, requestFor());
    await controller.pauseProfile(profileId, { expectedVersion: 3 }, requestFor());
    await controller.archiveProfile(
      profileId,
      { reason: " Candidate withdrew ", expectedVersion: 4 },
      requestFor(),
    );
    await controller.restoreProfile(profileId, { expectedVersion: 5 }, requestFor());

    expect(service.listProfiles).toHaveBeenCalledWith(admin, {
      candidateId,
      status: "ACTIVE",
      limit: 25,
    });
    expect(service.getProfile).toHaveBeenCalledWith(admin, profileId);
    expect(service.createProfile).toHaveBeenCalledWith(admin, {
      candidateId,
      name: "Platform",
    });
    expect(service.updateProfile).toHaveBeenCalledWith(
      admin,
      profileId,
      { name: "Backend" },
      1,
    );
    expect(service.transitionProfile).toHaveBeenNthCalledWith(
      1,
      admin,
      profileId,
      "ACTIVE",
      null,
      2,
    );
    expect(service.transitionProfile).toHaveBeenNthCalledWith(
      2,
      admin,
      profileId,
      "PAUSED",
      null,
      3,
    );
    expect(service.transitionProfile).toHaveBeenNthCalledWith(
      3,
      admin,
      profileId,
      "ARCHIVED",
      "Candidate withdrew",
      4,
    );
    expect(service.transitionProfile).toHaveBeenNthCalledWith(
      4,
      admin,
      profileId,
      "DRAFT",
      null,
      5,
    );
  });

  it("validates and forwards assignment reads and mutations", async () => {
    const { controller, service } = createHarness();

    await controller.listBdAssignments(profileId, requestFor());
    await controller.assignBd(profileId, { userId }, requestFor());
    await controller.endBdAssignment(
      profileId,
      assignmentId,
      { reason: " Coverage moved " },
      requestFor(),
    );
    await controller.listCloserEligibility(profileId, requestFor());
    await controller.setCloserEligibility(profileId, { userId }, requestFor());
    await controller.endCloserEligibility(
      profileId,
      assignmentId,
      { reason: " Unavailable " },
      requestFor(),
    );

    expect(service.listBdAssignments).toHaveBeenCalledWith(admin, profileId);
    expect(service.assignBd).toHaveBeenCalledWith(admin, profileId, userId);
    expect(service.endBdAssignment).toHaveBeenCalledWith(
      admin,
      profileId,
      assignmentId,
      "Coverage moved",
    );
    expect(service.listCloserEligibility).toHaveBeenCalledWith(admin, profileId);
    expect(service.setCloserEligibility).toHaveBeenCalledWith(admin, profileId, userId);
    expect(service.endCloserEligibility).toHaveBeenCalledWith(
      admin,
      profileId,
      assignmentId,
      "Unavailable",
    );
  });

  it.each([
    ["create candidate", (controller: CandidatesController) => controller.createCandidate({ firstName: "Ada", lastName: "Lovelace" }, requestWithoutOrigin())],
    ["update candidate", (controller: CandidatesController) => controller.updateCandidate(candidateId, { firstName: "Ada", expectedVersion: 1 }, requestWithoutOrigin())],
    ["archive candidate", (controller: CandidatesController) => controller.archiveCandidate(candidateId, { reason: "Duplicate", expectedVersion: 1 }, requestWithoutOrigin())],
    ["restore candidate", (controller: CandidatesController) => controller.restoreCandidate(candidateId, { expectedVersion: 1 }, requestWithoutOrigin())],
    ["create profile", (controller: CandidatesController) => controller.createProfile({ candidateId, name: "Platform" }, requestWithoutOrigin())],
    ["update profile", (controller: CandidatesController) => controller.updateProfile(profileId, { name: "Backend", expectedVersion: 1 }, requestWithoutOrigin())],
    ["activate profile", (controller: CandidatesController) => controller.activateProfile(profileId, { expectedVersion: 1 }, requestWithoutOrigin())],
    ["pause profile", (controller: CandidatesController) => controller.pauseProfile(profileId, { expectedVersion: 1 }, requestWithoutOrigin())],
    ["archive profile", (controller: CandidatesController) => controller.archiveProfile(profileId, { reason: "Withdrawn", expectedVersion: 1 }, requestWithoutOrigin())],
    ["restore profile", (controller: CandidatesController) => controller.restoreProfile(profileId, { expectedVersion: 1 }, requestWithoutOrigin())],
    ["assign BD", (controller: CandidatesController) => controller.assignBd(profileId, { userId }, requestWithoutOrigin())],
    ["end BD assignment", (controller: CandidatesController) => controller.endBdAssignment(profileId, assignmentId, { reason: "Moved" }, requestWithoutOrigin())],
    ["set Closer eligibility", (controller: CandidatesController) => controller.setCloserEligibility(profileId, { userId }, requestWithoutOrigin())],
    ["end Closer eligibility", (controller: CandidatesController) => controller.endCloserEligibility(profileId, assignmentId, { reason: "Unavailable" }, requestWithoutOrigin())],
  ])("rejects a missing Origin before %s", async (_label, invoke) => {
    const { controller, service } = createHarness();

    await expect(Promise.resolve().then(async () => {
      await invoke(controller);
    })).rejects.toEqual(
      new AuthorizationError("Request origin is not allowed"),
    );
    expect(Object.values(service).every((method) => method.mock.calls.length === 0)).toBe(true);
  });

  it.each([
    ["malformed candidate id", () => createHarness().controller.getCandidate("not-a-uuid", requestFor())],
    ["unknown candidate field", () => createHarness().controller.createCandidate({ firstName: "Ada", lastName: "Lovelace", isActive: true }, requestFor())],
    ["missing candidate version", () => createHarness().controller.updateCandidate(candidateId, { firstName: "Ada" }, requestFor())],
    ["invalid profile version", () => createHarness().controller.pauseProfile(profileId, { expectedVersion: 0 }, requestFor())],
    ["missing archive reason", () => createHarness().controller.archiveProfile(profileId, { expectedVersion: 1 }, requestFor())],
    ["unknown assignment field", () => createHarness().controller.assignBd(profileId, { userId, role: "BD" }, requestFor())],
    ["missing end reason", () => createHarness().controller.endBdAssignment(profileId, assignmentId, {}, requestFor())],
    ["unknown query field", () => createHarness().controller.listProfiles({ ownerId: userId }, requestFor())],
  ])("rejects %s as a validation error", async (_label, invoke) => {
    await expect(Promise.resolve().then(async () => {
      await invoke();
    })).rejects.toEqual(
      expect.objectContaining({ statusCode: 422, code: new ValidationError().code }),
    );
  });

  it("preserves service concurrency errors for the API error filter", async () => {
    const { controller, service } = createHarness();
    service.updateProfile.mockRejectedValueOnce(new StaleVersionError(1, 2));

    await expect(
      controller.updateProfile(
        profileId,
        { name: "Backend", expectedVersion: 1 },
        requestFor(),
      ),
    ).rejects.toEqual(new StaleVersionError(1, 2));
  });
});
