import {
  archiveLeadSchema,
  assignLeadCloserRequestSchema,
  companyListQuerySchema,
  contactListQuerySchema,
  createCompanySchema,
  createContactSchema,
  createLeadSchema,
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
        ...(q.ownerId ? { currentOwnerId: q.ownerId } : {}), ...(q.closerId ? { responsibleCloserId: q.closerId } : {}),
        ...(q.important === undefined ? {} : { isImportant: q.important }), archivedAt: q.archived ? { not: null } : null,
        ...(q.search ? { OR: [{ jobTitle: { contains: q.search, mode: "insensitive" } }, { companyName: { contains: q.search, mode: "insensitive" } }] } : {}),
      }, orderBy: [{ appliedDate: "desc" }, { id: "asc" }], ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}), take: q.limit + 1,
    });
    const visible = actor.role === "BD"
      ? rows.filter((row) => row.currentOwnerId === actor.id)
      : actor.role === "CLOSER"
        ? rows.filter((row) => row.responsibleCloserId === actor.id && row.status !== "APPLIED")
        : rows;
    return page(visible.map((row) => summary(row)), q.limit);
  }

  async get(actor: Actor, id: string): Promise<LeadSummary & { company: Record<string, unknown>; contacts: ReadonlyArray<Record<string, unknown>> }> {
    const lead = await this.requireLead(id); await this.authorization.assertProfileAccess(actor, String(lead.profileId));
    if (actor.role === "CLOSER" && (lead.responsibleCloserId !== actor.id || lead.status === "APPLIED")) throw new AuthorizationError();
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
    if (!actor.isActive || !["ADMIN", "BD"].includes(actor.role)) throw new AuthorizationError();
    const parsed = createLeadSchema.safeParse(input); if (!parsed.success) throw invalid(parsed.error.issues);
    await this.authorization.assertProfileAccess(actor, parsed.data.profileId);
    const currentOwnerId = parsed.data.currentOwnerId ?? actor.id;
    if (actor.role === "BD" && currentOwnerId !== actor.id) throw new AuthorizationError();
    const { companyId, companyName, sourceId, recruiterName, recruiterEmail, currentOwnerId: _ownerId, ...leadData } = parsed.data;
    const company = companyId
      ? await this.database.company.findUnique({ where: { id: companyId } })
      : await this.database.company.findUnique({ where: { canonicalName: companyName! } });
    const normalizedCompany = company ?? (companyName
      ? await this.database.company.create({ data: { canonicalName: companyName, createdById: actor.id } })
      : null);
    const source = sourceId
      ? await this.database.jobSource.findUnique({ where: { id: sourceId } })
      : await this.database.jobSource.findFirst({ where: { isActive: true }, orderBy: { displayOrder: "asc" } });
    if (!normalizedCompany || !source) throw new NotFoundError("The company or source was not found");
    try {
      const created = await this.database.jobLead.create({ data: { ...leadData, currentOwnerId, companyId: normalizedCompany.id, sourceId: source.id, companyName: String(normalizedCompany.canonicalName), createdById: actor.id, appliedDate: new Date(`${leadData.appliedDate}T00:00:00.000Z`), canonicalUrl: leadData.rawUrl, canonicalHash: leadData.rawUrl.toLowerCase() } });
      if (recruiterName || recruiterEmail) {
        const contact = await this.database.contact.create({ data: { companyId: normalizedCompany.id, createdById: actor.id, name: recruiterName ?? "Recruiter", email: recruiterEmail ?? null } });
        await this.database.leadContact.create({ data: { leadId: created.id, contactId: contact.id, role: "RECRUITER", isPrimary: true } });
      }
      await this.audit(actor, created, "lead.created", { status: created.status, jobTitle: created.jobTitle });
      return summary(created);
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && (error as { code: string }).code === "P2002") throw new ConflictError("An active lead with this URL already exists for the profile");
      throw error;
    }
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
    if (lead.status === "APPLIED") throw new ValidationError("A Closer can be assigned after a recruiter response");
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
  private async audit(actor: Actor, lead: Record<string, unknown>, action: string, newSnapshot: Record<string, unknown>) { await this.database.activityEvent.create({ data: { action, actorId: actor.id, actorNameSnapshot: actor.displayName, actorRoleSnapshot: actor.role, profileId: String(lead.profileId), leadId: String(lead.id), entityType: "lead", entityId: String(lead.id), oldSnapshot: null, newSnapshot, metadata: null, requestId: null } }); }
  private async auditRecord(actor: Actor, action: string, entityType: string, entityId: string, profileId: string | null, leadId: string | null, newSnapshot: Record<string, unknown>) { await this.database.activityEvent.create({ data: { action, actorId: actor.id, actorNameSnapshot: actor.displayName, actorRoleSnapshot: actor.role, profileId, leadId, entityType, entityId, oldSnapshot: null, newSnapshot, metadata: null, requestId: null } }); }
  private async requireCompany(id: string) { const company = await this.database.company.findUnique({ where: { id } }); if (!company) throw new NotFoundError("The requested company was not found"); return company; }
  private async staleCompany(id: string, expected: number) { const company = await this.database.company.findUnique({ where: { id } }); return company ? new StaleVersionError(expected, Number(company.version)) : new NotFoundError("The requested company was not found"); }
  private async requireContact(id: string) { const contact = await this.database.contact.findUnique({ where: { id } }); if (!contact) throw new NotFoundError("The requested contact was not found"); return contact; }
  private async staleContact(id: string, expected: number) { const contact = await this.database.contact.findUnique({ where: { id } }); return contact ? new StaleVersionError(expected, Number(contact.version)) : new NotFoundError("The requested contact was not found"); }
}
