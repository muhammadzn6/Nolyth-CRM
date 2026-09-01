import { created, errorResponse, ok } from "@/lib/api/response";
import { readJson } from "@/lib/api/request";
import { requireActiveUser } from "@/lib/auth/session";
import {
  createInterviewRound,
  listInterviewRoundsByLead,
} from "@/services/interview-round-service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ leadId: string }> },
) {
  try {
    const actor = await requireActiveUser();
    const { leadId } = await context.params;
    const rounds = await listInterviewRoundsByLead(leadId, actor);
    return ok(rounds);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ leadId: string }> },
) {
  try {
    const actor = await requireActiveUser();
    const { leadId } = await context.params;
    const body = await readJson(request);
    const round = await createInterviewRound(leadId, body, actor);
    return created(round);
  } catch (error) {
    return errorResponse(error);
  }
}
