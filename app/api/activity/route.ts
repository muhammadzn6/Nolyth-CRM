import { errorResponse, ok } from "@/lib/api/response";
import { requireActiveUser } from "@/lib/auth/session";
import { listPlatformActivity } from "@/services/activity-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const actor = await requireActiveUser();
    const activity = await listPlatformActivity(actor);
    return ok(activity);
  } catch (error) {
    return errorResponse(error);
  }
}
