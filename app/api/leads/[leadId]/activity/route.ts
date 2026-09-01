import { errorResponse, ok } from "@/lib/api/response";
import { requireActiveUser } from "@/lib/auth/session";
import { listLeadActivity } from "@/services/activity-service";
import { getLeadById } from "@/services/lead-service";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ leadId: string }> },
) {
  try {
    const actor = await requireActiveUser();
    const { leadId } = await context.params;
    await getLeadById(leadId, actor);

    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const limit = url.searchParams.get("limit");
    const activity = await listLeadActivity(leadId, {
      cursor,
      limit: limit ? Number(limit) : undefined,
    });

    return ok(activity);
  } catch (error) {
    return errorResponse(error);
  }
}
