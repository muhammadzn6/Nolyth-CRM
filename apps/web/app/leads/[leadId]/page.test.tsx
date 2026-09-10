import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentActorMock = vi.hoisted(() => vi.fn());
const getLeadMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers({ cookie: "orbit_session=token" })) }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("../../../components/layout/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("../../../components/leads/lead-closer-assignment", () => ({ LeadCloserAssignment: () => null }));
vi.mock("../../../components/leads/lead-edit-action", () => ({ LeadEditAction: () => <button>Edit application</button> }));
vi.mock("../../../components/leads/lead-workspace-shell", () => ({ LeadWorkspaceShell: ({ activeSection, children, headerAction }: { activeSection: string; children: React.ReactNode; headerAction?: React.ReactNode }) => <section data-active={activeSection}>{headerAction}{children}</section> }));
vi.mock("../../../components/leads/job-link-actions", () => ({ JobLinkActions: () => <span>jobs.example</span> }));
vi.mock("../../../lib/api-client", () => ({
  ApiClientError: class ApiClientError extends Error {},
  getCurrentActor: getCurrentActorMock,
  getLead: getLeadMock,
  listCloserEligibility: vi.fn(async () => []),
  listUsers: vi.fn(async () => []),
}));

import LeadDetailRoute from "./page";

const leadId = "30000000-0000-4000-8000-000000000001";

describe("LeadDetailRoute", () => {
  beforeEach(() => {
    getCurrentActorMock.mockResolvedValue({
      id: "10000000-0000-4000-8000-000000000002",
      displayName: "Noah Patel",
      email: "noah@orbit.local",
      role: "CLOSER",
      isActive: true,
    });
    getLeadMock.mockResolvedValue({
      id: leadId,
      profileId: "40000000-0000-4000-8000-000000000001",
      responsibleCloserId: "10000000-0000-4000-8000-000000000002",
      jobTitle: "Platform Engineer",
      appliedDate: "2026-09-08",
      rawUrl: "https://jobs.example/platform-engineer",
      canonicalUrl: "https://jobs.example/platform-engineer",
      status: "INTERVIEWING",
      updatedAt: "2026-09-08T12:00:00.000Z",
      location: null,
      workplaceType: null,
      compensationMin: "120000",
      compensationMax: "150000",
      compensationCurrency: "USD",
      compensationPeriod: "YEARLY",
      company: { canonicalName: "Northstar Labs" },
      profile: {
        id: "40000000-0000-4000-8000-000000000001",
        name: "Avery Chen — Senior Platform Engineer",
        candidate: { id: "20000000-0000-4000-8000-000000000001", firstName: "Avery", lastName: "Chen", preferredName: null },
      },
      sourceRef: { id: "50000000-0000-4000-8000-000000000001", name: "LinkedIn" },
      currentOwner: { id: "10000000-0000-4000-8000-000000000003", displayName: "Maya Brooks", email: "maya@orbit.local" },
      responsibleCloser: { id: "10000000-0000-4000-8000-000000000002", displayName: "Noah Patel", email: "noah@orbit.local" },
      contacts: [{
        id: "70000000-0000-4000-8000-000000000001",
        role: "RECRUITER",
        isPrimary: true,
        contact: {
          id: "80000000-0000-4000-8000-000000000001",
          name: "Jordan Lee",
          title: "Technical Recruiter",
          email: "jordan@example.test",
        },
      }],
    });
  });

  it("renders nested recruiter details and role-appropriate workspace links", async () => {
    const html = renderToStaticMarkup(await LeadDetailRoute({ params: Promise.resolve({ leadId }) }));

    expect(html).toContain("Jordan Lee");
    expect(html).toContain("Technical Recruiter");
    expect(html).toContain("jordan@example.test");
    expect(html).toContain('data-active="overview"');
    expect(html).toContain("Maya Brooks");
    expect(html).toContain("Noah Patel");
    expect(html).toContain("Salary range");
    expect(html).toContain("$120,000.00");
    expect(html).not.toContain("Edit application");
    expect(html).not.toContain("Application source");
  });

  it("offers application editing to the BD owner", async () => {
    getCurrentActorMock.mockResolvedValue({
      id: "10000000-0000-4000-8000-000000000003",
      displayName: "Maya Brooks",
      email: "maya@orbit.local",
      role: "BD",
      isActive: true,
    });

    const html = renderToStaticMarkup(await LeadDetailRoute({ params: Promise.resolve({ leadId }) }));

    expect(html).toContain("Edit application");
  });
});
