import { LEAD_STATUSES } from "@/constants/leads";
import { queryKanbanBoard } from "@/services/kanban-service";
import { createLeadFixture, createProfileFixture, createUserFixture, toActor } from "@/tests/helpers/fixtures";
import { setupTestDatabase } from "@/tests/helpers/database";

setupTestDatabase();

describe("kanbanService", () => {
  it("groups leads into status columns with counts and supports search", async () => {
    const admin = await createUserFixture({
      name: "Admin User",
      email: "kanban-admin@example.com",
      role: "ADMIN",
    });
    const bd = await createUserFixture({
      name: "BD User",
      email: "kanban-bd@example.com",
      role: "BD",
    });
    const closer = await createUserFixture({
      name: "Closer User",
      email: "kanban-closer@example.com",
      role: "CLOSER",
    });

    const profile = await createProfileFixture({
      name: "Kanban Profile",
      assignedBD: bd._id,
      assignedCloser: closer._id,
      createdBy: admin._id,
    });

    await createLeadFixture({
      profileId: profile._id,
      createdBy: bd._id,
      companyName: "Google",
      jobUrl: "https://example.com/google",
      status: "APPLIED",
    });
    await createLeadFixture({
      profileId: profile._id,
      createdBy: bd._id,
      companyName: "Meta",
      jobUrl: "https://example.com/meta",
      status: "IN_PROCESS",
    });

    const board = await queryKanbanBoard(profile._id.toString(), {}, toActor(bd));

    expect(board.counts.APPLIED).toBe(1);
    expect(board.counts.IN_PROCESS).toBe(1);
    expect(board.columns.APPLIED.items[0]?.companyName).toBe("Google");
    expect(board.columns.IN_PROCESS.items[0]?.companyName).toBe("Meta");

    const searchBoard = await queryKanbanBoard(
      profile._id.toString(),
      { q: "Google" },
      toActor(bd),
    );

    expect(
      LEAD_STATUSES.every((status) => searchBoard.columns[status].items.length <= 1),
    ).toBe(true);
    expect(
      Object.values(searchBoard.columns).some((column) =>
        column.items.some((item) => item.companyName === "Google"),
      ),
    ).toBe(true);
  });

  it("denies unauthorized profile kanban access", async () => {
    const admin = await createUserFixture({
      name: "Admin User",
      email: "kanban-admin2@example.com",
      role: "ADMIN",
    });
    const bd = await createUserFixture({
      name: "BD User",
      email: "kanban-bd2@example.com",
      role: "BD",
    });
    const otherBd = await createUserFixture({
      name: "Other BD",
      email: "kanban-other-bd@example.com",
      role: "BD",
    });
    const closer = await createUserFixture({
      name: "Closer User",
      email: "kanban-closer2@example.com",
      role: "CLOSER",
    });

    const profile = await createProfileFixture({
      name: "Protected Kanban Profile",
      assignedBD: bd._id,
      assignedCloser: closer._id,
      createdBy: admin._id,
    });

    await expect(queryKanbanBoard(profile._id.toString(), {}, toActor(otherBd))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
