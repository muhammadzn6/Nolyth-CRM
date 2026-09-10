import type { LeadStatus } from "@orbit/contracts";

import type { Actor } from "../identity/session.service";

type LeadStatusDatabase = {
  jobLead: { updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }> };
  leadStatusTransition: { create(args: { data: Record<string, unknown> }): Promise<unknown> };
  activityEvent: { create(args: { data: Record<string, unknown> }): Promise<unknown> };
};

const progression: LeadStatus[] = [
  "APPLIED",
  "RESPONSE_RECEIVED",
  "INTERVIEWING",
  "OFFER_RECEIVED",
  "OFFER_ACCEPTED",
  "PLACED",
  "STARTED",
];

export async function advanceLeadStatus(
  database: LeadStatusDatabase,
  actor: Actor,
  lead: Record<string, unknown>,
  toStatus: LeadStatus,
  additionalData: Record<string, unknown> = {},
  trigger = "domain_mutation",
) {
  const fromStatus = lead.status as LeadStatus;
  const fromIndex = progression.indexOf(fromStatus);
  const toIndex = progression.indexOf(toStatus);
  if (fromIndex < 0 || toIndex <= fromIndex) return false;

  const result = await database.jobLead.updateMany({
    where: { id: String(lead.id), status: fromStatus },
    data: { ...additionalData, status: toStatus, version: { increment: 1 } },
  });
  if (!result.count) return false;

  await database.leadStatusTransition.create({
    data: { leadId: String(lead.id), fromStatus, toStatus, actorId: actor.id, reason: null },
  });
  await database.activityEvent.create({
    data: {
      action: "lead.status_advanced",
      actorId: actor.id,
      actorNameSnapshot: actor.displayName,
      actorRoleSnapshot: actor.role,
      profileId: String(lead.profileId),
      leadId: String(lead.id),
      entityType: "lead",
      entityId: String(lead.id),
      oldSnapshot: { status: fromStatus },
      newSnapshot: { fromStatus, toStatus },
      metadata: { source: "domain_mutation", trigger },
      requestId: null,
    },
  });
  return true;
}
