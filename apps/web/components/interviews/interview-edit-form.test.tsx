import { renderToStaticMarkup } from "react-dom/server";
import type { InterviewSummary } from "@orbit/contracts";
import { describe, expect, it } from "vitest";

import { InterviewRoundCard } from "./interview-edit-form";

const round = {
  id: "00000000-0000-4000-8000-000000000401",
  leadId: "00000000-0000-4000-8000-000000000201",
  roundNumber: 1,
  roundType: "TECHNICAL",
  startsAt: "2026-09-08T09:00:00.000Z",
  endsAt: "2026-09-08T10:00:00.000Z",
  timezone: "Asia/Karachi",
  status: "SCHEDULED",
  closerId: "00000000-0000-4000-8000-000000000501",
  creatorId: "00000000-0000-4000-8000-000000000101",
  interviewer: "Jordan Lee",
  location: null,
  meetingLink: null,
  preparationNotes: null,
  closerNotes: null,
  officialFeedback: null,
  officialResult: null,
  attendance: null,
  googleSyncStatus: "SYNCED",
  originalDatetimeText: "September 8, 2026 at 14:00",
  version: 1,
  createdAt: "2026-09-05T10:00:00.000Z",
  updatedAt: "2026-09-05T10:00:00.000Z",
} as InterviewSummary;

describe("InterviewRoundCard", () => {
  it("keeps BD cancellation controls available beside interview editing", () => {
    const html = renderToStaticMarkup(<InterviewRoundCard actorRole="BD" round={round} />);

    expect(html).toContain("Edit interview");
    expect(html).toContain("Cancellation reason");
    expect(html).toContain("Cancel");
    expect(html).not.toContain("Mark attended");
  });
});
