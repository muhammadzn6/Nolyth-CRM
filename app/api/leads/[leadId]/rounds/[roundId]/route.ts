import { errorResponse, ok } from "@/lib/api/response";
import { readJson } from "@/lib/api/request";
import { requireActiveUser } from "@/lib/auth/session";
import { updateInterviewRound } from "@/services/interview-round-service";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ leadId: string; roundId: string }> },
) {
  try {
    const actor = await requireActiveUser();
    const { roundId } = await context.params;
    const body = await readJson(request);
    const round = await updateInterviewRound(roundId, body, actor);
    return ok(round);
  } catch (error) {
    return errorResponse(error);
  }
}
