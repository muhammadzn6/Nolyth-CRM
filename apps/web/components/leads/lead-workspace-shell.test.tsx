import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { LeadDetail } from "@orbit/contracts";

vi.mock("next/link", () => ({ default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a> }));

import { LeadWorkspaceShell } from "./lead-workspace-shell";

const lead = {
  id: "30000000-0000-4000-8000-000000000001",
  jobTitle: "Senior Platform Engineer",
  status: "INTERVIEWING",
  appliedDate: "2026-09-02",
  updatedAt: "2026-09-08T12:00:00.000Z",
  company: { canonicalName: "Northstar Labs" },
  profile: {
    id: "40000000-0000-4000-8000-000000000001",
    name: "Avery Chen — Platform Engineer",
    candidate: { id: "20000000-0000-4000-8000-000000000001", firstName: "Avery", lastName: "Chen", preferredName: null },
  },
  sourceRef: { id: "50000000-0000-4000-8000-000000000001", name: "LinkedIn" },
  currentOwner: { id: "10000000-0000-4000-8000-000000000001", displayName: "Maya Brooks", email: "maya@orbit.local" },
  responsibleCloser: { id: "10000000-0000-4000-8000-000000000002", displayName: "Noah Patel", email: "noah@orbit.local" },
} as unknown as LeadDetail;

describe("LeadWorkspaceShell", () => {
  it("keeps application identity, lifecycle, and role-aware navigation together", () => {
    const html = renderToStaticMarkup(<LeadWorkspaceShell activeSection="interviews" actorRole="CLOSER" lead={lead}><p>Rounds</p></LeadWorkspaceShell>);

    expect(html).toContain("Avery Chen");
    expect(html).toContain("Senior Platform Engineer");
    expect(html).toContain("Northstar Labs");
    expect(html).toContain("Application progress");
    expect(html).toContain('aria-current="page"');
    expect(html).toContain(`/leads/${lead.id}/interviews`);
    expect(html).toContain(`/leads/${lead.id}/communications`);
    expect(html).not.toContain(`/leads/${lead.id}/offers`);
  });

  it("includes Overview and Offers for Admin while containing long tab rows", () => {
    const html = renderToStaticMarkup(<LeadWorkspaceShell activeSection="overview" actorRole="ADMIN" lead={lead}><p>Overview body</p></LeadWorkspaceShell>);

    expect(html).toContain(`href="/leads/${lead.id}"`);
    expect(html).toContain(`/leads/${lead.id}/offers`);
    expect(html).toContain("grid-cols-3 gap-1 py-2 sm:flex");
    expect(html).not.toContain("overflow-x-auto");
    expect(html).toContain("min-w-0");
  });
});
