import {
  assignProfileBdSchema,
  candidateListQuerySchema,
  createCandidateSchema,
  createProfileSchema,
  profileListQuerySchema,
  profileCloserEligibilitySchema,
  updateCandidateSchema,
  updateProfileSchema,
  type Assignment,
  type CandidateListQuery,
  type CandidateStatus,
  type CandidateSummary,
  type CreateCandidate,
  type CreateProfile,
  type ProfileListQuery,
  type ProfileStatus,
  type ProfileSummary,
  type UpdateCandidate,
  type UpdateProfile,
} from "@orbit/contracts";

import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  StaleVersionError,
  ValidationError,
} from "../errors/app-error";
import { AuthorizationService } from "../identity/authorization.service";
import type { Actor } from "../identity/session.service";

type CandidateRecord = {
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
  status: CandidateStatus;
  archivedAt: Date | null;
  archiveReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

type ProfileRecord = {
  id: string;
  candidateId: string;
  createdById: string;
  archivedById: string | null;
  name: string;
  description: string | null;
  status: ProfileStatus;
  defaultCurrency: string;
  targetCompensation: { toString(): string } | string | null;
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

type AssignmentRecord = {
  id: string;
  profileId: string;
  userId: string;
  assignedById?: string;
  setById?: string;
  assignedAt: Date;
  endedAt: Date | null;
  endedReason: string | null;
  isEligible?: boolean;
};

type UserRecord = {
  id: string;
  role: Actor["role"];
  isActive: boolean;
};

type ActivityEventData = {
  action: string;
  actorId: string | null;
  actorNameSnapshot: string | null;
  actorRoleSnapshot: Actor["role"] | null;
  entityId: string;
  entityType: string;
  profileId: string | null;
  metadata: Record<string, unknown> | null;
  oldSnapshot: Record<string, unknown> | null;
  newSnapshot: Record<string, unknown> | null;
  requestId: string | null;
};

type CandidateMutationStore = {
  create(args: { data: Record<string, unknown> }): Promise<CandidateRecord>;
  updateMany(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<{ count: number }>;
};

type ProfileMutationStore = {
  create(args: { data: Record<string, unknown> }): Promise<ProfileRecord>;
  updateMany(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<{ count: number }>;
};

type AssignmentMutationStore = {
  create(args: { data: Record<string, unknown> }): Promise<AssignmentRecord>;
  updateMany(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<{ count: number }>;
};

type CandidateProfileTransaction = {
  candidate: CandidateMutationStore;
  profile: ProfileMutationStore;
  profileBdAssignment: AssignmentMutationStore;
  profileCloserEligibility: AssignmentMutationStore;
  activityEvent: { create(args: { data: ActivityEventData }): Promise<unknown> };
};

export type CandidateProfileDatabase = {
  candidate: CandidateMutationStore & {
    findUnique(args: { where: { id: string } }): Promise<CandidateRecord | null>;
    findMany(args?: Record<string, unknown>): Promise<CandidateRecord[]>;
  };
  profile: ProfileMutationStore & {
    findUnique(args: { where: { id: string } }): Promise<ProfileRecord | null>;
    findMany(args?: Record<string, unknown>): Promise<ProfileRecord[]>;
  };
  profileBdAssignment: AssignmentMutationStore & {
    findFirst(args: { where: Record<string, unknown> }): Promise<AssignmentRecord | null>;
    findMany(args?: Record<string, unknown>): Promise<AssignmentRecord[]>;
  };
  profileCloserEligibility: AssignmentMutationStore & {
    findFirst(args: { where: Record<string, unknown> }): Promise<AssignmentRecord | null>;
    findMany(args?: Record<string, unknown>): Promise<AssignmentRecord[]>;
  };
  user: { findUnique(args: { where: { id: string } }): Promise<UserRecord | null> };
  $transaction<T>(work: (transaction: CandidateProfileTransaction) => Promise<T>): Promise<T>;
};

export type Page<T> = { items: T[]; nextCursor: string | null };
export type CandidateDetail = CandidateSummary & { profiles: ProfileSummary[] };
export type CandidateContext = Pick<CandidateSummary, "id" | "firstName" | "lastName" | "preferredName" | "timezone">;
export type ProfileDetail = ProfileSummary & { candidate: CandidateContext };

function validationError(issues: unknown): ValidationError {
  return new ValidationError("The request payload is invalid", issues);
}

function parseReason(reason: string): string {
  const normalized = reason.trim();
  if (!normalized) throw validationError([{ message: "A reason is required" }]);
  return normalized;
}

function toCandidateSummary(candidate: CandidateRecord): CandidateSummary {
  return {
    id: candidate.id,
    linkedUserId: candidate.linkedUserId,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    preferredName: candidate.preferredName,
    email: candidate.email,
    phone: candidate.phone,
    timezone: candidate.timezone,
    location: candidate.location,
    status: candidate.status,
    archivedAt: candidate.archivedAt?.toISOString() ?? null,
    archiveReason: candidate.archiveReason,
    createdAt: candidate.createdAt.toISOString(),
    updatedAt: candidate.updatedAt.toISOString(),
    version: candidate.version,
  };
}

function toProfileSummary(profile: ProfileRecord): ProfileSummary {
  return {
    id: profile.id,
    candidateId: profile.candidateId,
    name: profile.name,
    description: profile.description,
    status: profile.status,
    defaultCurrency: profile.defaultCurrency,
    targetCompensation: profile.targetCompensation?.toString() ?? null,
    compensationPeriod: profile.compensationPeriod,
    targetRoles: profile.targetRoles,
    preferredLocations: profile.preferredLocations,
    workplacePreferences: profile.workplacePreferences,
    jobTypePreferences: profile.jobTypePreferences,
    contractPreferences: profile.contractPreferences,
    archivedAt: profile.archivedAt?.toISOString() ?? null,
    archiveReason: profile.archiveReason,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
    version: profile.version,
  };
}

function toAssignmentSummary(assignment: AssignmentRecord): Assignment {
  return {
    id: assignment.id,
    profileId: assignment.profileId,
    userId: assignment.userId,
    assignedById: assignment.assignedById ?? assignment.setById ?? "",
    assignedAt: assignment.assignedAt.toISOString(),
    endedAt: assignment.endedAt?.toISOString() ?? null,
    endedReason: assignment.endedReason,
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return !!error && typeof error === "object" && (error as { code?: unknown }).code === "P2002";
}

function page<T>(items: T[], limit: number): Page<T> {
  const hasNextPage = items.length > limit;
  const results = hasNextPage ? items.slice(0, limit) : items;
  return { items: results, nextCursor: hasNextPage ? (results.at(-1) as { id: string }).id : null };
}

const profileTransitions: Record<ProfileStatus, readonly ProfileStatus[]> = {
  DRAFT: ["ACTIVE", "PAUSED", "ARCHIVED"],
  ACTIVE: ["PAUSED", "ARCHIVED"],
  PAUSED: ["ACTIVE", "ARCHIVED"],
  ARCHIVED: ["DRAFT"],
};

export class CandidatesService {
  constructor(
    private readonly database: CandidateProfileDatabase,
    private readonly authorization: AuthorizationService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async listCandidates(actor: Actor, query: CandidateListQuery): Promise<Page<CandidateSummary>> {
    this.requireAdmin(actor);
    const parsed = this.parseCandidateQuery(query);
    const candidates = await this.database.candidate.findMany({
      where: {
        ...(parsed.status ? { status: parsed.status } : {}),
        ...(parsed.search
          ? {
              OR: ["firstName", "lastName", "preferredName", "email", "phone", "location", "timezone"].map((field) => ({
              [field]: { contains: parsed.search, mode: "insensitive" },
            })),
          }
          : {}),
      },
      orderBy: { id: "asc" },
      ...(parsed.cursor ? { cursor: { id: parsed.cursor }, skip: 1 } : {}),
      take: parsed.limit + 1,
    });
    return page(candidates.map(toCandidateSummary), parsed.limit);
  }

  async createCandidate(actor: Actor, input: CreateCandidate): Promise<CandidateSummary> {
    this.requireAdmin(actor);
    const parsed = createCandidateSchema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error.issues);

    return this.database.$transaction(async (tx) => {
      const candidate = await tx.candidate.create({
        data: {
          linkedUserId: parsed.data.linkedUserId ?? null,
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          preferredName: parsed.data.preferredName ?? null,
          email: parsed.data.email ?? null,
          phone: parsed.data.phone ?? null,
          timezone: parsed.data.timezone,
          location: parsed.data.location ?? null,
          internalNotes: parsed.data.internalNotes ?? null,
        },
      });
      const summary = toCandidateSummary(candidate);
      await this.audit(tx, actor, "candidate.created", "candidate", candidate.id, null, null, summary);
      return summary;
    });
  }

  async getCandidate(actor: Actor, candidateId: string): Promise<CandidateDetail> {
    this.requireAdmin(actor);
    const candidate = await this.requireCandidate(candidateId);
    const profiles = await this.database.profile.findMany({
      where: { candidateId },
      orderBy: { id: "asc" },
    });
    return { ...toCandidateSummary(candidate), profiles: profiles.map(toProfileSummary) };
  }

  async updateCandidate(
    actor: Actor,
    candidateId: string,
    input: UpdateCandidate,
    expectedVersion: number,
  ): Promise<CandidateSummary> {
    this.requireAdmin(actor);
    const parsed = updateCandidateSchema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error.issues);
    const candidate = await this.requireCandidateVersion(candidateId, expectedVersion);

    return this.database.$transaction(async (tx) => {
      const result = await tx.candidate.updateMany({
        where: { id: candidateId, version: expectedVersion },
        data: { ...parsed.data, version: { increment: 1 } },
      });
      if (result.count === 0) throw await this.staleCandidate(candidateId, expectedVersion);
      const updated = await this.requireCandidate(candidateId);
      const summary = toCandidateSummary(updated);
      await this.audit(tx, actor, "candidate.updated", "candidate", candidateId, null, toCandidateSummary(candidate), summary);
      return summary;
    });
  }

  async archiveCandidate(
    actor: Actor,
    candidateId: string,
    reason: string,
    expectedVersion: number,
  ): Promise<CandidateSummary> {
    this.requireAdmin(actor);
    const archiveReason = parseReason(reason);
    const candidate = await this.requireCandidateVersion(candidateId, expectedVersion);
    if (candidate.status === "ARCHIVED") throw new ConflictError("The candidate is already archived");
    const archivedAt = this.now();

    return this.database.$transaction(async (tx) => {
      const result = await tx.candidate.updateMany({
        where: { id: candidateId, version: expectedVersion },
        data: { status: "ARCHIVED", archivedAt, archiveReason, archivedById: actor.id, version: { increment: 1 } },
      });
      if (result.count === 0) throw await this.staleCandidate(candidateId, expectedVersion);
      const archived = await this.requireCandidate(candidateId);
      const summary = toCandidateSummary(archived);
      await this.audit(tx, actor, "candidate.archived", "candidate", candidateId, null, toCandidateSummary(candidate), summary);
      return summary;
    });
  }

  async restoreCandidate(actor: Actor, candidateId: string, expectedVersion: number): Promise<CandidateSummary> {
    this.requireAdmin(actor);
    const candidate = await this.requireCandidateVersion(candidateId, expectedVersion);
    if (candidate.status !== "ARCHIVED") throw new ConflictError("The candidate is not archived");

    return this.database.$transaction(async (tx) => {
      const result = await tx.candidate.updateMany({
        where: { id: candidateId, version: expectedVersion },
        data: { status: "ACTIVE", archivedAt: null, archiveReason: null, archivedById: null, version: { increment: 1 } },
      });
      if (result.count === 0) throw await this.staleCandidate(candidateId, expectedVersion);
      const restored = await this.requireCandidate(candidateId);
      const summary = toCandidateSummary(restored);
      await this.audit(tx, actor, "candidate.restored", "candidate", candidateId, null, toCandidateSummary(candidate), summary);
      return summary;
    });
  }

  async listProfiles(actor: Actor, query: ProfileListQuery): Promise<Page<ProfileSummary>> {
    this.requireActive(actor);
    const parsed = this.parseProfileQuery(query);
    if (actor.role === "CLOSER") return { items: [], nextCursor: null };

    const profiles = await this.database.profile.findMany({
      where: {
        ...(parsed.candidateId ? { candidateId: parsed.candidateId } : {}),
        ...(parsed.status ? { status: parsed.status } : {}),
        ...(parsed.search ? {
          OR: [
            { name: { contains: parsed.search, mode: "insensitive" } },
            { description: { contains: parsed.search, mode: "insensitive" } },
            { candidate: { firstName: { contains: parsed.search, mode: "insensitive" } } },
            { candidate: { lastName: { contains: parsed.search, mode: "insensitive" } } },
            { candidate: { preferredName: { contains: parsed.search, mode: "insensitive" } } },
            { targetRoles: { has: parsed.search } },
            { preferredLocations: { has: parsed.search } },
          ],
        } : {}),
        ...(actor.role === "BD"
          ? { bdAssignments: { some: { userId: actor.id, endedAt: null } } }
          : {}),
      },
      orderBy: { id: "asc" },
      ...(parsed.cursor ? { cursor: { id: parsed.cursor }, skip: 1 } : {}),
      take: parsed.limit + 1,
    });
    return page(profiles.map(toProfileSummary), parsed.limit);
  }

  async createProfile(actor: Actor, input: CreateProfile): Promise<ProfileSummary> {
    this.requireAdmin(actor);
    const parsed = createProfileSchema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error.issues);
    const candidate = await this.requireCandidate(parsed.data.candidateId);
    if (candidate.status === "ARCHIVED") throw new ConflictError("Archived candidates cannot receive profiles");

    return this.database.$transaction(async (tx) => {
      const profile = await tx.profile.create({
        data: {
          candidateId: parsed.data.candidateId,
          createdById: actor.id,
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          defaultCurrency: parsed.data.defaultCurrency ?? "USD",
          targetCompensation: parsed.data.targetCompensation ?? null,
          compensationPeriod: parsed.data.compensationPeriod ?? null,
          targetRoles: parsed.data.targetRoles ?? [],
          preferredLocations: parsed.data.preferredLocations ?? [],
          workplacePreferences: parsed.data.workplacePreferences ?? [],
          jobTypePreferences: parsed.data.jobTypePreferences ?? [],
          contractPreferences: parsed.data.contractPreferences ?? [],
        },
      });
      const summary = toProfileSummary(profile);
      await this.audit(tx, actor, "profile.created", "profile", profile.id, profile.id, null, summary);
      return summary;
    });
  }

  async getProfile(actor: Actor, profileId: string): Promise<ProfileDetail> {
    await this.authorization.assertProfileAccess(actor, profileId);
    const profile = await this.requireProfile(profileId);
    if (profile.status === "ARCHIVED" && actor.role !== "ADMIN") {
      throw new AuthorizationError();
    }
    const candidate = await this.requireCandidate(profile.candidateId);
    return {
      ...toProfileSummary(profile),
      candidate: {
        id: candidate.id,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        preferredName: candidate.preferredName,
        timezone: candidate.timezone,
      },
    };
  }

  async updateProfile(
    actor: Actor,
    profileId: string,
    input: UpdateProfile,
    expectedVersion: number,
  ): Promise<ProfileSummary> {
    this.requireActive(actor);
    this.authorization.assertRole(actor, ["ADMIN", "BD"]);
    await this.authorization.assertProfileAccess(actor, profileId);
    const parsed = updateProfileSchema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error.issues);
    const profile = await this.requireProfileVersion(profileId, expectedVersion);
    if (profile.status === "ARCHIVED") throw new ConflictError("Archived profiles cannot be updated");

    return this.database.$transaction(async (tx) => {
      const result = await tx.profile.updateMany({
        where: { id: profileId, version: expectedVersion },
        data: { ...parsed.data, version: { increment: 1 } },
      });
      if (result.count === 0) throw await this.staleProfile(profileId, expectedVersion);
      const updated = await this.requireProfile(profileId);
      const summary = toProfileSummary(updated);
      await this.audit(tx, actor, "profile.updated", "profile", profileId, profileId, toProfileSummary(profile), summary);
      return summary;
    });
  }

  async transitionProfile(
    actor: Actor,
    profileId: string,
    status: ProfileStatus,
    reason: string | null,
    expectedVersion: number,
  ): Promise<ProfileSummary> {
    this.requireAdmin(actor);
    const profile = await this.requireProfileVersion(profileId, expectedVersion);
    if (!profileTransitions[profile.status].includes(status)) {
      throw new ConflictError("The requested profile status transition is not allowed");
    }
    const archivedAt = status === "ARCHIVED" ? this.now() : null;
    const archiveReason = status === "ARCHIVED" ? parseReason(reason ?? "") : null;
    const action = profile.status === "ARCHIVED" && status === "DRAFT"
      ? "profile.restored"
      : `profile.${status.toLowerCase()}`;

    return this.database.$transaction(async (tx) => {
      const result = await tx.profile.updateMany({
        where: { id: profileId, version: expectedVersion },
        data: {
          status,
          archivedAt,
          archiveReason,
          archivedById: status === "ARCHIVED" ? actor.id : null,
          version: { increment: 1 },
        },
      });
      if (result.count === 0) throw await this.staleProfile(profileId, expectedVersion);
      const updated = await this.requireProfile(profileId);
      const summary = toProfileSummary(updated);
      await this.audit(tx, actor, action, "profile", profileId, profileId, toProfileSummary(profile), summary, reason ? { reason: reason.trim() } : null);
      return summary;
    });
  }

  async listBdAssignments(actor: Actor, profileId: string): Promise<Assignment[]> {
    await this.authorization.assertProfileAccess(actor, profileId);
    await this.requireProfile(profileId);
    const assignments = await this.database.profileBdAssignment.findMany({
      where: { profileId },
      orderBy: { assignedAt: "desc" },
    });
    return assignments.map(toAssignmentSummary);
  }

  async assignBd(actor: Actor, profileId: string, userId: string): Promise<Assignment> {
    this.requireAdmin(actor);
    const assignmentInput = assignProfileBdSchema.safeParse({ profileId, userId });
    if (!assignmentInput.success) throw validationError(assignmentInput.error.issues);
    const profile = await this.requireProfile(assignmentInput.data.profileId);
    this.assertAssignableProfile(profile);
    await this.requireAssignableUser(assignmentInput.data.userId, "BD");
    const existing = await this.database.profileBdAssignment.findFirst({
      where: { profileId: assignmentInput.data.profileId, userId: assignmentInput.data.userId, endedAt: null },
    });
    if (existing) throw new ConflictError("The BD is already assigned to this profile");

    try {
      return await this.database.$transaction(async (tx) => {
        const assignment = await tx.profileBdAssignment.create({
          data: { profileId: assignmentInput.data.profileId, userId: assignmentInput.data.userId, assignedById: actor.id },
        });
        const summary = toAssignmentSummary(assignment);
        await this.audit(tx, actor, "profile.bd_assigned", "profile_bd_assignment", assignment.id, profileId, null, summary);
        return summary;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) throw new ConflictError("The BD is already assigned to this profile");
      throw error;
    }
  }

  async endBdAssignment(actor: Actor, profileId: string, assignmentId: string, reason: string): Promise<void> {
    this.requireAdmin(actor);
    const endedReason = parseReason(reason);
    await this.requireProfile(profileId);
    const assignment = await this.requireActiveBdAssignment(profileId, assignmentId);
    const endedAt = this.now();

    await this.database.$transaction(async (tx) => {
      const result = await tx.profileBdAssignment.updateMany({
        where: { id: assignmentId, profileId, endedAt: null },
        data: { endedAt, endedReason },
      });
      if (result.count === 0) throw new ConflictError("The BD assignment is no longer active");
      await this.audit(tx, actor, "profile.bd_assignment_ended", "profile_bd_assignment", assignmentId, profileId, toAssignmentSummary(assignment), { ...toAssignmentSummary(assignment), endedAt: endedAt.toISOString(), endedReason });
    });
  }

  async listCloserEligibility(actor: Actor, profileId: string): Promise<Assignment[]> {
    await this.authorization.assertProfileAccess(actor, profileId);
    await this.requireProfile(profileId);
    const assignments = await this.database.profileCloserEligibility.findMany({
      where: { profileId },
      orderBy: { assignedAt: "desc" },
    });
    return assignments.map(toAssignmentSummary);
  }

  async setCloserEligibility(actor: Actor, profileId: string, userId: string): Promise<Assignment> {
    this.requireAdmin(actor);
    const eligibilityInput = profileCloserEligibilitySchema.safeParse({ profileId, userId, isEligible: true });
    if (!eligibilityInput.success) throw validationError(eligibilityInput.error.issues);
    const profile = await this.requireProfile(eligibilityInput.data.profileId);
    this.assertAssignableProfile(profile);
    await this.requireAssignableUser(eligibilityInput.data.userId, "CLOSER");
    const existing = await this.database.profileCloserEligibility.findFirst({
      where: {
        profileId: eligibilityInput.data.profileId,
        userId: eligibilityInput.data.userId,
        isEligible: true,
        endedAt: null,
      },
    });
    if (existing) throw new ConflictError("The Closer is already eligible for this profile");

    try {
      return await this.database.$transaction(async (tx) => {
        const assignment = await tx.profileCloserEligibility.create({
          data: {
            profileId: eligibilityInput.data.profileId,
            userId: eligibilityInput.data.userId,
            setById: actor.id,
            isEligible: true,
          },
        });
        const summary = toAssignmentSummary(assignment);
        await this.audit(tx, actor, "profile.closer_eligibility_set", "profile_closer_eligibility", assignment.id, profileId, null, summary);
        return summary;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) throw new ConflictError("The Closer is already eligible for this profile");
      throw error;
    }
  }

  async endCloserEligibility(actor: Actor, profileId: string, assignmentId: string, reason: string): Promise<void> {
    this.requireAdmin(actor);
    const endedReason = parseReason(reason);
    await this.requireProfile(profileId);
    const assignment = await this.requireActiveCloserEligibility(profileId, assignmentId);
    const endedAt = this.now();

    await this.database.$transaction(async (tx) => {
      const result = await tx.profileCloserEligibility.updateMany({
        where: { id: assignmentId, profileId, isEligible: true, endedAt: null },
        data: { endedAt, endedReason },
      });
      if (result.count === 0) throw new ConflictError("The Closer eligibility is no longer active");
      await this.audit(tx, actor, "profile.closer_eligibility_ended", "profile_closer_eligibility", assignmentId, profileId, toAssignmentSummary(assignment), { ...toAssignmentSummary(assignment), endedAt: endedAt.toISOString(), endedReason });
    });
  }

  private requireAdmin(actor: Actor): void {
    this.authorization.assertRole(actor, ["ADMIN"]);
  }

  private requireActive(actor: Actor): void {
    if (!actor.isActive) throw new AuthorizationError();
  }

  private async requireCandidate(candidateId: string): Promise<CandidateRecord> {
    const candidate = await this.database.candidate.findUnique({ where: { id: candidateId } });
    if (!candidate) throw new NotFoundError("The requested candidate was not found");
    return candidate;
  }

  private async requireCandidateVersion(candidateId: string, expectedVersion: number): Promise<CandidateRecord> {
    const candidate = await this.requireCandidate(candidateId);
    if (candidate.version !== expectedVersion) throw new StaleVersionError(expectedVersion, candidate.version);
    return candidate;
  }

  private async staleCandidate(candidateId: string, expectedVersion: number): Promise<StaleVersionError | NotFoundError> {
    const candidate = await this.database.candidate.findUnique({ where: { id: candidateId } });
    return candidate ? new StaleVersionError(expectedVersion, candidate.version) : new NotFoundError("The requested candidate was not found");
  }

  private async requireProfile(profileId: string): Promise<ProfileRecord> {
    const profile = await this.database.profile.findUnique({ where: { id: profileId } });
    if (!profile) throw new NotFoundError("The requested profile was not found");
    return profile;
  }

  private async requireProfileVersion(profileId: string, expectedVersion: number): Promise<ProfileRecord> {
    const profile = await this.requireProfile(profileId);
    if (profile.version !== expectedVersion) throw new StaleVersionError(expectedVersion, profile.version);
    return profile;
  }

  private async staleProfile(profileId: string, expectedVersion: number): Promise<StaleVersionError | NotFoundError> {
    const profile = await this.database.profile.findUnique({ where: { id: profileId } });
    return profile ? new StaleVersionError(expectedVersion, profile.version) : new NotFoundError("The requested profile was not found");
  }

  private assertAssignableProfile(profile: ProfileRecord): void {
    if (profile.status === "ARCHIVED") throw new ConflictError("Archived profiles cannot receive assignments");
  }

  private async requireAssignableUser(userId: string, role: Actor["role"]): Promise<void> {
    const user = await this.database.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError("The requested user was not found");
    if (!user.isActive || user.role !== role) throw new ValidationError("The selected user is not an active matching-role user");
  }

  private async requireActiveBdAssignment(profileId: string, assignmentId: string): Promise<AssignmentRecord> {
    const assignment = await this.database.profileBdAssignment.findFirst({ where: { id: assignmentId, profileId, endedAt: null } });
    if (!assignment) throw new NotFoundError("The requested BD assignment was not found");
    return assignment;
  }

  private async requireActiveCloserEligibility(profileId: string, assignmentId: string): Promise<AssignmentRecord> {
    const assignment = await this.database.profileCloserEligibility.findFirst({ where: { id: assignmentId, profileId, isEligible: true, endedAt: null } });
    if (!assignment) throw new NotFoundError("The requested Closer eligibility was not found");
    return assignment;
  }

  private parseCandidateQuery(query: CandidateListQuery): CandidateListQuery {
    const parsed = candidateListQuerySchema.safeParse(query);
    if (!parsed.success) throw validationError(parsed.error.issues);
    return parsed.data;
  }

  private parseProfileQuery(query: ProfileListQuery): ProfileListQuery {
    const parsed = profileListQuerySchema.safeParse(query);
    if (!parsed.success) throw validationError(parsed.error.issues);
    return parsed.data;
  }

  private async audit(
    transaction: CandidateProfileTransaction,
    actor: Actor,
    action: string,
    entityType: string,
    entityId: string,
    profileId: string | null,
    oldSnapshot: Record<string, unknown> | null,
    newSnapshot: Record<string, unknown>,
    metadata: Record<string, unknown> | null = null,
  ): Promise<void> {
    await transaction.activityEvent.create({
      data: {
        action,
        actorId: actor.id,
        actorNameSnapshot: actor.displayName,
        actorRoleSnapshot: actor.role,
        entityId,
        entityType,
        profileId,
        metadata,
        oldSnapshot,
        newSnapshot,
        requestId: null,
      },
    });
  }
}
