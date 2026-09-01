import { errorResponse, ok } from "@/lib/api/response";
import { requireActiveUser } from "@/lib/auth/session";
import { queryKanbanBoard } from "@/services/kanban-service";

export const runtime = "nodejs";

function parseKanbanQuery(request: Request) {
  const url = new URL(request.url);
  return Object.fromEntries(url.searchParams.entries());
}

export async function GET(
  request: Request,
  context: { params: Promise<{ profileId: string }> },
) {
  try {
    const actor = await requireActiveUser();
    const { profileId } = await context.params;
    const board = await queryKanbanBoard(profileId, parseKanbanQuery(request), actor);
    return ok(board);
  } catch (error) {
    return errorResponse(error);
  }
}
