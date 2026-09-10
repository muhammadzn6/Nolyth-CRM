import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentActorMock = vi.hoisted(() => vi.fn());
const getLeadMock = vi.hoisted(() => vi.fn());
const listLeadInterviewRoundsMock = vi.hoisted(() => vi.fn());
const getProfileMock = vi.hoisted(() => vi.fn());
const listUsersMock = vi.hoisted(() => vi.fn());
const listCloserEligibilityMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers({ cookie: "orbit_session=token" })) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("../../../../components/layout/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("../../../../components/leads/lead-workspace-shell", () => ({ LeadWorkspaceShell: ({ activeSection, children }: { activeSection: string; children: React.ReactNode }) => <section data-active={activeSection}>{children}</section> }));
vi.mock("../../../../components/leads/lead-workspace-actions", () => ({ InterviewCreateAction: () => <p>interview-create-action</p> }));
vi.mock("../../../../components/interviews/interview-edit-form", () => ({
  InterviewRoundCard: ({ closerName, round, initiallyEditing }: { closerName?: string; round: { id: string }; initiallyEditing?: boolean }) => <p>{`round:${round.id}:editing:${String(initiallyEditing)}:closer:${closerName ?? "unassigned"}`}</p>,
}));
vi.mock("../../../../lib/api-client", () => ({
  getCurrentActor: getCurrentActorMock,
  getLead: getLeadMock,
  getProfile: getProfileMock,
  listLeadInterviewRounds: listLeadInterviewRoundsMock,
  listUsers: listUsersMock,
  listCloserEligibility: listCloserEligibilityMock,
  ApiClientError: class ApiClientError extends Error {},
}));

import LeadInterviewsRoute from "./page";

const actor = { id: "00000000-0000-4000-8000-000000000001", displayName: "Ayesha", email: "ayesha@orbit.test", role: "BD" as const, isActive: true };
const leadId = "00000000-0000-4000-8000-000000000101";
const roundId = "00000000-0000-4000-8000-000000000201";
const closer = { id: "00000000-0000-4000-8000-000000000501", displayName: "Noah", email: "noah@orbit.test", role: "CLOSER" as const, isActive: true };

describe("LeadInterviewsRoute", () => {
  beforeEach(() => {
    getCurrentActorMock.mockResolvedValue(actor);
    getLeadMock.mockResolvedValue({
      id: leadId,
      profileId: "00000000-0000-4000-8000-000000000301",
      jobTitle: "Platform Engineer",
      profile: { candidate: { timezone: "America/New_York" } },
    });
    getProfileMock.mockResolvedValue({
      candidateId: "00000000-0000-4000-8000-000000000401",
      candidate: { timezone: "America/New_York" },
    });
    listLeadInterviewRoundsMock.mockResolvedValue([{ id: roundId, closerId: closer.id, status: "SCHEDULED" }]);
    listUsersMock.mockResolvedValue([closer]);
    listCloserEligibilityMock.mockResolvedValue([{ userId: closer.id, endedAt: null }]);
  });

  it("opens the interview selected by the BD quick-action edit query", async () => {
    const html = renderToStaticMarkup(await LeadInterviewsRoute({
      params: Promise.resolve({ leadId }),
      searchParams: Promise.resolve({ edit: roundId }),
    }));

    expect(html).toContain(`round:${roundId}:editing:true:closer:${closer.displayName}`);
    expect(html).toContain('data-active="interviews"');
  });
});
