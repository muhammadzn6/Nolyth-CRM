import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentActorMock = vi.hoisted(() => vi.fn());
const getLeadMock = vi.hoisted(() => vi.fn());
const listActivityMock = vi.hoisted(() => vi.fn());
const listLeadCommunicationsMock = vi.hoisted(() => vi.fn());
const listLeadCommentsMock = vi.hoisted(() => vi.fn());
const listLeadOffersMock = vi.hoisted(() => vi.fn());
const collaborationCreateActionMock = vi.hoisted(() => vi.fn());
const collaborationEditFormMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers({ cookie: "orbit_session=token" })) }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));
vi.mock("../../../../components/layout/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("../../../../components/leads/lead-workspace-shell", () => ({ LeadWorkspaceShell: ({ activeSection, children, headerAction }: { activeSection: string; children: React.ReactNode; headerAction?: React.ReactNode }) => <section data-active={activeSection}>{headerAction}{children}</section> }));
vi.mock("../../../../components/leads/lead-workspace-actions", () => ({ CollaborationCreateAction: (props: unknown) => { collaborationCreateActionMock(props); return <button>Add communication</button>; }, OfferDialogAction: () => null }));
vi.mock("../../../../components/leads/communication-timeline", () => ({ CommunicationTimeline: () => <p>Communication timeline</p> }));
vi.mock("../../../../components/leads/collaboration-edit-form", () => ({ CollaborationEditForm: (props: unknown) => { collaborationEditFormMock(props); return null; } }));
vi.mock("../../../../components/offers/offer-actions", () => ({ OfferActions: () => null }));
vi.mock("../../../../lib/api-client", () => ({
  ApiClientError: class ApiClientError extends Error {},
  getCurrentActor: getCurrentActorMock,
  getLead: getLeadMock,
  listActivity: listActivityMock,
  listLeadComments: listLeadCommentsMock,
  listLeadCommunications: listLeadCommunicationsMock,
  listLeadOffers: listLeadOffersMock,
}));

import LeadSectionRoute from "./page";

describe("LeadSectionRoute", () => {
  beforeEach(() => {
    getCurrentActorMock.mockResolvedValue({ id: "10000000-0000-4000-8000-000000000001", role: "BD", isActive: true, timezone: "Asia/Karachi" });
    getLeadMock.mockResolvedValue({ id: "30000000-0000-4000-8000-000000000001", jobTitle: "Platform Engineer", status: "APPLIED", company: { canonicalName: "Northstar Labs" }, contacts: [] });
    listActivityMock.mockResolvedValue([]);
    listLeadCommunicationsMock.mockResolvedValue([{ id: "90000000-0000-4000-8000-000000000001" }]);
    listLeadCommentsMock.mockResolvedValue([]);
    listLeadOffersMock.mockResolvedValue([]);
    collaborationCreateActionMock.mockReset();
    collaborationEditFormMock.mockReset();
  });

  it("renders communication content inside the persistent lead workspace", async () => {
    const html = renderToStaticMarkup(await LeadSectionRoute({ params: Promise.resolve({ leadId: "30000000-0000-4000-8000-000000000001", section: "communications" }) }));

    expect(html).toContain('data-active="communications"');
    expect(html).toContain("Add communication");
    expect(html).toContain("Communication timeline");
    expect(collaborationCreateActionMock).toHaveBeenCalledWith(expect.objectContaining({ recruiterResponse: true }));
  });

  it("renders offer compensation and human-readable timing", async () => {
    listLeadOffersMock.mockResolvedValue([{
      id: "90000000-0000-4000-8000-000000000002",
      leadId: "30000000-0000-4000-8000-000000000001",
      status: "ACCEPTED",
      compensationAmount: "185000",
      compensationCurrency: "USD",
      employmentType: "Full time",
      details: "Base salary plus equity and benefits.",
      decisionDeadline: null,
      acceptedAt: "2026-09-08T05:37:13.467Z",
      startDate: null,
      startedAt: null,
      createdById: "10000000-0000-4000-8000-000000000001",
      version: 1,
      createdAt: "2026-09-08T05:37:13.467Z",
      updatedAt: "2026-09-08T05:37:13.467Z",
    }]);

    const html = renderToStaticMarkup(await LeadSectionRoute({ params: Promise.resolve({ leadId: "30000000-0000-4000-8000-000000000001", section: "offers" }) }));

    expect(html).toContain("USD 185,000");
    expect(html).toContain("Full time");
    expect(html).toContain("Sep 8, 2026");
    expect(html).not.toContain("2026-09-08T05:37:13.467Z");
  });

  it("renders activity as a human-readable timeline", async () => {
    listActivityMock.mockResolvedValue([{
      id: "90000000-0000-4000-8000-000000000003",
      actorId: "10000000-0000-4000-8000-000000000001",
      actorNameSnapshot: "Maya Brooks (BD)",
      actorRoleSnapshot: "BD",
      entityType: "LEAD",
      entityId: "30000000-0000-4000-8000-000000000001",
      action: "placement.confirmed",
      profileId: null,
      leadId: "30000000-0000-4000-8000-000000000001",
      metadata: null,
      occurredAt: "2026-09-08T05:38:59.496Z",
    }]);

    const html = renderToStaticMarkup(await LeadSectionRoute({ params: Promise.resolve({ leadId: "30000000-0000-4000-8000-000000000001", section: "activity" }) }));

    expect(html).toContain("Placement confirmed");
    expect(html).toContain("Maya Brooks (BD)");
    expect(html).not.toContain("Maya Brooks (BD) · Bd");
    expect(html).toContain("Sep 8, 2026");
    expect(html).not.toContain("placement.confirmed");
    expect(html).not.toContain("2026-09-08T05:38:59.496Z");
  });

  it("only lets a closer edit their own shared comment", async () => {
    const closerId = "10000000-0000-4000-8000-000000000009";
    getCurrentActorMock.mockResolvedValue({ id: closerId, role: "CLOSER", isActive: true, timezone: "America/New_York" });
    listLeadCommentsMock.mockResolvedValue([
      { id: "20000000-0000-4000-8000-000000000001", leadId: "30000000-0000-4000-8000-000000000001", authorId: closerId, body: "My shared note", visibility: "SHARED_WITH_CLOSER", archivedAt: null, createdAt: "2026-09-09T10:00:00.000Z", updatedAt: "2026-09-09T10:00:00.000Z", version: 1 },
      { id: "20000000-0000-4000-8000-000000000002", leadId: "30000000-0000-4000-8000-000000000001", authorId: "10000000-0000-4000-8000-000000000001", body: "BD shared note", visibility: "SHARED_WITH_CLOSER", archivedAt: null, createdAt: "2026-09-09T11:00:00.000Z", updatedAt: "2026-09-09T11:00:00.000Z", version: 1 },
    ]);

    renderToStaticMarkup(await LeadSectionRoute({ params: Promise.resolve({ leadId: "30000000-0000-4000-8000-000000000001", section: "comments" }) }));

    expect(collaborationCreateActionMock).toHaveBeenCalledWith(expect.objectContaining({ kind: "comments", sharedOnly: true }));
    expect(collaborationEditFormMock).toHaveBeenCalledTimes(1);
    expect(collaborationEditFormMock).toHaveBeenCalledWith(expect.objectContaining({ item: expect.objectContaining({ authorId: closerId }), sharedOnly: true }));
  });
});
