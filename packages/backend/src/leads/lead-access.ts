import { AuthorizationError } from "../errors/app-error";
import type { Actor } from "../identity/session.service";

type InterviewAssignmentStore = {
  interviewRound?: {
    findFirst(args: unknown): Promise<Record<string, unknown> | null>;
  };
};

export function closerLeadWhere(closerId: string) {
  return {
    OR: [
      { responsibleCloserId: closerId },
      { interviews: { some: { closerId } } },
    ],
  };
}

export async function assertCloserLeadAccess(
  database: unknown,
  actor: Actor,
  lead: Record<string, unknown>,
): Promise<void> {
  if (actor.role !== "CLOSER" || lead.responsibleCloserId === actor.id) return;

  const assignment = await (database as InterviewAssignmentStore).interviewRound?.findFirst({
    where: { leadId: String(lead.id), closerId: actor.id },
    select: { id: true },
  });
  if (!assignment) throw new AuthorizationError();
}
