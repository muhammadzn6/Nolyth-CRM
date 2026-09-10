import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CommunicationTimeline } from "./communication-timeline";

const contactId = "80000000-0000-4000-8000-000000000001";
const base = {
  id: "90000000-0000-4000-8000-000000000001",
  leadId: "30000000-0000-4000-8000-000000000001",
  contactId,
  authorId: "10000000-0000-4000-8000-000000000001",
  type: "EMAIL" as const,
  direction: "INBOUND" as const,
  subject: "Technical interview",
  body: "Recruiter requested availability.",
  occurredAt: "2026-09-08T14:00:00.000Z",
  outcome: "Interview requested",
  visibility: "INTERNAL_TEAM" as const,
  nextActionSummary: "Send availability",
  nextActionDueAt: "2026-09-08T16:00:00.000Z",
  archivedAt: null,
  version: 1,
  createdAt: "2026-09-08T14:00:00.000Z",
  updatedAt: "2026-09-08T14:00:00.000Z",
};

describe("CommunicationTimeline", () => {
  it("groups adjacent normalized subjects and renders complete localized metadata", () => {
    const html = renderToStaticMarkup(<CommunicationTimeline
      contacts={[{ id: contactId, name: "Jordan Lee" }] as never}
      items={[base, { ...base, id: "90000000-0000-4000-8000-000000000002", subject: " technical   interview ", direction: "OUTBOUND", occurredAt: "2026-09-08T15:00:00.000Z" }]}
      timeZone="America/New_York"
    />);

    expect(html.match(/data-communication-thread=/g)).toHaveLength(1);
    expect(html).toContain("Inbound Email");
    expect(html).toContain("Outbound Email");
    expect(html.toLowerCase()).toContain("technical interview");
    expect(html).toContain("Interview requested");
    expect(html).toContain("Recruiter requested availability.");
    expect(html).toContain("Jordan Lee");
    expect(html).toContain("Sep 8, 2026");
    expect(html).toContain("10:00 AM");
    expect(html).toContain("Send availability");
    expect(html).not.toContain("2026-09-08T14:00:00.000Z");
  });

  it("humanizes channel labels, keeps newest entries first, and treats internal notes neutrally", () => {
    const html = renderToStaticMarkup(<CommunicationTimeline
      contacts={[]}
      items={[
        { ...base, id: "90000000-0000-4000-8000-000000000003", type: "JOB_PLATFORM", direction: "OUTBOUND", subject: null, body: "Older entry", occurredAt: "2026-09-08T10:00:00.000Z" },
        { ...base, id: "90000000-0000-4000-8000-000000000004", type: "NOTE", direction: "INTERNAL", subject: null, body: "Newest entry", occurredAt: "2026-09-08T16:00:00.000Z" },
      ]}
      timeZone="UTC"
    />);

    expect(html).toContain("Outbound Job Platform");
    expect(html.indexOf("Newest entry")).toBeLessThan(html.indexOf("Older entry"));
    expect(html).toContain("bg-surface-subtle");
    expect(html).not.toContain("bg-warning-soft");
  });
});
