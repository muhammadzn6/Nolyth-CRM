import { analyticsQuerySchema } from "@orbit/contracts";
import { AuthorizationError, ValidationError } from "../errors/app-error";
import type { Actor } from "../identity/session.service";
import type { LeadsDatabase } from "../leads/leads.service";

function invalid(issues: unknown) { return new ValidationError("The analytics filters are invalid", issues); }
function countBy(rows: ReadonlyArray<Record<string, unknown>>, field: string) { const counts = new Map<string, number>(); for (const row of rows) { const key = String(row[field] ?? "Unknown"); counts.set(key, (counts.get(key) ?? 0) + 1); } return [...counts].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count); }

export class AnalyticsService {
  constructor(private readonly database: LeadsDatabase, private readonly now = () => new Date()) {}
  async dashboard(actor: Actor, filters: unknown) {
    if (!actor.isActive) throw new AuthorizationError(); const parsed = analyticsQuerySchema.safeParse(filters); if (!parsed.success) throw invalid(parsed.error.issues);
    const leads = await this.leads(actor, parsed.data); const tasks = await this.database.task.findMany({ where: { status: "OPEN", ...(actor.role === "ADMIN" ? {} : { assigneeId: actor.id }) } });
    const interviews = await this.database.interviewRound.findMany({ where: { ...(actor.role === "CLOSER" ? { closerId: actor.id } : {}), ...(parsed.data.from || parsed.data.to ? { startsAt: { ...(parsed.data.from ? { gte: new Date(parsed.data.from) } : {}), ...(parsed.data.to ? { lte: new Date(parsed.data.to) } : {}) } } : {}) } });
    const applications = leads.length; const responses = leads.filter((lead) => ["RESPONSE_RECEIVED", "INTERVIEWING", "OFFER_RECEIVED", "OFFER_ACCEPTED", "PLACED", "STARTED"].includes(String(lead.status))).length; const offers = leads.filter((lead) => ["OFFER_RECEIVED", "OFFER_ACCEPTED", "PLACED", "STARTED"].includes(String(lead.status))).length; const acceptedOffers = leads.filter((lead) => ["OFFER_ACCEPTED", "PLACED", "STARTED"].includes(String(lead.status))).length;
    return { kpis: { applications, responses, interviews: new Set(interviews.map((row) => row.leadId)).size, offers, acceptedOffers, placements: leads.filter((lead) => ["PLACED", "STARTED"].includes(String(lead.status))).length, starts: leads.filter((lead) => String(lead.status) === "STARTED").length, activePipeline: leads.filter((lead) => !["CLOSED", "STARTED"].includes(String(lead.status)) && !lead.archivedAt).length, overdueTasks: tasks.filter((task) => task.dueAt instanceof Date && task.dueAt < this.now()).length, responseRate: applications ? responses / applications : null }, breakdowns: { statuses: countBy(leads, "status"), sources: countBy(leads, "source") }, upcomingInterviews: interviews.filter((row) => row.startsAt instanceof Date && row.startsAt >= this.now()).length };
  }
  async funnel(actor: Actor, filters: unknown) { const result = await this.dashboard(actor, filters); return result.kpis; }
  async sources(actor: Actor, filters: unknown) { const parsed = analyticsQuerySchema.safeParse(filters); if (!parsed.success) throw invalid(parsed.error.issues); return countBy(await this.leads(actor, parsed.data), "source"); }
  async companies(actor: Actor, filters: unknown) { const parsed = analyticsQuerySchema.safeParse(filters); if (!parsed.success) throw invalid(parsed.error.issues); return countBy(await this.leads(actor, parsed.data), "companyName"); }
  private async leads(actor: Actor, filters: { companyId?: string; profileId?: string; from?: string; to?: string }) { if (filters.profileId && actor.role !== "ADMIN") { const lead = await this.database.jobLead.findFirst({ where: { profileId: filters.profileId, ...(actor.role === "BD" ? { currentOwnerId: actor.id } : { responsibleCloserId: actor.id }) } }); if (!lead) return []; } return this.database.jobLead.findMany({ where: { ...(filters.companyId ? { companyId: filters.companyId } : {}), ...(filters.profileId ? { profileId: filters.profileId } : {}), ...(actor.role === "BD" ? { currentOwnerId: actor.id } : actor.role === "CLOSER" ? { responsibleCloserId: actor.id } : {}), ...(filters.from || filters.to ? { appliedDate: { ...(filters.from ? { gte: new Date(filters.from) } : {}), ...(filters.to ? { lte: new Date(filters.to) } : {}) } } : {}) } }); }
}
