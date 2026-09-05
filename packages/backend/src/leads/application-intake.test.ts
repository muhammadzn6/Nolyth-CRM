import { describe, expect, it, vi } from "vitest";

import { LeadsService, normalizeJobUrl } from "./leads.service";
import { ConflictError, ValidationError } from "../errors/app-error";

const profileId = "10000000-0000-4000-8000-000000000001";
const otherProfileId = "10000000-0000-4000-8000-000000000002";
const companyId = "20000000-0000-4000-8000-000000000001";

function duplicateService(rows: Array<Record<string, unknown>>, now = new Date("2026-09-05T12:00:00.000Z")) {
  const jobLead = {
    findMany: vi.fn(async (args: { where: { profileId: string; appliedDate: { gte: Date } } }) => rows.filter((row) =>
      row.profileId === args.where.profileId && new Date(String(row.appliedDate)) >= args.where.appliedDate.gte,
    )),
  };
  const database = { jobLead };
  const authorization = { assertProfileAccess: vi.fn() };
  return { service: new LeadsService(database as never, authorization as never, () => now), jobLead };
}

const bd = {
  id: "40000000-0000-4000-8000-000000000001",
  displayName: "BD User",
  email: "bd@orbit.test",
  role: "BD" as const,
  isActive: true,
  timezone: "Asia/Karachi",
  lastLoginAt: null,
};

const sourceId = "50000000-0000-4000-8000-000000000001";

function leadRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "60000000-0000-4000-8000-000000000001",
    profileId,
    companyId,
    sourceId,
    createdById: bd.id,
    currentOwnerId: bd.id,
    responsibleCloserId: null,
    archivedById: null,
    closedById: null,
    companyName: "Northstar Labs",
    jobTitle: "Staff Platform Engineer",
    description: null,
    rawUrl: "https://www.linkedin.com/jobs/view/1234567890",
    canonicalUrl: "https://www.linkedin.com/jobs/view/1234567890",
    canonicalHash: "https://www.linkedin.com/jobs/view/1234567890",
    location: null,
    workplaceType: null,
    employmentType: null,
    contractType: null,
    compensationMin: null,
    compensationMax: null,
    compensationCurrency: null,
    compensationPeriod: null,
    appliedDate: new Date("2026-09-05T00:00:00.000Z"),
    status: "APPLIED",
    isImportant: false,
    closureReason: null,
    closureNotes: null,
    closedAt: null,
    placedAt: null,
    startDate: null,
    startedAt: null,
    archivedAt: null,
    archiveReason: null,
    createdAt: new Date("2026-09-05T12:00:00.000Z"),
    updatedAt: new Date("2026-09-05T12:00:00.000Z"),
    version: 1,
    ...overrides,
  };
}

function intakeService(
  saved: Array<Record<string, unknown>> = [],
  now = new Date("2026-09-05T12:00:00.000Z"),
) {
  const jobLead = {
    findMany: vi.fn(async (args: { where: { profileId: string; appliedDate: { gte: Date } } }) => saved.filter((row) =>
      row.profileId === args.where.profileId && new Date(String(row.appliedDate)) >= args.where.appliedDate.gte,
    )),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => leadRecord(data)),
  };
  const database = {
    jobLead,
    company: {
      findUnique: vi.fn().mockResolvedValue({ id: companyId, canonicalName: "Northstar Labs" }),
      create: vi.fn(),
    },
    jobSource: {
      findUnique: vi.fn().mockResolvedValue({ id: sourceId, name: "linkedin.com" }),
      create: vi.fn(),
    },
    contact: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "70000000-0000-4000-8000-000000000001" }),
    },
    leadContact: { create: vi.fn().mockResolvedValue(undefined) },
    duplicateReview: { create: vi.fn().mockResolvedValue({ id: "80000000-0000-4000-8000-000000000001" }) },
    activityEvent: { create: vi.fn().mockResolvedValue(undefined) },
  };
  const authorization = { assertProfileAccess: vi.fn().mockResolvedValue(undefined) };
  return {
    service: new LeadsService(database as never, authorization as never, () => now),
    database,
  };
}

function intakeInput(overrides: Record<string, unknown> = {}) {
  return {
    profileId,
    companyName: "Northstar Labs",
    jobTitle: "Staff Platform Engineer",
    rawUrl: "https://www.linkedin.com/jobs/view/1234567890/?utm_source=orbit#details",
    recruiterName: "Jordan Lee",
    recruiterEmail: "jordan@northstar.example",
    ...overrides,
  };
}

describe("application intake URL identity", () => {
  it("removes tracking and fragments while preserving the LinkedIn job identity", () => {
    expect(
      normalizeJobUrl("https://www.linkedin.com/jobs/view/1234567890/?utm_source=orbit&trk=public_jobs_topcard-title#details"),
    ).toBe("https://www.linkedin.com/jobs/view/1234567890");
  });

  it("keeps meaningful query parameters while normalizing other job URLs", () => {
    expect(
      normalizeJobUrl("https://jobs.example.com/openings/42/?gh_jid=42&origin=partner&utm_campaign=autumn#apply"),
    ).toBe("https://jobs.example.com/openings/42?gh_jid=42&origin=partner");
  });
});

describe("application intake duplicate classification", () => {
  const input = {
    profileId,
    companyId,
    jobTitle: "Staff Platform Engineer",
    normalizedJobUrl: "https://www.linkedin.com/jobs/view/1234567890",
  };

  it("classifies the same profile and normalized JD link as confirmed", async () => {
    const { service } = duplicateService([{
      id: "30000000-0000-4000-8000-000000000001",
      profileId,
      companyId,
      jobTitle: "Different title",
      canonicalUrl: "https://www.linkedin.com/jobs/view/1234567890/?trk=public_jobs_topcard-title",
      appliedDate: "2026-08-30T00:00:00.000Z",
    }]);

    await expect(service.classifyApplicationDuplicate(input)).resolves.toBe("CONFIRMED");
  });

  it("classifies the same profile, normalized company, and title as likely", async () => {
    const { service } = duplicateService([{
      id: "30000000-0000-4000-8000-000000000002",
      profileId,
      companyId,
      jobTitle: "  staff   platform engineer ",
      rawUrl: "https://jobs.example.com/other-role",
      appliedDate: "2026-08-30T00:00:00.000Z",
    }]);

    await expect(service.classifyApplicationDuplicate(input)).resolves.toBe("LIKELY");
  });

  it("does not collide with an application for another profile", async () => {
    const { service } = duplicateService([{
      id: "30000000-0000-4000-8000-000000000003",
      profileId: otherProfileId,
      companyId,
      jobTitle: "Staff Platform Engineer",
      canonicalUrl: input.normalizedJobUrl,
      appliedDate: "2026-08-30T00:00:00.000Z",
    }]);

    await expect(service.classifyApplicationDuplicate(input)).resolves.toBe("NONE");
  });

  it("uses the default six-month lookback and accepts an Admin-configured lookback", async () => {
    const rows = [{
      id: "30000000-0000-4000-8000-000000000004",
      profileId,
      companyId,
      jobTitle: "Staff Platform Engineer",
      canonicalUrl: input.normalizedJobUrl,
      appliedDate: "2026-03-04T00:00:00.000Z",
    }];
    const { service, jobLead } = duplicateService(rows);

    await expect(service.classifyApplicationDuplicate(input)).resolves.toBe("NONE");
    await expect(service.classifyApplicationDuplicate(input, 7)).resolves.toBe("CONFIRMED");
    expect(jobLead.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({ appliedDate: { gte: new Date("2026-03-05T12:00:00.000Z") } }),
    }));
  });
});

describe("application intake persistence", () => {
  it("rejects incomplete intake before persisting any application data", async () => {
    const { service, database } = intakeService();

    await expect(service.createApplicationIntake(bd, intakeInput({ recruiterEmail: "" }) as never)).rejects.toEqual(
      new ValidationError("The request payload is invalid", expect.anything()),
    );
    expect(database.company.create).not.toHaveBeenCalled();
    expect(database.jobLead.create).not.toHaveBeenCalled();
  });

  it("assigns the applied date server-side and returns an ordinary qualified intake state", async () => {
    const { service, database } = intakeService([], new Date("2026-10-14T12:00:00.000Z"));

    const result = await service.createApplicationIntake(bd, intakeInput() as never) as unknown as {
      lead: { appliedDate: string; canonicalUrl: string | null; canonicalHash: string | null };
      duplicate: { classification: string; qualifiedCredit: boolean; reviewId: string | null };
    };

    expect(database.jobLead.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      appliedDate: new Date("2026-10-14T00:00:00.000Z"),
      canonicalUrl: "https://www.linkedin.com/jobs/view/1234567890",
      canonicalHash: "https://www.linkedin.com/jobs/view/1234567890",
    }) });
    expect(result.lead.appliedDate).toBe("2026-10-14");
    expect(result.duplicate).toEqual({ classification: "NONE", qualifiedCredit: true, reviewId: null });
  });

  it("saves a confirmed duplicate for traceability without qualified credit", async () => {
    const { service, database } = intakeService([leadRecord({
      id: "60000000-0000-4000-8000-000000000002",
      canonicalUrl: "https://www.linkedin.com/jobs/view/1234567890",
      appliedDate: "2026-09-01T00:00:00.000Z",
    })]);

    const result = await service.createApplicationIntake(bd, intakeInput() as never) as unknown as {
      duplicate: { classification: string; qualifiedCredit: boolean; reviewId: string | null };
    };

    expect(database.jobLead.create).toHaveBeenCalledTimes(1);
    expect(database.duplicateReview.create).not.toHaveBeenCalled();
    expect(result.duplicate).toEqual({ classification: "CONFIRMED", qualifiedCredit: false, reviewId: null });
    expect(database.activityEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "lead.duplicate_detected", newSnapshot: expect.objectContaining({ classification: "CONFIRMED" }) }),
    }));
  });

  it("requires a reason before saving a likely duplicate, then creates a pending review", async () => {
    const { service, database } = intakeService([leadRecord({
      id: "60000000-0000-4000-8000-000000000003",
      jobTitle: "staff platform engineer",
      rawUrl: "https://jobs.example.com/other-role",
      canonicalUrl: "https://jobs.example.com/other-role",
      appliedDate: "2026-09-01T00:00:00.000Z",
    })]);

    await expect(service.createApplicationIntake(bd, intakeInput() as never)).rejects.toEqual(
      new ConflictError("This application looks like a likely duplicate. Add an override reason to save it.", expect.anything()),
    );
    expect(database.jobLead.create).not.toHaveBeenCalled();

    const result = await service.createApplicationIntake(bd, intakeInput({ duplicateOverrideReason: "Different recruiter request" }) as never) as unknown as {
      duplicate: { classification: string; qualifiedCredit: boolean; reviewId: string | null };
    };

    expect(database.duplicateReview.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      classification: "LIKELY",
      status: "PENDING",
      overrideReason: "Different recruiter request",
      provisionalCreditGranted: true,
    }) });
    expect(result.duplicate).toEqual({
      classification: "LIKELY",
      qualifiedCredit: true,
      reviewId: "80000000-0000-4000-8000-000000000001",
    });
  });
});
