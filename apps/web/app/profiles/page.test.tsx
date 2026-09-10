import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProfileSummary } from "@orbit/contracts";

const api = vi.hoisted(() => ({
  getCurrentActor: vi.fn(),
  listProfiles: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers({ cookie: "orbit_session=token" })) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/link", () => ({ default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a> }));
vi.mock("../../components/layout/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("../../lib/api-client", () => ({
  ApiClientError: class ApiClientError extends Error {},
  getCurrentActor: api.getCurrentActor,
  listProfiles: api.listProfiles,
}));

import ProfilesRoute from "./page";

function textContent(html: string) {
  return html.replace(/<[^>]+>/g, "").replaceAll("&amp;", "&");
}

function profile(overrides: Partial<ProfileSummary> = {}): ProfileSummary {
  return {
    id: "20000000-0000-4000-8000-000000000001",
    candidateId: "30000000-0000-4000-8000-000000000001",
    name: "Senior Platform Search",
    description: "Backend and platform engineering opportunities",
    status: "ACTIVE",
    defaultCurrency: "USD",
    targetCompensation: "180000",
    compensationPeriod: "YEARLY",
    targetRoles: ["Platform Engineer", "Backend Engineer"],
    preferredLocations: ["New York", "Remote US"],
    workplacePreferences: ["REMOTE", "HYBRID"],
    jobTypePreferences: ["FULL_TIME"],
    contractPreferences: [],
    archivedAt: null,
    archiveReason: null,
    createdAt: "2026-09-01T12:00:00.000Z",
    updatedAt: "2026-09-08T12:00:00.000Z",
    version: 1,
    ...overrides,
  };
}

describe("ProfilesRoute", () => {
  beforeEach(() => {
    api.getCurrentActor.mockReset();
    api.getCurrentActor.mockResolvedValue({ id: "10000000-0000-4000-8000-000000000001", role: "ADMIN", displayName: "Orbit Admin", email: "admin@orbit.test", isActive: true });
    api.listProfiles.mockReset();
  });

  it("renders result counts and structured profile records", async () => {
    api.listProfiles.mockResolvedValue({
      items: [
        profile(),
        profile({ id: "20000000-0000-4000-8000-000000000002", name: "Product Search", status: "DRAFT" }),
        profile({ id: "20000000-0000-4000-8000-000000000003", name: "Data Search", status: "PAUSED" }),
        profile({ id: "20000000-0000-4000-8000-000000000004", name: "Archived Search", status: "ARCHIVED" }),
      ],
      nextCursor: null,
    });

    const html = renderToStaticMarkup(await ProfilesRoute({ searchParams: Promise.resolve({}) }));
    const text = textContent(html);

    expect(html).toContain('aria-label="Profile summary"');
    expect(text).toContain("4 shown");
    expect(text).toContain("1 active");
    expect(text).toContain("1 draft");
    expect(text).toContain("1 paused");
    expect(text).toContain("1 archived");
    expect(html).toContain('aria-label="Profile records"');
    expect(html).toContain("Target roles");
    expect(html).toContain("Locations &amp; work style");
    expect(html).toContain("Platform Engineer");
    expect(html).toContain("New York · Remote US");
    expect(html).toContain("Remote · Hybrid");
  });

  it("normalizes supported URL filters before loading profiles", async () => {
    api.listProfiles.mockResolvedValue({ items: [profile()], nextCursor: null });

    const html = renderToStaticMarkup(await ProfilesRoute({
      searchParams: Promise.resolve({ search: "  Platform  ", status: "ACTIVE" }),
    }));

    expect(api.listProfiles).toHaveBeenCalledWith(
      { search: "Platform", status: "ACTIVE", limit: 100 },
      "orbit_session=token",
    );
    expect(html).toContain('value="Platform"');
    expect(html).toContain('<option value="ACTIVE" selected="">Active</option>');
    expect(html).toContain('href="/profiles"');
  });

  it("shows a filter-aware empty state and ignores unsupported statuses", async () => {
    api.listProfiles.mockResolvedValue({ items: [], nextCursor: null });

    const html = renderToStaticMarkup(await ProfilesRoute({
      searchParams: Promise.resolve({ search: "  no match  ", status: "UNKNOWN" }),
    }));

    expect(api.listProfiles).toHaveBeenCalledWith(
      { search: "no match", limit: 100 },
      "orbit_session=token",
    );
    expect(html).toContain("No profiles match these filters");
    expect(html).toContain("Clear filters");
  });

  it("does not direct a Closer to create records when their scoped result is empty", async () => {
    api.getCurrentActor.mockResolvedValue({ id: "10000000-0000-4000-8000-000000000002", role: "CLOSER", displayName: "Noah", email: "noah@orbit.test", isActive: true });
    api.listProfiles.mockResolvedValue({ items: [], nextCursor: null });

    const html = renderToStaticMarkup(await ProfilesRoute({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("No assigned profiles");
    expect(html).not.toContain("Create a candidate");
  });
});
