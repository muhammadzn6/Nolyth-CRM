import { errorResponse, ok } from "@/lib/api/response";
import { readJson } from "@/lib/api/request";
import { requireActiveUser } from "@/lib/auth/session";
import { getLeadDetail } from "@/services/lead-detail-service";
import { updateLead } from "@/services/lead-service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ leadId: string }> },
) {
  try {
    const actor = await requireActiveUser();
    const { leadId } = await context.params;
    const lead = await getLeadDetail(leadId, actor);
    return ok(lead);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ leadId: string }> },
) {
  try {
    const actor = await requireActiveUser();
    const { leadId } = await context.params;
    const body = await readJson(request);
    const lead = await updateLead(leadId, body, actor);
    return ok(lead);
  } catch (error) {
    return errorResponse(error);
  }
}
