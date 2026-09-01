import { created, errorResponse, ok } from "@/lib/api/response";
import { readJson } from "@/lib/api/request";
import { requireActiveUser } from "@/lib/auth/session";
import { createProfile, listAccessibleProfiles } from "@/services/profile-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const actor = await requireActiveUser();
    const profiles = await listAccessibleProfiles(actor);
    return ok(profiles);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActiveUser();
    const body = await readJson(request);
    const profile = await createProfile(body, actor);
    return created(profile);
  } catch (error) {
    return errorResponse(error);
  }
}
