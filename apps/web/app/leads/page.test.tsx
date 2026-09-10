import type { CompanySummary, LeadSummary, SessionUser } from "@orbit/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentActor: vi.fn(),
  listCompanies: vi.fn(),
  listLeads: vi.fn(),
  listProfiles: vi.fn(),
  listUsers: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers({ cookie: "orbit_session=token" })) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/link", () => ({ default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a> }));
vi.mock("next/form", () => ({
  default: ({ children, action, scroll: _scroll, ...props }: React.FormHTMLAttributes<HTMLFormElement> & { action: string; scroll?: boolean }) => <form action={action} {...props}>{children}</form>,
}));
vi.mock("../../components/layout/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("../../components/leads/lead-page-actions", () => ({ LeadPageActions: () => null }));
vi.mock("../../components/data/csv-export-button", () => ({ CsvExportButton: () => null }));
vi.mock("../../lib/api-client", () => ({
  ApiClientError: class ApiClientError extends Error {},
  ...mocks,
}));

import LeadsRoute from "./page";

const bd: SessionUser = {
  id: "10000000-0000-4000-8000-000000000001",
  role: "BD",
  displayName: "Maya Brooks",
  email: "maya@orbit.test",
  isActive: true,
  timezone: "America/New_York",
};

const company: CompanySummary = {
  id: "20000000-0000-4000-8000-000000000001",
  canonicalName: "Northstar Labs",
  website: "https://northstar.example",
  domain: "northstar.example",
  industry: "Technology",
  location: "New York",
  createdAt: "2026-09-08T14:00:00.000Z",
  updatedAt: "2026-09-08T14:00:00.000Z",
  version: 1,
};

const lead: LeadSummary = {
  id: "30000000-0000-4000-8000-000000000001",
  profileId: "40000000-0000-4000-8000-000000000001",
  companyId: company.id,
  sourceId: "50000000-0000-4000-8000-000000000001",
  createdById: bd.id,
  currentOwnerId: bd.id,
  responsibleCloserId: null,
  archivedById: null,
  closedById: null,
  jobTitle: "Platform Engineer",
  companyName: "Northstar Labs",
  description: null,
  rawUrl: "https://northstar.example/jobs/platform-engineer",
  canonicalUrl: "https://northstar.example/jobs/platform-engineer",
  canonicalHash: null,
  location: "New York",
  workplaceType: "Hybrid",
  employmentType: "Full-time",
  contractType: null,
  compensationMin: null,
  compensationMax: null,
  compensationCurrency: null,
  compensationPeriod: null,
  appliedDate: "2026-09-08",
  status: "INTERVIEWING",
  isImportant: false,
  closureReason: null,
  closureNotes: null,
  closedAt: null,
  placedAt: null,
  startDate: null,
  startedAt: null,
  archivedAt: null,
  archiveReason: null,
  createdAt: "2026-09-08T14:00:00.000Z",
  updatedAt: "2026-09-08T14:00:00.000Z",
  version: 1,
};

describe("LeadsRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentActor.mockResolvedValue(bd);
    mocks.listCompanies.mockResolvedValue([company]);
    mocks.listLeads.mockResolvedValue({ items: [lead], nextCursor: null });
    mocks.listProfiles.mockResolvedValue({ items: [], nextCursor: null });
    mocks.listUsers.mockResolvedValue([]);
  });

  it("renders one role-scoped operational directory for mobile and desktop", async () => {
    const html = renderToStaticMarkup(await LeadsRoute({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("My applications");
    expect(html).toContain('aria-label="Filter applications"');
    expect(html).toContain('name="search"');
    expect(html).toContain('name="pipelineStage"');
    expect(html).toContain('aria-label="Application cards"');
    expect(html).toContain('aria-label="Application records"');
    expect(html).toContain("Platform Engineer");
  });

  it("normalizes URL filters and sends them with the page limit", async () => {
    await LeadsRoute({
      searchParams: Promise.resolve({
        cursor: ["  next-cursor  ", "ignored"],
        pipelineStage: ["INTERVIEW", "ACTIVE"],
        search: ["  Northstar  ", "ignored"],
      }),
    });

    expect(mocks.listLeads).toHaveBeenCalledWith({
      cursor: "next-cursor",
      limit: 50,
      pipelineStage: "INTERVIEW",
      search: "Northstar",
    }, "orbit_session=token");
  });

  it("preserves active filters in cursor pagination", async () => {
    mocks.listLeads.mockResolvedValue({ items: [lead], nextCursor: "next-cursor" });

    const html = renderToStaticMarkup(await LeadsRoute({
      searchParams: Promise.resolve({ search: "Northstar", pipelineStage: "INTERVIEW" }),
    }));

    expect(html).toContain("Next 50");
    expect(html).toContain("/leads?search=Northstar&amp;pipelineStage=INTERVIEW&amp;cursor=next-cursor");
  });

  it("distinguishes filtered and unfiltered empty states", async () => {
    mocks.listLeads.mockResolvedValue({ items: [], nextCursor: null });

    const filteredHtml = renderToStaticMarkup(await LeadsRoute({ searchParams: Promise.resolve({ search: "Acme" }) }));
    const emptyHtml = renderToStaticMarkup(await LeadsRoute({ searchParams: Promise.resolve({}) }));

    expect(filteredHtml).toContain("No applications match these filters");
    expect(filteredHtml).toContain("Clear filters");
    expect(emptyHtml).toContain("No applications yet");
  });

  it("labels the Admin directory as the complete application scope", async () => {
    mocks.getCurrentActor.mockResolvedValue({ ...bd, role: "ADMIN" });

    const html = renderToStaticMarkup(await LeadsRoute({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("All applications");
  });
});
