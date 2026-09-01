import { errorResponse, ok } from "@/lib/api/response";
import { requireActiveUser } from "@/lib/auth/session";
import { getProfileById } from "@/services/profile-service";
import { listProfileActivity } from "@/services/activity-service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ profileId: string }> },
) {
  try {
    const actor = await requireActiveUser();
    const { profileId } = await context.params;
    await getProfileById(profileId, actor);
    const activity = await listProfileActivity(profileId);
    return ok(activity);
  } catch (error) {
    return errorResponse(error);
  }
}
