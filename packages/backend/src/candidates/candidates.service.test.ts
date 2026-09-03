import { describe, expect, it } from "vitest";

import {
  AuthorizationError,
  ConflictError,
  StaleVersionError,
  ValidationError,
} from "../errors/app-error";
import { AuthorizationService } from "../identity/authorization.service";
import { CandidatesService } from "./candidates.service";

const NOW = new Date("2026-09-02T12:00:00.000Z");
const ADMIN = {
  id: "10000000-0000-4000-8000-000000000001",
  displayName: "Orbit Admin",
  email: "admin@orbit.test",
  role: "ADMIN" as const,
  isActive: true,
};

type Candidate = {
  id: string;
  linkedUserId: string | null;
  archivedById: string | null;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  email: string | null;
  phone: string | null;
  timezone: string;
  location: string | null;
  internalNotes: string | null;
  status: "ACTIVE" | "ARCHIVED";
  archivedAt: Date | null;
  archiveReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

type Profile = {
  id: string;
  candidateId: string;
  createdById: string;
  archivedById: string | null;
  name: string;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
  defaultCurrency: string;
  targetCompensation: string | null;
  compensationPeriod: "HOURLY" | "YEARLY" | null;
  targetRoles: string[];
  preferredLocations: string[];
  workplacePreferences: string[];
  jobTypePreferences: string[];
  contractPreferences: string[];
  archivedAt: Date | null;
  archiveReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

type User = {
  id: string;
  displayName: string;
  email: string;
  role: "ADMIN" | "BD" | "CLOSER";
  isActive: boolean;
};
type Assignment = {
  id: string;
  profileId: string;
  userId: string;
  assignedById?: string;
  setById?: string;
  isEligible?: boolean;
  assignedAt: Date;
  endedAt: Date | null;
  endedReason: string | null;
};

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: "20000000-0000-4000-8000-000000000001",
    linkedUserId: null,
    archivedById: null,
    firstName: "Ada",
    lastName: "Lovelace",
    preferredName: null,
    email: "ada@orbit.test",
    phone: null,
    timezone: "UTC",
    location: null,
    internalNotes: "Private note",
    status: "ACTIVE",
    archivedAt: null,
    archiveReason: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };
}

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "30000000-0000-4000-8000-000000000001",
    candidateId: "20000000-0000-4000-8000-000000000001",
    createdById: ADMIN.id,
    archivedById: null,
    name: "Platform Engineering",
    description: null,
    status: "DRAFT",
    defaultCurrency: "USD",
    targetCompensation: null,
    compensationPeriod: null,
    targetRoles: [],
    preferredLocations: [],
    workplacePreferences: [],
    jobTypePreferences: [],
    contractPreferences: [],
    archivedAt: null,
    archiveReason: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };
}

function createFullPersistence({
  candidates = [candidate()],
  profiles = [profile()],
  users = [ADMIN],
  bdAssignments = [] as Assignment[],
  closerEligibilities = [] as Assignment[],
}: {
  candidates?: Candidate[];
  profiles?: Profile[];
  users?: User[];
  bdAssignments?: Assignment[];
  closerEligibilities?: Assignment[];
} = {}) {
  const activityEvents: Array<{ action: string; entityId: string }> = [];
  const matches = (record: Record<string, unknown>, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, expected]) => record[key] === expected);
  const activeAssignment = (assignments: Assignment[], profileId: string, userId: string, eligible?: boolean) =>
    assignments.find((assignment) =>
      assignment.profileId === profileId
      && assignment.userId === userId
      && assignment.endedAt === null
      && (eligible === undefined || assignment.isEligible === eligible),
    ) ?? null;

  const candidateStore = {
    findUnique: async ({ where }: { where: { id: string } }) => candidates.find((item) => item.id === where.id) ?? null,
    findMany: async () => [...candidates],
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const created = candidate({
        id: `20000000-0000-4000-8000-${String(candidates.length + 1).padStart(12, "0")}`,
        ...data,
      } as Partial<Candidate>);
      candidates.push(created);
      return created;
    },
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const existing = candidates.find((item) => matches(item, where));
      if (!existing) return { count: 0 };
      const { version: _version, ...changes } = data;
      Object.assign(existing, changes, { version: existing.version + 1, updatedAt: NOW });
      return { count: 1 };
    },
  };
  const profileStore = {
    findUnique: async ({ where }: { where: { id: string } }) => profiles.find((item) => item.id === where.id) ?? null,
    findMany: async ({ where = {} }: { where?: Record<string, unknown> } = {}) => {
      const scopedBd = (where.bdAssignments as { some?: { userId?: string } } | undefined)?.some?.userId;
      return profiles.filter((item) =>
        (!where.candidateId || item.candidateId === where.candidateId)
        && (!where.status || item.status === where.status)
        && (!scopedBd || activeAssignment(bdAssignments, item.id, scopedBd)),
      );
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const created = profile({
        id: `30000000-0000-4000-8000-${String(profiles.length + 1).padStart(12, "0")}`,
        ...data,
      } as Partial<Profile>);
      profiles.push(created);
      return created;
    },
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const existing = profiles.find((item) => matches(item, where));
      if (!existing) return { count: 0 };
      const { version: _version, ...changes } = data;
      Object.assign(existing, changes, { version: existing.version + 1, updatedAt: NOW });
      return { count: 1 };
    },
  };
  const assignmentStore = (assignments: Assignment[]) => ({
    findFirst: async ({ where }: { where: Record<string, unknown> }) =>
      assignments.find((item) => matches(item, where)) ?? null,
    findMany: async ({ where = {} }: { where?: Record<string, unknown> } = {}) =>
      assignments.filter((item) => matches(item, where)),
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const duplicate = assignments.find((item) =>
        item.profileId === data.profileId && item.userId === data.userId && item.endedAt === null,
      );
      if (duplicate) throw Object.assign(new Error("unique"), { code: "P2002" });
      const created: Assignment = {
        id: `40000000-0000-4000-8000-${String(assignments.length + 1).padStart(12, "0")}`,
        assignedAt: NOW,
        endedAt: null,
        endedReason: null,
        ...data,
      } as Assignment;
      assignments.push(created);
      return created;
    },
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const existing = assignments.find((item) => matches(item, where));
      if (!existing) return { count: 0 };
      Object.assign(existing, data);
      return { count: 1 };
    },
  });
  const bdStore = assignmentStore(bdAssignments);
  const closerStore = assignmentStore(closerEligibilities);
  const transaction = {
    candidate: candidateStore,
    profile: profileStore,
    profileBdAssignment: bdStore,
    profileCloserEligibility: closerStore,
    activityEvent: {
      create: async ({ data }: { data: { action: string; entityId: string } }) => {
        activityEvents.push(data);
        return data;
      },
    },
  };

  return {
    candidates,
    profiles,
    users,
    bdAssignments,
    closerEligibilities,
    activityEvents,
    candidate: candidateStore,
    profile: profileStore,
    profileBdAssignment: bdStore,
    profileCloserEligibility: closerStore,
    user: { findUnique: async ({ where }: { where: { id: string } }) => users.find((item) => item.id === where.id) ?? null },
    $transaction: async <T>(work: (tx: typeof transaction) => Promise<T>) => work(transaction),
  };
}

function createPersistence() {
  const candidates: Candidate[] = [];
  const activityEvents: Array<{ action: string; entityId: string }> = [];

  const candidate = {
    findUnique: async ({ where }: { where: { id: string } }) =>
      candidates.find((item) => item.id === where.id) ?? null,
    findMany: async () => [...candidates],
    create: async ({ data }: { data: Omit<Candidate, "id" | "createdAt" | "updatedAt" | "version" | "archivedAt" | "archiveReason" | "archivedById" | "status"> }) => {
      const created: Candidate = {
        id: "20000000-0000-4000-8000-000000000001",
        archivedAt: null,
        archivedById: null,
        archiveReason: null,
        createdAt: NOW,
        status: "ACTIVE",
        updatedAt: NOW,
        version: 1,
        ...data,
      };
      candidates.push(created);
      return created;
    },
    updateMany: async ({ where, data }: { where: { id: string; version: number }; data: Record<string, unknown> }) => {
      const existing = candidates.find((item) => item.id === where.id && item.version === where.version);
      if (!existing) return { count: 0 };

      const { version: _version, ...changes } = data;
      Object.assign(existing, changes, { version: existing.version + 1, updatedAt: NOW });
      return { count: 1 };
    },
  };

  const tx = {
    candidate,
    activityEvent: {
      create: async ({ data }: { data: { action: string; entityId: string } }) => {
        activityEvents.push(data);
        return data;
      },
    },
  };

  return {
    candidates,
    activityEvents,
    candidate,
    profile: { findMany: async () => [] },
    profileBdAssignment: { findFirst: async () => null },
    profileCloserEligibility: { findFirst: async () => null },
    user: { findUnique: async () => null },
    $transaction: async <T>(work: (transaction: typeof tx) => Promise<T>) => work(tx),
  };
}

describe("CandidatesService", () => {
  it("lets an active Admin create, update, archive, and restore a candidate with audited version changes", async () => {
    const persistence = createPersistence();
    const authorization = new AuthorizationService(persistence as never);
    const service = new CandidatesService(persistence as never, authorization, () => NOW);

    const created = await service.createCandidate(ADMIN, {
      firstName: "  Ada  ",
      lastName: "  Lovelace  ",
      email: "  Ada@Example.test  ",
      timezone: "Europe/London",
    });
    const updated = await service.updateCandidate(ADMIN, created.id, { preferredName: "Ada" }, 1);
    const archived = await service.archiveCandidate(ADMIN, created.id, "Duplicate record", 2);
    const restored = await service.restoreCandidate(ADMIN, created.id, 3);

    expect(updated).toMatchObject({ id: created.id, preferredName: "Ada", version: 2 });
    expect(archived).toMatchObject({
      id: created.id,
      status: "ARCHIVED",
      archiveReason: "Duplicate record",
      archivedAt: NOW.toISOString(),
      version: 3,
    });
    expect(restored).toMatchObject({
      id: created.id,
      status: "ACTIVE",
      archivedAt: null,
      archiveReason: null,
      version: 4,
    });
    expect(persistence.activityEvents.map((event) => event.action)).toEqual([
      "candidate.created",
      "candidate.updated",
      "candidate.archived",
      "candidate.restored",
    ]);
  });

  it("lets an Admin create and retrieve a profile under an active candidate", async () => {
    const persistence = createFullPersistence({ profiles: [] });
    const service = new CandidatesService(
      persistence as never,
      new AuthorizationService(persistence as never),
      () => NOW,
    );
    const candidateId = persistence.candidates[0]!.id;

    const created = await service.createProfile(ADMIN, {
      candidateId,
      name: "  Platform Engineering  ",
      targetRoles: ["  Staff Engineer  "],
    });

    await expect(service.listCandidates(ADMIN, { limit: 50 })).resolves.toMatchObject({
      items: [expect.objectContaining({ id: candidateId })],
    });
    await expect(service.getCandidate(ADMIN, candidateId)).resolves.toMatchObject({
      id: candidateId,
      profiles: [expect.objectContaining({ id: created.id, targetRoles: ["Staff Engineer"] })],
    });
    await expect(service.listProfiles(ADMIN, { limit: 50 })).resolves.toMatchObject({
      items: [expect.objectContaining({ id: created.id })],
    });
  });

  it("returns only actively assigned profiles to BDs and gives eligible Closers direct limited profile context", async () => {
    const bd: User = {
      ...ADMIN,
      id: "10000000-0000-4000-8000-000000000002",
      email: "bd@orbit.test",
      role: "BD",
    };
    const closer: User = {
      ...ADMIN,
      id: "10000000-0000-4000-8000-000000000003",
      email: "closer@orbit.test",
      role: "CLOSER",
    };
    const assigned = profile();
    const unassigned = profile({ id: "30000000-0000-4000-8000-000000000002", name: "Unassigned" });
    const persistence = createFullPersistence({
      profiles: [assigned, unassigned],
      users: [ADMIN, bd, closer],
      bdAssignments: [{
        id: "40000000-0000-4000-8000-000000000001",
        profileId: assigned.id,
        userId: bd.id,
        assignedById: ADMIN.id,
        assignedAt: NOW,
        endedAt: null,
        endedReason: null,
      }],
      closerEligibilities: [{
        id: "50000000-0000-4000-8000-000000000001",
        profileId: assigned.id,
        userId: closer.id,
        setById: ADMIN.id,
        isEligible: true,
        assignedAt: NOW,
        endedAt: null,
        endedReason: null,
      }],
    });
    const service = new CandidatesService(
      persistence as never,
      new AuthorizationService(persistence as never),
      () => NOW,
    );

    await expect(service.listProfiles(bd, { limit: 50 })).resolves.toMatchObject({ items: [{ id: assigned.id }] });
    await expect(service.listProfiles(closer, { limit: 50 })).resolves.toEqual({ items: [], nextCursor: null });
    await expect(service.getProfile(closer, assigned.id)).resolves.toEqual(expect.objectContaining({
      id: assigned.id,
      candidate: { id: assigned.candidateId, firstName: "Ada", lastName: "Lovelace", preferredName: null },
    }));
  });

  it("denies inactive actors and BDs without an active assignment", async () => {
    const bd: User = { ...ADMIN, id: "10000000-0000-4000-8000-000000000002", role: "BD", email: "bd@orbit.test" };
    const inactiveAdmin: User = { ...ADMIN, isActive: false };
    const persistence = createFullPersistence({ users: [ADMIN, bd, inactiveAdmin] });
    const service = new CandidatesService(
      persistence as never,
      new AuthorizationService(persistence as never),
      () => NOW,
    );

    await expect(service.getProfile(bd, persistence.profiles[0]!.id)).rejects.toEqual(new AuthorizationError());
    await expect(service.listProfiles(inactiveAdmin, { limit: 50 })).rejects.toEqual(new AuthorizationError());
    await expect(service.createCandidate(inactiveAdmin, {
      firstName: "Grace",
      lastName: "Hopper",
      timezone: "UTC",
    })).rejects.toEqual(new AuthorizationError());
  });

  it("prevents profiles and assignments from being added to archived records", async () => {
    const archivedCandidate = candidate({
      status: "ARCHIVED",
      archivedAt: NOW,
      archiveReason: "No longer seeking",
      archivedById: ADMIN.id,
    });
    const archivedProfile = profile({
      status: "ARCHIVED",
      archivedAt: NOW,
      archiveReason: "Paused indefinitely",
      archivedById: ADMIN.id,
    });
    const bd: User = { ...ADMIN, id: "10000000-0000-4000-8000-000000000002", role: "BD", email: "bd@orbit.test" };
    const persistence = createFullPersistence({
      candidates: [archivedCandidate],
      profiles: [archivedProfile],
      users: [ADMIN, bd],
      bdAssignments: [{
        id: "40000000-0000-4000-8000-000000000001",
        profileId: archivedProfile.id,
        userId: bd.id,
        assignedById: ADMIN.id,
        assignedAt: NOW,
        endedAt: null,
        endedReason: null,
      }],
    });
    const service = new CandidatesService(
      persistence as never,
      new AuthorizationService(persistence as never),
      () => NOW,
    );

    await expect(service.createProfile(ADMIN, {
      candidateId: archivedCandidate.id,
      name: "Backend roles",
    })).rejects.toEqual(new ConflictError("Archived candidates cannot receive profiles"));
    await expect(service.assignBd(ADMIN, archivedProfile.id, bd.id)).rejects.toEqual(
      new ConflictError("Archived profiles cannot receive assignments"),
    );
    await expect(service.getProfile(bd, archivedProfile.id)).rejects.toEqual(new AuthorizationError());
  });

  it("keeps assignment history while rejecting duplicate active assignments", async () => {
    const bd: User = { ...ADMIN, id: "10000000-0000-4000-8000-000000000002", role: "BD", email: "bd@orbit.test" };
    const closer: User = { ...ADMIN, id: "10000000-0000-4000-8000-000000000003", role: "CLOSER", email: "closer@orbit.test" };
    const persistence = createFullPersistence({ users: [ADMIN, bd, closer] });
    const service = new CandidatesService(
      persistence as never,
      new AuthorizationService(persistence as never),
      () => NOW,
    );
    const profileId = persistence.profiles[0]!.id;

    const assignedBd = await service.assignBd(ADMIN, profileId, bd.id);
    await expect(service.assignBd(ADMIN, profileId, bd.id)).rejects.toEqual(
      new ConflictError("The BD is already assigned to this profile"),
    );
    await expect(service.assignBd(ADMIN, profileId, closer.id)).rejects.toEqual(
      new ValidationError("The selected user is not an active matching-role user"),
    );
    await service.endBdAssignment(ADMIN, profileId, assignedBd.id, "Coverage moved");
    const reassignedBd = await service.assignBd(ADMIN, profileId, bd.id);
    const eligibleCloser = await service.setCloserEligibility(ADMIN, profileId, closer.id);
    await service.endCloserEligibility(ADMIN, profileId, eligibleCloser.id, "Unavailable");

    await expect(service.listBdAssignments(ADMIN, profileId)).resolves.toEqual([
      expect.objectContaining({ id: assignedBd.id, endedAt: NOW.toISOString(), endedReason: "Coverage moved" }),
      expect.objectContaining({ id: reassignedBd.id, endedAt: null }),
    ]);
    await expect(service.listCloserEligibility(ADMIN, profileId)).resolves.toEqual([
      expect.objectContaining({ id: eligibleCloser.id, endedAt: NOW.toISOString(), endedReason: "Unavailable" }),
    ]);
  });

  it("maps stale candidate and profile writes to optimistic concurrency conflicts", async () => {
    const persistence = createFullPersistence({
      candidates: [candidate({ version: 2 })],
      profiles: [profile({ version: 3 })],
    });
    const service = new CandidatesService(
      persistence as never,
      new AuthorizationService(persistence as never),
      () => NOW,
    );

    await expect(service.updateCandidate(ADMIN, persistence.candidates[0]!.id, { firstName: "Augusta" }, 1)).rejects.toEqual(
      new StaleVersionError(1, 2),
    );
    await expect(service.updateProfile(ADMIN, persistence.profiles[0]!.id, { name: "Staff platform roles" }, 2)).rejects.toEqual(
      new StaleVersionError(2, 3),
    );
  });

  it("archives profiles with a reason and restores them to DRAFT", async () => {
    const persistence = createFullPersistence({ profiles: [profile({ status: "ACTIVE" })] });
    const service = new CandidatesService(
      persistence as never,
      new AuthorizationService(persistence as never),
      () => NOW,
    );
    const profileId = persistence.profiles[0]!.id;

    const archived = await service.transitionProfile(ADMIN, profileId, "ARCHIVED", "Candidate withdrew", 1);
    const restored = await service.transitionProfile(ADMIN, profileId, "DRAFT", null, 2);

    expect(archived).toMatchObject({ status: "ARCHIVED", archiveReason: "Candidate withdrew", version: 2 });
    expect(restored).toMatchObject({ status: "DRAFT", archivedAt: null, archiveReason: null, version: 3 });
    expect(persistence.activityEvents.map((event) => event.action)).toEqual([
      "profile.archived",
      "profile.restored",
    ]);
  });
});
