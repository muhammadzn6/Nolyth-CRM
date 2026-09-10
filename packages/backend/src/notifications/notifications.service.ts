import { activityListQuerySchema, notificationListQuerySchema, type ActivityEventSummary, type NotificationSummary } from "@orbit/contracts";
import { AuthorizationError, NotFoundError, ValidationError } from "../errors/app-error";
import type { Actor } from "../identity/session.service";
import type { LeadsDatabase } from "../leads/leads.service";

function invalid(issues: unknown) { return new ValidationError("The request payload is invalid", issues); }
function iso(value: unknown) { return value instanceof Date ? value.toISOString() : String(value); }
function notification(row: Record<string, unknown>): NotificationSummary { return { id: String(row.id), recipientId: String(row.recipientId), type: String(row.type), title: String(row.title), message: String(row.message), relatedEntityType: (row.relatedEntityType as string | null) ?? null, relatedEntityId: (row.relatedEntityId as string | null) ?? null, createdAt: iso(row.createdAt), readAt: row.readAt ? iso(row.readAt) : null }; }
function activity(row: Record<string, unknown>): ActivityEventSummary { return { id: String(row.id), actorId: (row.actorId as string | null) ?? null, actorNameSnapshot: (row.actorNameSnapshot as string | null) ?? null, actorRoleSnapshot: (row.actorRoleSnapshot as ActivityEventSummary["actorRoleSnapshot"]) ?? null, entityType: String(row.entityType), entityId: String(row.entityId), action: String(row.action), profileId: (row.profileId as string | null) ?? null, leadId: (row.leadId as string | null) ?? null, metadata: (row.metadata as Record<string, unknown> | null) ?? null, occurredAt: iso(row.occurredAt) }; }

export class NotificationsService {
  constructor(private readonly database: LeadsDatabase) {}
  async createInApp(input: { idempotencyKey: string; recipientUserId: string; title: string; message: string; relatedEntityType?: string; relatedEntityId?: string }) { const existing = await this.database.notification.findUnique({ where: { idempotencyKey: input.idempotencyKey } }); if (existing) return notification(existing); return notification(await this.database.notification.create({ data: { idempotencyKey: input.idempotencyKey, recipientId: input.recipientUserId, type: "IN_APP", title: input.title, message: input.message, relatedEntityType: input.relatedEntityType ?? null, relatedEntityId: input.relatedEntityId ?? null } })); }
  async notifyLeadOwner(leadId: string, input: { idempotencyKey: string; title: string; message: string; relatedEntityType?: string; relatedEntityId?: string }) { const lead = await this.database.jobLead.findUnique({ where: { id: leadId }, select: { currentOwnerId: true } }); if (!lead) return; return this.createInApp({ ...input, recipientUserId: String(lead.currentOwnerId) }); }
  async list(actor: Actor, query: unknown) { if (!actor.isActive) throw new AuthorizationError(); const parsed = notificationListQuerySchema.safeParse(query); if (!parsed.success) throw invalid(parsed.error.issues); const rows = await this.database.notification.findMany({ where: { recipientId: actor.id, ...(parsed.data.unreadOnly ? { readAt: null } : {}) }, orderBy: { createdAt: "desc" }, take: parsed.data.limit }); return rows.map(notification); }
  async read(actor: Actor, id: string) { const result = await this.database.notification.updateMany({ where: { id, recipientId: actor.id }, data: { readAt: new Date() } }); if (!result.count) throw new NotFoundError("The notification was not found"); }
  async readAll(actor: Actor) { if (!actor.isActive) throw new AuthorizationError(); await this.database.notification.updateMany({ where: { recipientId: actor.id, readAt: null }, data: { readAt: new Date() } }); }
  async activity(actor: Actor, query: unknown) {
    if (!actor.isActive) throw new AuthorizationError();
    const parsed = activityListQuerySchema.safeParse(query);
    if (!parsed.success) throw invalid(parsed.error.issues);

    const filters = {
      ...(parsed.data.leadId ? { leadId: parsed.data.leadId } : {}),
      ...(parsed.data.profileId ? { profileId: parsed.data.profileId } : {}),
    };
    const search = parsed.data.search?.trim();
    const searchFilter = search ? { OR: [{ action: { contains: search, mode: "insensitive" as const } }, { entityType: { contains: search, mode: "insensitive" as const } }, { entityId: { contains: search, mode: "insensitive" as const } }, { actorNameSnapshot: { contains: search, mode: "insensitive" as const } }] } : undefined;
    if (actor.role === "ADMIN") {
      const companyScope = parsed.data.companyId ? await this.database.jobLead.findMany({ where: { companyId: parsed.data.companyId }, select: { id: true, profileId: true } }) : [];
      const scopedFilters = { ...filters, ...(parsed.data.companyId || searchFilter ? { AND: [...(parsed.data.companyId ? [{ OR: [{ leadId: { in: companyScope.map((lead) => String(lead.id)) } }, { profileId: { in: companyScope.map((lead) => String(lead.profileId)) } }] }] : []), ...(searchFilter ? [searchFilter] : [])] } : {}) };
      const rows = await this.database.activityEvent.findMany({ where: scopedFilters, orderBy: { occurredAt: "desc" }, take: parsed.data.limit });
      return rows.map(activity);
    }

    const [leads, assignments] = await Promise.all([
      this.database.jobLead.findMany({ where: actor.role === "BD" ? { currentOwnerId: actor.id } : { responsibleCloserId: actor.id }, select: { id: true } }),
      actor.role === "BD"
        ? this.database.profileBdAssignment.findMany({ where: { userId: actor.id, endedAt: null }, select: { profileId: true } })
        : this.database.profileCloserEligibility.findMany({ where: { userId: actor.id, isEligible: true, endedAt: null }, select: { profileId: true } }),
    ]);
    const leadIds = leads.map((lead) => String(lead.id));
    const profileIds = assignments.map((assignment) => String(assignment.profileId));
    const rows = await this.database.activityEvent.findMany({
      where: {
        ...filters,
        OR: [
          ...(leadIds.length ? [{ leadId: { in: leadIds } }] : []),
          ...(profileIds.length ? [{ profileId: { in: profileIds } }] : []),
        ],
        ...(searchFilter ? { AND: [searchFilter] } : {}),
      },
      orderBy: { occurredAt: "desc" },
      take: parsed.data.limit,
    });
    return rows.map(activity);
  }
}
