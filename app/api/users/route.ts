import { created, errorResponse, ok } from "@/lib/api/response";
import { readJson } from "@/lib/api/request";
import { requireActiveUser } from "@/lib/auth/session";
import { createUser, listUsers } from "@/services/user-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const actor = await requireActiveUser();
    const users = await listUsers(actor);
    return ok(users);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActiveUser();
    const body = await readJson(request);
    const user = await createUser(body, actor);
    return created(user);
  } catch (error) {
    return errorResponse(error);
  }
}
