import { errorResponse, ok } from "@/lib/api/response";
import { readJson } from "@/lib/api/request";
import { requireActiveUser } from "@/lib/auth/session";
import { getProfileById, updateProfile } from "@/services/profile-service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ profileId: string }> },
) {
  try {
    const actor = await requireActiveUser();
    const { profileId } = await context.params;
    const profile = await getProfileById(profileId, actor);
    return ok(profile);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ profileId: string }> },
) {
  try {
    const actor = await requireActiveUser();
    const { profileId } = await context.params;
    const body = await readJson(request);
    const profile = await updateProfile(profileId, body, actor);
    return ok(profile);
  } catch (error) {
    return errorResponse(error);
  }
}
