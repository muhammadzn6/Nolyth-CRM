import { created, errorResponse, ok } from "@/lib/api/response";
import { readJson } from "@/lib/api/request";
import { requireActiveUser } from "@/lib/auth/session";
import { createLead, queryLeadsByProfile } from "@/services/lead-service";

export const runtime = "nodejs";

function parseLeadListQuery(request: Request) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  return params;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ profileId: string }> },
) {
  try {
    const actor = await requireActiveUser();
    const { profileId } = await context.params;
    const result = await queryLeadsByProfile(profileId, parseLeadListQuery(request), actor);
    return ok(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ profileId: string }> },
) {
  try {
    const actor = await requireActiveUser();
    const { profileId } = await context.params;
    const body = await readJson(request);
    const result = await createLead(profileId, body, actor);
    return created(result);
  } catch (error) {
    return errorResponse(error);
  }
}
