import {
  archiveLeadSchema,
  assignLeadCloserRequestSchema,
  companyListQuerySchema,
  contactListQuerySchema,
  createCompanySchema,
  createContactSchema,
  createLeadSchema,
  createApplicationIntakeSchema,
  leadListQuerySchema,
  leadStatusTransitionSchema,
  restoreLeadSchema,
  setLeadImportantSchema,
  transferLeadOwnershipSchema,
  updateLeadSchema,
  updateCompanySchema,
  updateContactSchema,
  type CompanyListQuery,
  type ContactListQuery,
  type CreateCompany,
  type CreateContact,
  type CreateLead,
  type CreateApplicationIntake,
  type ApplicationIntakeResult,
  type LeadListQuery,
  type LeadStatus,
  type LeadSummary,
  type UpdateLead,
  type UpdateCompany,
  type UpdateContact,
  type CompanyCloserAssignment,
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
import { addBusinessHours } from "../performance/business-hours";

type Store = {
  findMany(args?: unknown): Promise<ReadonlyArray<Record<string, unknown>>>;
  findUnique(args: unknown): Promise<Record<string, unknown> | null>;
  findFirst(args: unknown): Promise<Record<string, unknown> | null>;
  create(args: { data: Record<string, unknown>; include?: unknown }): Promise<Record<string, unknown>>;
  updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
  deleteMany?(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
  update?(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<Record<string, unknown>>;
  delete?(args: { where: Record<string, unknown> }): Promise<Record<string, unknown>>;
};
type LeadTransaction = { [key: string]: Store };
type ActivityEventStore = Store;
export type LeadsDatabase = LeadTransaction & { activityEvent: ActivityEventStore; $transaction<T>(work: (tx: LeadTransaction) => Promise<T>): Promise<T> };
export type LeadPage<T> = { items: T[]; nextCursor: string | null };

const statusTransitions: Record<LeadStatus, readonly LeadStatus[]> = {
  APPLIED: ["RESPONSE_RECEIVED", "CLOSED"],
  RESPONSE_RECEIVED: ["INTERVIEWING", "CLOSED"],
  INTERVIEWING: ["OFFER_RECEIVED", "CLOSED"],
  OFFER_RECEIVED: ["OFFER_ACCEPTED", "CLOSED"],
  OFFER_ACCEPTED: ["PLACED", "CLOSED"],
  PLACED: ["STARTED", "CLOSED"],
  STARTED: ["CLOSED"],
  CLOSED: [],
};

const pipelineStageStatuses = {
  ACTIVE: ["RESPONSE_RECEIVED", "INTERVIEWING", "OFFER_RECEIVED", "OFFER_ACCEPTED", "PLACED"],
  INTERVIEW: ["INTERVIEWING", "OFFER_RECEIVED", "OFFER_ACCEPTED", "PLACED", "STARTED"],
  OFFER: ["OFFER_RECEIVED", "OFFER_ACCEPTED", "PLACED", "STARTED"],
  PLACEMENT: ["PLACED", "STARTED"],
} as const;

function pipelineStageWhere(stage: NonNullable<LeadListQuery["pipelineStage"]>): Record<string, unknown> {
  if (stage === "APPLIED") return {};
  const statuses = [...pipelineStageStatuses[stage]];
  if (stage === "ACTIVE") return { status: { in: statuses } };
  return {
    OR: [
      { status: { in: statuses } },
      { statusTransitions: { some: { toStatus: { in: statuses } } } },
      ...(stage === "INTERVIEW" ? [{ interviews: { some: {} } }] : []),
    ],
  };
}

const linkedInTrackingParameters = new Set([
  "trk",
  "trackingid",
  "refid",
  "lipi",
  "midtoken",
  "ebp",
  "recommendation",
  "alternatechannel",
  "origin",
]);

export type ApplicationDuplicateClassification = "NONE" | "LIKELY" | "CONFIRMED";

export type ApplicationDuplicateInput = {
  profileId: string;
  companyId: string;
  jobTitle: string;
  normalizedJobUrl: string;
};

export function normalizeJobUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  const isLinkedIn = url.hostname === "linkedin.com" || url.hostname.endsWith(".linkedin.com");

  for (const key of [...url.searchParams.keys()]) {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey.startsWith("utm_") || (isLinkedIn && linkedInTrackingParameters.has(normalizedKey))) {
      url.searchParams.delete(key);
    }
  }

  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.toString();
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function lookbackStart(now: Date, months: number): Date {
  const rawMonth = now.getUTCMonth() - months;
  const year = now.getUTCFullYear() + Math.floor(rawMonth / 12);
  const month = ((rawMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(now.getUTCDate(), lastDay)));
}

function invalid(issues: unknown): ValidationError {
  return new ValidationError("The request payload is invalid", issues);
}
function page<T>(items: T[], limit: number): LeadPage<T> {
  const next = items.length > limit ? items.slice(0, limit) : items;
  return { items: next, nextCursor: items.length > limit ? String((next.at(-1) as { id: string }).id) : null };
}
function dateValue(value: unknown): string | null {
  return value instanceof Date ? value.toISOString() : typeof value === "string" ? value : null;
}
function dateOnly(value: unknown): string | null {
  const iso = dateValue(value);
  return iso ? iso.slice(0, 10) : null;
}
function summary(record: Record<string, unknown>): LeadSummary {
  return {
    id: String(record.id), profileId: String(record.profileId), companyId: String(record.companyId),
    sourceId: String(record.sourceId), createdById: String(record.createdById), currentOwnerId: String(record.currentOwnerId),
    responsibleCloserId: (record.responsibleCloserId as string | null) ?? null,
    archivedById: (record.archivedById as string | null) ?? null, closedById: (record.closedById as string | null) ?? null,
    jobTitle: String(record.jobTitle), companyName: typeof record.companyName === "string" ? record.companyName : undefined, description: (record.description as string | null) ?? null,
    rawUrl: String(record.rawUrl), canonicalUrl: (record.canonicalUrl as string | null) ?? null,
    canonicalHash: (record.canonicalHash as string | null) ?? null, location: (record.location as string | null) ?? null,
    workplaceType: (record.workplaceType as string | null) ?? null, employmentType: (record.employmentType as string | null) ?? null,
    contractType: (record.contractType as string | null) ?? null,
    compensationMin: record.compensationMin == null ? null : String(record.compensationMin),
    compensationMax: record.compensationMax == null ? null : String(record.compensationMax),
    compensationCurrency: (record.compensationCurrency as string | null) ?? null,
    compensationPeriod: (record.compensationPeriod as LeadSummary["compensationPeriod"]) ?? null,
    appliedDate: dateOnly(record.appliedDate) ?? "1970-01-01", status: record.status as LeadStatus,
    isImportant: Boolean(record.isImportant), closureReason: (record.closureReason as string | null) ?? null,
    closureNotes: (record.closureNotes as string | null) ?? null, closedAt: dateValue(record.closedAt),
    placedAt: dateValue(record.placedAt), startDate: dateOnly(record.startDate), startedAt: dateValue(record.startedAt),
    archivedAt: dateValue(record.archivedAt), archiveReason: (record.archiveReason as string | null) ?? null,
    createdAt: dateValue(record.createdAt) ?? new Date(0).toISOString(), updatedAt: dateValue(record.updatedAt) ?? new Date(0).toISOString(),
    version: Number(record.version),
  };
}
function companySummary(record: Record<string, unknown>) {
  return { id: String(record.id), canonicalName: String(record.canonicalName), website: (record.website as string | null) ?? null, domain: (record.domain as string | null) ?? null, industry: (record.industry as string | null) ?? null, location: (record.location as string | null) ?? null, createdAt: dateValue(record.createdAt) ?? new Date(0).toISOString(), updatedAt: dateValue(record.updatedAt) ?? new Date(0).toISOString(), version: Number(record.version) };
}
function contactSummary(record: Record<string, unknown>) {
  return { id: String(record.id), companyId: String(record.companyId), name: String(record.name), title: (record.title as string | null) ?? null, email: (record.email as string | null) ?? null, phone: (record.phone as string | null) ?? null, linkedinUrl: (record.linkedinUrl as string | null) ?? null, notes: (record.notes as string | null) ?? null, createdAt: dateValue(record.createdAt) ?? new Date(0).toISOString(), updatedAt: dateValue(record.updatedAt) ?? new Date(0).toISOString(), version: Number(record.version) };
}
function closerAssignment(record: Record<string, unknown>): CompanyCloserAssignment {
  const closer = record.closer as Record<string, unknown>;
  return {
    id: String(record.id), companyId: String(record.companyId), userId: String(record.userId), assignedById: String(record.assignedById),
    assignedAt: dateValue(record.assignedAt) ?? new Date(0).toISOString(), endedAt: dateValue(record.endedAt),
    closer: { id: String(closer.id), displayName: String(closer.displayName), email: String(closer.email), role: "CLOSER", isActive: Boolean(closer.isActive), timezone: String(closer.timezone ?? "UTC"), lastLoginAt: dateValue(closer.lastLoginAt) },
  };
}

export class LeadsService {
  constructor(private readonly database: LeadsDatabase, private readonly authorization: AuthorizationService, private readonly now = () => new Date()) {}

  async listCompanies(actor: Actor, query: CompanyListQuery) {
    if (!actor.isActive) throw new AuthorizationError(); const parsed = companyListQuerySchema.safeParse(query); if (!parsed.success) throw invalid(parsed.error.issues);
    const rows = await this.database.company.findMany({ where: parsed.data.search ? { canonicalName: { contains: parsed.data.search, mode: "insensitive" } } : {}, orderBy: { canonicalName: "asc" }, take: parsed.data.limit + 1 });
    return page(rows.map(companySummary), parsed.data.limit);
  }

  async createCompany(actor: Actor, input: CreateCompany) {
    this.authorization.assertRole(actor, ["ADMIN"]); const parsed = createCompanySchema.safeParse(input); if (!parsed.success) throw invalid(parsed.error.issues);
    try { const created = await this.database.company.create({ data: { ...parsed.data, createdById: actor.id } }); await this.auditRecord(actor, "company.created", "company", String(created.id), null, null, { canonicalName: created.canonicalName }); return companySummary(created); } catch (error) { if (typeof error === "object" && error && "code" in error && (error as { code: string }).code === "P2002") throw new ConflictError("A company with this name already exists"); throw error; }
  }

  async updateCompany(actor: Actor, id: string, input: UpdateCompany, expectedVersion: number) {
    this.authorization.assertRole(actor, ["ADMIN"]); const parsed = updateCompanySchema.safeParse(input); if (!parsed.success) throw invalid(parsed.error.issues);
    const result = await this.database.company.updateMany({ where: { id, version: expectedVersion }, data: { ...parsed.data, version: { increment: 1 } } }); if (!result.count) throw await this.staleCompany(id, expectedVersion); const updated = await this.requireCompany(id); await this.auditRecord(actor, "company.updated", "company", id, null, null, parsed.data as Record<string, unknown>); return companySummary(updated);
  }

  async listCompanyClosers(actor: Actor, companyId: string): Promise<CompanyCloserAssignment[]> {
    if (!actor.isActive) throw new AuthorizationError(); await this.requireCompany(companyId);
    const rows = await this.database.companyCloserAssignment.findMany({ where: { companyId, endedAt: null }, include: { closer: true }, orderBy: { assignedAt: "asc" } });
    return rows.map((row) => closerAssignment(row));
  }

  async assignCompanyCloser(actor: Actor, companyId: string, closerId: string): Promise<CompanyCloserAssignment> {
    this.authorization.assertRole(actor, ["ADMIN"]); await this.requireCompany(companyId);
    const closer = await this.database.user.findUnique({ where: { id: closerId } });
    if (!closer || closer.role !== "CLOSER" || !closer.isActive) throw new ValidationError("The selected user is not an active Closer");
    const existing = await this.database.companyCloserAssignment.findUnique({ where: { companyId_userId: { companyId, userId: closerId } } });
    const row = existing
      ? await this.database.companyCloserAssignment.update!({ where: { id: existing.id }, data: { endedAt: null } })
      : await this.database.companyCloserAssignment.create({ data: { companyId, userId: closerId, assignedById: actor.id } });
    const hydrated = await this.database.companyCloserAssignment.findUnique({ where: { id: row.id }, include: { closer: true } });
    if (!hydrated) throw new NotFoundError("The client closer assignment was not found"); return closerAssignment(hydrated);
  }

  async removeCompanyCloser(actor: Actor, companyId: string, closerId: string): Promise<void> {
    this.authorization.assertRole(actor, ["ADMIN"]); await this.requireCompany(companyId);
    await this.database.companyCloserAssignment.updateMany({ where: { companyId, userId: closerId, endedAt: null }, data: { endedAt: this.now() } });
  }

  async listContacts(actor: Actor, query: ContactListQuery) {
    if (!actor.isActive) throw new AuthorizationError(); const parsed = contactListQuerySchema.safeParse(query); if (!parsed.success) throw invalid(parsed.error.issues);
    const rows = await this.database.contact.findMany({ where: { companyId: parsed.data.companyId, ...(parsed.data.search ? { name: { contains: parsed.data.search, mode: "insensitive" } } : {}) }, orderBy: { name: "asc" }, take: parsed.data.limit + 1 });
    return page(rows.map(contactSummary), parsed.data.limit);
  }

  async createContact(actor: Actor, input: CreateContact) {
    if (!actor.isActive || actor.role === "CLOSER") throw new AuthorizationError(); const parsed = createContactSchema.safeParse(input); if (!parsed.success) throw invalid(parsed.error.issues); await this.requireCompany(parsed.data.companyId);
    const created = await this.database.contact.create({ data: { ...parsed.data, createdById: actor.id } }); await this.auditRecord(actor, "contact.created", "contact", String(created.id), null, null, { name: created.name, companyId: created.companyId }); return contactSummary(created);
  }

  async updateContact(actor: Actor, id: string, input: UpdateContact, expectedVersion: number) {
    if (!actor.isActive || actor.role === "CLOSER") throw new AuthorizationError(); const parsed = updateContactSchema.safeParse(input); if (!parsed.success) throw invalid(parsed.error.issues);
    const result = await this.database.contact.updateMany({ where: { id, version: expectedVersion }, data: { ...parsed.data, version: { increment: 1 } } }); if (!result.count) throw await this.staleContact(id, expectedVersion); const updated = await this.requireContact(id); await this.auditRecord(actor, "contact.updated", "contact", id, null, null, { ...parsed.data, companyId: String(updated.companyId) } as Record<string, unknown>); return contactSummary(updated);
  }

  async list(actor: Actor, query: LeadListQuery): Promise<LeadPage<LeadSummary>> {
    if (!actor.isActive) throw new AuthorizationError();
    const parsed = leadListQuerySchema.safeParse(query); if (!parsed.success) throw invalid(parsed.error.issues);
    const q = parsed.data;
    if (q.profileId) await this.authorization.assertProfileAccess(actor, q.profileId);
    const rows = await this.database.jobLead.findMany({
      where: {
        ...(q.profileId ? { profileId: q.profileId } : {}), ...(q.companyId ? { companyId: q.companyId } : {}),
        ...(q.sourceId ? { sourceId: q.sourceId } : {}), ...(q.status ? { status: q.status } : {}),
        ...(q.pipelineStage ? pipelineStageWhere(q.pipelineStage) : {}),
        ...(actor.role === "BD" && q.pipelineStage ? { createdById: actor.id } : {}),
        ...(q.ownerId ? { currentOwnerId: q.ownerId } : {}), ...(q.closerId ? { responsibleCloserId: q.closerId } : {}),
        ...(q.important === undefined ? {} : { isImportant: q.important }), archivedAt: q.archived ? { not: null } : null,
        ...(q.search ? { OR: [{ jobTitle: { contains: q.search, mode: "insensitive" } }, { companyName: { contains: q.search, mode: "insensitive" } }] } : {}),
      }, orderBy: [{ appliedDate: "desc" }, { id: "asc" }], ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}), take: q.limit + 1,
    });
    const visible = actor.role === "BD"
      ? rows.filter((row) => q.pipelineStage ? row.createdById === actor.id : row.currentOwnerId === actor.id)
      : actor.role === "CLOSER"
        ? rows.filter((row) => row.responsibleCloserId === actor.id)
        : rows;
    return page(visible.map((row) => summary(row)), q.limit);
  }

  async get(actor: Actor, id: string): Promise<LeadSummary & { company: Record<string, unknown>; contacts: ReadonlyArray<Record<string, unknown>> }> {
    const lead = await this.requireLead(id); await this.authorization.assertProfileAccess(actor, String(lead.profileId));
    if (actor.role === "CLOSER" && lead.responsibleCloserId !== actor.id) throw new AuthorizationError();
    if (actor.role === "BD" && lead.currentOwnerId !== actor.id) throw new AuthorizationError();
    const result = await this.database.jobLead.findUnique({ where: { id }, include: { company: true, contacts: { include: { contact: true } } } });
    if (!result) throw new NotFoundError("The requested lead was not found");
    const contacts = Array.isArray(result.contacts)
      ? result.contacts.map((leadContact) => ({
          id: String(leadContact.id),
          leadId: String(leadContact.leadId),
          contactId: String(leadContact.contactId),
          role: leadContact.role,
          isPrimary: Boolean(leadContact.isPrimary),
          createdAt: dateValue(leadContact.createdAt) ?? new Date(0).toISOString(),
          contact: contactSummary(leadContact.contact as Record<string, unknown>),
        }))
      : [];
    return { ...summary(result), company: companySummary((result.company as Record<string, unknown>) ?? {}), contacts };
  }

  async create(actor: Actor, input: CreateLead): Promise<LeadSummary> {
    if (!actor.isActive || actor.role !== "ADMIN") throw new AuthorizationError();
    const parsed = createLeadSchema.safeParse(input); if (!parsed.success) throw invalid(parsed.error.issues);
    await this.authorization.assertProfileAccess(actor, parsed.data.profileId);
    const company = await this.database.company.findUnique({ where: { id: parsed.data.companyId } });
    const source = await this.database.jobSource.findUnique({ where: { id: parsed.data.sourceId } });
    if (!company || !source) throw new NotFoundError("The company or source was not found");
    try {
      const created = await this.database.jobLead.create({ data: { ...parsed.data, companyName: String(company.canonicalName), createdById: actor.id, appliedDate: new Date(`${parsed.data.appliedDate}T00:00:00.000Z`), canonicalUrl: parsed.data.rawUrl, canonicalHash: parsed.data.rawUrl.toLowerCase() } });
      await this.audit(actor, created, "lead.created", { status: created.status, jobTitle: created.jobTitle });
      return summary(created);
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && (error as { code: string }).code === "P2002") throw new ConflictError("An active lead with this URL already exists for the profile");
      throw error;
    }
  }

  async classifyApplicationDuplicate(
    input: ApplicationDuplicateInput,
    lookbackMonths = 6,
    database: LeadTransaction = this.database,
  ): Promise<ApplicationDuplicateClassification> {
    const saved = await database.jobLead.findMany({
      where: {
        profileId: input.profileId,
        appliedDate: { gte: lookbackStart(this.now(), lookbackMonths) },
      },
    });
    const confirmed = saved.some((lead) => {
      const existingUrl = typeof lead.canonicalUrl === "string" ? lead.canonicalUrl : lead.rawUrl;
      if (typeof existingUrl !== "string") return false;
      try {
        return normalizeJobUrl(existingUrl) === input.normalizedJobUrl;
      } catch {
        return false;
      }
    });
    if (confirmed) return "CONFIRMED";

    return saved.some((lead) =>
      lead.companyId === input.companyId &&
      typeof lead.jobTitle === "string" &&
      normalizeText(lead.jobTitle) === normalizeText(input.jobTitle),
    )
      ? "LIKELY"
      : "NONE";
  }

  async createApplicationIntake(actor: Actor, input: CreateApplicationIntake): Promise<ApplicationIntakeResult> {
    if (!actor.isActive || actor.role !== "BD") throw new AuthorizationError();
    const parsed = createApplicationIntakeSchema.safeParse(input); if (!parsed.success) throw invalid(parsed.error.issues);
    await this.authorization.assertProfileAccess(actor, parsed.data.profileId);
    const canonicalUrl = normalizeJobUrl(parsed.data.rawUrl);
    const appliedDate = this.now();
    return this.database.$transaction(async (transaction) => {
      const existingCompany = await transaction.company.findUnique({ where: { canonicalName: parsed.data.companyName } });
      const lookbackMonths = await this.effectiveDuplicateLookbackMonths(transaction, appliedDate);
      const duplicate = await this.classifyApplicationDuplicate({
        profileId: parsed.data.profileId,
        companyId: existingCompany ? String(existingCompany.id) : "",
        jobTitle: parsed.data.jobTitle,
        normalizedJobUrl: canonicalUrl,
      }, lookbackMonths, transaction);
      if (duplicate === "LIKELY" && !parsed.data.duplicateOverrideReason) {
        throw new ConflictError("This application looks like a likely duplicate. Add an override reason to save it.", {
          duplicate: { classification: "LIKELY", requiresOverride: true },
        });
      }
      const company = existingCompany ?? await transaction.company.create({ data: { canonicalName: parsed.data.companyName, createdById: actor.id } });
      const sourceName = new URL(canonicalUrl).hostname.replace(/^www\./, "");
      const source = await transaction.jobSource.findUnique({ where: { name: sourceName } }) ?? await transaction.jobSource.create({ data: { name: sourceName } });
      const qualifiedCredit = duplicate !== "CONFIRMED";
      const created = await transaction.jobLead.create({ data: { profileId: parsed.data.profileId, companyId: String(company.id), sourceId: String(source.id), createdById: actor.id, currentOwnerId: actor.id, companyName: String(company.canonicalName), jobTitle: parsed.data.jobTitle, rawUrl: parsed.data.rawUrl, appliedDate: new Date(`${appliedDate.toISOString().slice(0, 10)}T00:00:00.000Z`), canonicalUrl, canonicalHash: canonicalUrl.toLowerCase(), duplicateClassification: duplicate, qualifiedCredit } });
      const contact = await transaction.contact.findFirst({ where: { companyId: String(company.id), email: parsed.data.recruiterEmail } }) ?? await transaction.contact.create({ data: { companyId: String(company.id), createdById: actor.id, name: parsed.data.recruiterName, email: parsed.data.recruiterEmail } });
      await transaction.leadContact.create({ data: { leadId: String(created.id), contactId: String(contact.id), role: "RECRUITER", isPrimary: true } });
      const review = duplicate === "LIKELY"
        ? await transaction.duplicateReview.create({ data: {
          leadId: String(created.id), classification: "LIKELY", status: "PENDING",
          overrideReason: parsed.data.duplicateOverrideReason!, provisionalCreditGranted: true,
          expiresAt: await this.duplicateReviewDueAt(transaction, appliedDate), createdById: actor.id,
        } })
        : null;
      if (duplicate !== "NONE") {
        await this.audit(actor, created, "lead.duplicate_detected", { classification: duplicate, normalizedJobUrl: canonicalUrl, qualifiedCredit, reviewId: review ? String(review.id) : null }, transaction);
      }
      await this.audit(actor, created, "lead.created", { status: created.status, jobTitle: created.jobTitle, duplicateClassification: duplicate, qualifiedCredit }, transaction);
      return { lead: summary(created), duplicate: { classification: duplicate, qualifiedCredit, reviewId: review ? String(review.id) : null } };
    });
  }

  async update(actor: Actor, id: string, input: UpdateLead, expectedVersion: number): Promise<LeadSummary> {
    const lead = await this.requireLead(id); await this.assertEditor(actor, lead);
    const parsed = updateLeadSchema.safeParse(input); if (!parsed.success) throw invalid(parsed.error.issues);
    const result = await this.database.jobLead.updateMany({ where: { id, version: expectedVersion }, data: { ...parsed.data, ...(parsed.data.appliedDate ? { appliedDate: new Date(`${parsed.data.appliedDate}T00:00:00.000Z`) } : {}), version: { increment: 1 } } });
    if (!result.count) throw await this.stale(id, expectedVersion);
    const updated = await this.requireLead(id);
    await this.audit(actor, updated, "lead.updated", parsed.data as Record<string, unknown>);
    return summary(updated);
  }

  async transition(actor: Actor, id: string, toStatus: LeadStatus, reason: string | undefined, expectedVersion: number): Promise<LeadSummary> {
    const lead = await this.requireLead(id); await this.assertEditor(actor, lead);
    const parsed = leadStatusTransitionSchema.safeParse({ toStatus, reason, expectedVersion }); if (!parsed.success) throw invalid(parsed.error.issues);
    if (!statusTransitions[String(lead.status) as LeadStatus].includes(toStatus)) throw new ConflictError("The requested lead status transition is not allowed");
    const result = await this.database.jobLead.updateMany({ where: { id, version: expectedVersion }, data: { status: toStatus, ...(toStatus === "CLOSED" ? { closureReason: reason, closedAt: this.now(), closedById: actor.id } : {}), version: { increment: 1 } } });
    if (!result.count) throw await this.stale(id, expectedVersion);
    await this.database.leadStatusTransition.create({ data: { leadId: id, fromStatus: lead.status, toStatus, actorId: actor.id, reason: reason ?? null } });
    const updated = await this.requireLead(id);
    await this.audit(actor, updated, "lead.status_changed", { fromStatus: lead.status, toStatus, reason: reason ?? null });
    return summary(updated);
  }

  async transfer(actor: Actor, id: string, newOwnerId: string, reason: string, expectedVersion: number): Promise<LeadSummary> {
    this.authorization.assertRole(actor, ["ADMIN"]); const lead = await this.requireLead(id);
    const parsed = transferLeadOwnershipSchema.safeParse({ newOwnerId, reason, expectedVersion }); if (!parsed.success) throw invalid(parsed.error.issues);
    const owner = await this.database.user.findUnique({ where: { id: newOwnerId } }); if (!owner || owner.role !== "BD" || !owner.isActive) throw new ValidationError("The selected owner is not an active BD");
    const result = await this.database.jobLead.updateMany({ where: { id, version: expectedVersion }, data: { currentOwnerId: newOwnerId, version: { increment: 1 } } });
    if (!result.count) throw await this.stale(id, expectedVersion);
    await this.database.leadOwnershipTransfer.create({ data: { leadId: id, fromOwnerId: lead.currentOwnerId, toOwnerId: newOwnerId, actorId: actor.id, reason } });
    const updated = await this.requireLead(id);
    await this.audit(actor, updated, "lead.owner_transferred", { fromOwnerId: lead.currentOwnerId, toOwnerId: newOwnerId, reason });
    return summary(updated);
  }

  async setImportant(actor: Actor, id: string, important: boolean, expectedVersion: number): Promise<LeadSummary> {
    const lead = await this.requireLead(id); await this.assertEditor(actor, lead); const parsed = setLeadImportantSchema.safeParse({ important, expectedVersion }); if (!parsed.success) throw invalid(parsed.error.issues);
    const result = await this.database.jobLead.updateMany({ where: { id, version: expectedVersion }, data: { isImportant: important, version: { increment: 1 } } }); if (!result.count) throw await this.stale(id, expectedVersion); const updated = await this.requireLead(id); await this.audit(actor, updated, "lead.importance_changed", { important }); return summary(updated);
  }

  async assignCloser(actor: Actor, id: string, closerId: string, expectedVersion: number): Promise<LeadSummary> {
    if (!actor.isActive || actor.role === "CLOSER") throw new AuthorizationError();
    const lead = await this.requireLead(id); await this.authorization.assertProfileAccess(actor, String(lead.profileId));
    const parsed = assignLeadCloserRequestSchema.safeParse({ closerId, expectedVersion }); if (!parsed.success) throw invalid(parsed.error.issues);
    const eligible = await this.database.profileCloserEligibility.findFirst({ where: { profileId: lead.profileId, userId: closerId, isEligible: true, endedAt: null } });
    if (!eligible) throw new ValidationError("The selected Closer is not eligible for this profile");
    const result = await this.database.jobLead.updateMany({ where: { id, version: expectedVersion }, data: { responsibleCloserId: closerId, version: { increment: 1 } } });
    if (!result.count) throw await this.stale(id, expectedVersion);
    const existingAssignment = await this.database.leadCloserAssignment.findFirst({ where: { leadId: id, userId: closerId, endedAt: null } });
    if (!existingAssignment) await this.database.leadCloserAssignment.create({ data: { leadId: id, userId: closerId, assignedById: actor.id } });
    await this.database.activityEvent.create({ data: {
      action: "lead.closer_assigned",
      actorId: actor.id,
      actorNameSnapshot: actor.displayName,
      actorRoleSnapshot: actor.role,
      profileId: String(lead.profileId),
      leadId: id,
      entityType: "lead",
      entityId: id,
      oldSnapshot: { responsibleCloserId: lead.responsibleCloserId ?? null },
      newSnapshot: { responsibleCloserId: closerId },
      metadata: { assignmentCreated: !existingAssignment },
      requestId: null,
    } });
    return summary(await this.requireLead(id));
  }

  async archive(actor: Actor, id: string, reason: string, expectedVersion: number): Promise<LeadSummary> { return this.archiveState(actor, id, reason, expectedVersion, true); }
  async restore(actor: Actor, id: string, reason: string, expectedVersion: number): Promise<LeadSummary> { return this.archiveState(actor, id, reason, expectedVersion, false); }

  private async archiveState(actor: Actor, id: string, reason: string, expectedVersion: number, archive: boolean) {
    const lead = await this.requireLead(id); await this.assertEditor(actor, lead); const schema = archive ? archiveLeadSchema : restoreLeadSchema; const parsed = schema.safeParse({ reason, expectedVersion }); if (!parsed.success) throw invalid(parsed.error.issues);
    const result = await this.database.jobLead.updateMany({ where: { id, version: expectedVersion }, data: archive ? { archivedAt: this.now(), archivedById: actor.id, archiveReason: reason, version: { increment: 1 } } : { archivedAt: null, archivedById: null, archiveReason: null, version: { increment: 1 } } }); if (!result.count) throw await this.stale(id, expectedVersion); const updated = await this.requireLead(id); await this.audit(actor, updated, archive ? "lead.archived" : "lead.restored", { reason }); return summary(updated);
  }

  private async assertEditor(actor: Actor, lead: Record<string, unknown>) { if (!actor.isActive || actor.role === "CLOSER" || (actor.role === "BD" && lead.currentOwnerId !== actor.id)) throw new AuthorizationError(); await this.authorization.assertProfileAccess(actor, String(lead.profileId)); }
  private async requireLead(id: string) { const lead = await this.database.jobLead.findUnique({ where: { id } }); if (!lead) throw new NotFoundError("The requested lead was not found"); return lead; }
  private async stale(id: string, expected: number) { const lead = await this.database.jobLead.findUnique({ where: { id } }); return lead ? new StaleVersionError(expected, Number(lead.version)) : new NotFoundError("The requested lead was not found"); }
  private async effectiveDuplicateLookbackMonths(database: LeadTransaction, at: Date): Promise<number> {
    const rule = await database.performanceRuleSet.findFirst({ where: { effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] }, orderBy: { effectiveFrom: "desc" } });
    const value = Number(rule?.duplicateLookbackMonths);
    return Number.isInteger(value) && value > 0 ? value : 6;
  }
  private async duplicateReviewDueAt(database: LeadTransaction, at: Date): Promise<Date> {
    const rule = await database.performanceRuleSet.findFirst({
      where: { effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] },
      orderBy: { effectiveFrom: "desc" },
    });
    const holidays = await database.performanceHoliday.findMany({});
    const startHour = Number(rule?.workdayStartHour ?? 9);
    const endHour = Number(rule?.workdayEndHour ?? 17);
    return addBusinessHours(at, 3 * (endHour - startHour), {
      timeZone: String(rule?.businessCalendarTimeZone ?? "UTC"),
      workingDays: Array.isArray(rule?.workingDays) ? rule.workingDays.map(Number) : [1, 2, 3, 4, 5],
      workday: { startHour, endHour },
      holidays: holidays.flatMap((holiday) => holiday.holidayDate instanceof Date ? [holiday.holidayDate] : []),
    });
  }
  private async audit(actor: Actor, lead: Record<string, unknown>, action: string, newSnapshot: Record<string, unknown>, database: LeadTransaction = this.database) { await database.activityEvent.create({ data: { action, actorId: actor.id, actorNameSnapshot: actor.displayName, actorRoleSnapshot: actor.role, profileId: String(lead.profileId), leadId: String(lead.id), entityType: "lead", entityId: String(lead.id), oldSnapshot: null, newSnapshot, metadata: null, requestId: null } }); }
  private async auditRecord(actor: Actor, action: string, entityType: string, entityId: string, profileId: string | null, leadId: string | null, newSnapshot: Record<string, unknown>) { await this.database.activityEvent.create({ data: { action, actorId: actor.id, actorNameSnapshot: actor.displayName, actorRoleSnapshot: actor.role, profileId, leadId, entityType, entityId, oldSnapshot: null, newSnapshot, metadata: null, requestId: null } }); }
  private async requireCompany(id: string) { const company = await this.database.company.findUnique({ where: { id } }); if (!company) throw new NotFoundError("The requested company was not found"); return company; }
  private async staleCompany(id: string, expected: number) { const company = await this.database.company.findUnique({ where: { id } }); return company ? new StaleVersionError(expected, Number(company.version)) : new NotFoundError("The requested company was not found"); }
  private async requireContact(id: string) { const contact = await this.database.contact.findUnique({ where: { id } }); if (!contact) throw new NotFoundError("The requested contact was not found"); return contact; }
  private async staleContact(id: string, expected: number) { const contact = await this.database.contact.findUnique({ where: { id } }); return contact ? new StaleVersionError(expected, Number(contact.version)) : new NotFoundError("The requested contact was not found"); }
}
