import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentActorMock = vi.hoisted(() => vi.fn());
const getLeadMock = vi.hoisted(() => vi.fn());
const listLeadInterviewRoundsMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers({ cookie: "orbit_session=token" })) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("../../../../components/layout/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("../../../../components/interviews/interview-form", () => ({ InterviewForm: () => <p>interview-form</p> }));
vi.mock("../../../../components/interviews/interview-edit-form", () => ({
  InterviewRoundCard: ({ round, initiallyEditing }: { round: { id: string }; initiallyEditing?: boolean }) => <p>{`round:${round.id}:editing:${String(initiallyEditing)}`}</p>,
}));
vi.mock("../../../../lib/api-client", () => ({
  getCurrentActor: getCurrentActorMock,
  getLead: getLeadMock,
  listLeadInterviewRounds: listLeadInterviewRoundsMock,
  listUsers: vi.fn(async () => []),
  listCloserEligibility: vi.fn(async () => []),
  ApiClientError: class ApiClientError extends Error {},
}));

import LeadInterviewsRoute from "./page";

const actor = { id: "00000000-0000-4000-8000-000000000001", displayName: "Ayesha", email: "ayesha@orbit.test", role: "BD" as const, isActive: true };
const leadId = "00000000-0000-4000-8000-000000000101";
const roundId = "00000000-0000-4000-8000-000000000201";

describe("LeadInterviewsRoute", () => {
  beforeEach(() => {
    getCurrentActorMock.mockResolvedValue(actor);
    getLeadMock.mockResolvedValue({ id: leadId, profileId: "00000000-0000-4000-8000-000000000301", jobTitle: "Platform Engineer" });
    listLeadInterviewRoundsMock.mockResolvedValue([{ id: roundId, status: "SCHEDULED" }]);
  });

  it("opens the interview selected by the BD quick-action edit query", async () => {
    const html = renderToStaticMarkup(await LeadInterviewsRoute({
      params: Promise.resolve({ leadId }),
      searchParams: Promise.resolve({ edit: roundId }),
    }));

    expect(html).toContain(`round:${roundId}:editing:true`);
  });
});
