// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionUser } from "@orbit/contracts";

import { PerformanceRulesForm } from "./performance-rules-form";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const {
  createPerformanceHolidayMock,
  deletePerformanceApprovedLeaveMock,
  deletePerformanceHolidayMock,
  createPerformanceApprovedLeaveMock,
  getDuplicateReviewsMock,
  getPerformanceRuleHistoryMock,
  getPerformanceRulesMock,
  listBdTargetSchedulesMock,
  listPerformanceApprovedLeavesMock,
  listPerformanceHolidaysMock,
  listUsersMock,
  previewPerformanceRulesMock,
  reviewDuplicateOverrideMock,
  updatePerformanceApprovedLeaveMock,
  updatePerformanceHolidayMock,
  updatePerformanceRulesMock,
  updateBdTargetScheduleMock,
} = vi.hoisted(() => ({
  createPerformanceHolidayMock: vi.fn(),
  deletePerformanceApprovedLeaveMock: vi.fn(),
  deletePerformanceHolidayMock: vi.fn(),
  createPerformanceApprovedLeaveMock: vi.fn(),
  getDuplicateReviewsMock: vi.fn(),
  getPerformanceRuleHistoryMock: vi.fn(),
  getPerformanceRulesMock: vi.fn(),
  listBdTargetSchedulesMock: vi.fn(),
  listPerformanceApprovedLeavesMock: vi.fn(),
  listPerformanceHolidaysMock: vi.fn(),
  listUsersMock: vi.fn(),
  previewPerformanceRulesMock: vi.fn(),
  reviewDuplicateOverrideMock: vi.fn(),
  updatePerformanceApprovedLeaveMock: vi.fn(),
  updatePerformanceHolidayMock: vi.fn(),
  updatePerformanceRulesMock: vi.fn(),
  updateBdTargetScheduleMock: vi.fn(),
}));

vi.mock("../../lib/api-client", () => ({
  ApiClientError: class ApiClientError extends Error {},
  createPerformanceHoliday: createPerformanceHolidayMock,
  deletePerformanceApprovedLeave: deletePerformanceApprovedLeaveMock,
  deletePerformanceHoliday: deletePerformanceHolidayMock,
  createPerformanceApprovedLeave: createPerformanceApprovedLeaveMock,
  getDuplicateReviews: getDuplicateReviewsMock,
  getPerformanceRuleHistory: getPerformanceRuleHistoryMock,
  getPerformanceRules: getPerformanceRulesMock,
  listBdTargetSchedules: listBdTargetSchedulesMock,
  listPerformanceApprovedLeaves: listPerformanceApprovedLeavesMock,
  listPerformanceHolidays: listPerformanceHolidaysMock,
  listUsers: listUsersMock,
  previewPerformanceRules: previewPerformanceRulesMock,
  reviewDuplicateOverride: reviewDuplicateOverrideMock,
  updatePerformanceApprovedLeave: updatePerformanceApprovedLeaveMock,
  updatePerformanceHoliday: updatePerformanceHolidayMock,
  updatePerformanceRules: updatePerformanceRulesMock,
  updateBdTargetSchedule: updateBdTargetScheduleMock,
}));

const admin: SessionUser = {
  id: "00000000-0000-4000-8000-000000000001",
  displayName: "Maya Chen",
  email: "maya@orbit.example",
  role: "ADMIN",
  isActive: true,
};

const bd: SessionUser = {
  ...admin,
  id: "00000000-0000-4000-8000-000000000002",
  displayName: "Avery Morgan",
  email: "avery@orbit.example",
  role: "BD",
};

const rule = {
  id: "10000000-0000-4000-8000-000000000001",
  effectiveFrom: "2026-09-10T00:00:00.000Z",
  effectiveTo: null,
  defaultDailyTarget: 70,
  workingDays: [1, 2, 3, 4, 5],
  businessCalendarTimeZone: "Asia/Karachi",
  workdayStartHour: 9,
  workdayEndHour: 17,
  followUpSlaBusinessHours: 48,
  adminReassignmentSlaBusinessHours: 2,
  maturityWindowDays: 21,
  duplicateLookbackMonths: 6,
  applicationWeightPercent: 45,
  followUpWeightPercent: 25,
  outcomeWeightPercent: 30,
  positiveReplyPoints: 1,
  screeningPoints: 2,
  interviewPoints: 3,
  offerPoints: 5,
  slowdownThresholdPercent: 120,
  slowdownMultiplierPercent: 25,
  auditMetadata: { source: "admin" },
  createdById: admin.id,
  version: 3,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-02T00:00:00.000Z",
};

const target = {
  id: "20000000-0000-4000-8000-000000000001",
  bdId: bd.id,
  dailyTarget: 82,
  effectiveFrom: "2026-09-10T00:00:00.000Z",
  effectiveTo: null,
  auditMetadata: null,
  createdById: admin.id,
  version: 1,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const holiday = {
  id: "20000000-0000-4000-8000-000000000001",
  holidayDate: "2026-12-25",
  name: "Winter holiday",
  createdById: admin.id,
  auditMetadata: { source: "admin" },
  version: 2,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-02T00:00:00.000Z",
};

const leaveRecord = {
  id: "20000000-0000-4000-8000-000000000002",
  bdId: bd.id,
  startsAt: "2026-12-20T09:00:00.000Z",
  endsAt: "2026-12-21T17:00:00.000Z",
  reason: "Conference",
  availableStartHour: 10,
  availableEndHour: 14,
  approvedById: admin.id,
  approvedAt: "2026-09-01T00:00:00.000Z",
  auditMetadata: null,
  version: 3,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-02T00:00:00.000Z",
};

const review = {
  id: "30000000-0000-4000-8000-000000000001",
  leadId: "40000000-0000-4000-8000-000000000001",
  classification: "LIKELY" as const,
  status: "PENDING" as const,
  overrideReason: "The employer reposted the role.",
  reviewerId: null,
  reviewReason: null,
  reviewedAt: null,
  expiresAt: "2026-09-09T00:00:00.000Z",
  overdueAt: null,
  provisionalCreditGranted: true,
  provisionalCreditResolvedAt: null,
  createdById: bd.id,
  auditMetadata: null,
  version: 1,
  createdAt: "2026-09-06T00:00:00.000Z",
  updatedAt: "2026-09-06T00:00:00.000Z",
  lead: {
    id: "40000000-0000-4000-8000-000000000001",
    profileId: "50000000-0000-4000-8000-000000000001",
    createdById: bd.id,
    currentOwnerId: bd.id,
    companyName: "Northstar Labs",
    jobTitle: "Platform Engineer",
    appliedDate: "2026-09-06",
    status: "APPLIED" as const,
  },
};

const preview = {
  effectiveFrom: "2026-09-20T00:00:00.000Z",
  effectiveTo: null,
  affectedFrom: "2026-09-20T00:00:00.000Z",
  affectedTo: "2027-09-20T00:00:00.000Z",
  projection: {
    kind: "TARGET_AND_CONFIGURATION" as const,
    exactFutureScoresAvailable: false as const,
    unavailableExactScoreDimensions: ["QUALIFIED_APPLICATIONS", "FOLLOW_UP_COMPLETION", "RECRUITER_OUTCOMES", "BALANCED_SCORE"] as const,
  },
  configuration: {
    current: { ...rule, effectiveTo: undefined, id: undefined, auditMetadata: undefined, createdById: undefined, version: undefined, createdAt: undefined, updatedAt: undefined },
    proposed: { ...rule, defaultDailyTarget: 75, effectiveFrom: "2026-09-20T00:00:00.000Z", effectiveTo: undefined, id: undefined, auditMetadata: undefined, createdById: undefined, version: undefined, createdAt: undefined, updatedAt: undefined },
  },
  impacts: [{ bdId: bd.id, currentTargetApplications: 70, proposedTargetApplications: 75, targetDelta: 5 }],
};

function change(element: HTMLInputElement | HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype,
    "value",
  )?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("PerformanceRulesForm", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    getPerformanceRulesMock.mockResolvedValue(rule);
    getPerformanceRuleHistoryMock.mockResolvedValue([rule, {
      ...rule,
      id: "10000000-0000-4000-8000-000000000009",
      effectiveFrom: "2026-08-01T00:00:00.000Z",
      effectiveTo: "2026-09-10T00:00:00.000Z",
      version: 2,
      createdById: bd.id,
      auditMetadata: { reason: "Initial policy" },
    }]);
    listUsersMock.mockResolvedValue([
      { ...admin, timezone: "Asia/Karachi", lastLoginAt: null },
      { ...bd, timezone: "Asia/Karachi", lastLoginAt: null },
    ]);
    listBdTargetSchedulesMock.mockResolvedValue([target]);
    listPerformanceHolidaysMock.mockResolvedValue([holiday]);
    listPerformanceApprovedLeavesMock.mockResolvedValue([leaveRecord]);
    getDuplicateReviewsMock.mockResolvedValue([review]);
    previewPerformanceRulesMock.mockResolvedValue(preview);
    updatePerformanceRulesMock.mockResolvedValue({ ...rule, defaultDailyTarget: 75 });
    createPerformanceHolidayMock.mockResolvedValue({});
    createPerformanceApprovedLeaveMock.mockResolvedValue({
      id: "60000000-0000-4000-8000-000000000001",
      bdId: bd.id,
      startsAt: "2026-09-21T09:00:00.000Z",
      endsAt: "2026-09-22T17:00:00.000Z",
      reason: "Conference",
      availableStartHour: 10,
      availableEndHour: 14,
      approvedById: admin.id,
      approvedAt: "2026-09-10T00:00:00.000Z",
      auditMetadata: null,
      version: 1,
      createdAt: "2026-09-10T00:00:00.000Z",
      updatedAt: "2026-09-10T00:00:00.000Z",
    });
    reviewDuplicateOverrideMock.mockResolvedValue({ ...review, status: "APPROVED" });
    updateBdTargetScheduleMock.mockResolvedValue({ ...target, dailyTarget: 90 });
    updatePerformanceHolidayMock.mockResolvedValue({ ...holiday, name: "Observed winter holiday", version: 3 });
    deletePerformanceHolidayMock.mockResolvedValue(undefined);
    updatePerformanceApprovedLeaveMock.mockResolvedValue({ ...leaveRecord, reason: "Client conference", version: 4 });
    deletePerformanceApprovedLeaveMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  async function render(actor: SessionUser = admin) {
    await act(async () => {
      root.render(<PerformanceRulesForm actor={actor} />);
    });
  }

  it("blocks non-admin actors before requesting performance data", async () => {
    await render(bd);

    expect(container.textContent).toContain("Access restricted");
    expect(getPerformanceRulesMock).not.toHaveBeenCalled();
  });

  it("loads current rules, individual BD targets, leave controls, holidays, and pending overrides", async () => {
    await render();

    expect(container.textContent).toContain("Performance rules");
    expect(container.textContent).toContain("Version 3");
    expect(container.textContent).toContain("Avery Morgan");
    expect(container.textContent).toContain("82 applications / day");
    expect(container.textContent).toContain("Holiday calendar");
    expect(container.textContent).toContain("Approved leave and reduced schedules");
    expect(container.textContent).toContain("Northstar Labs");
    expect(container.textContent).toContain("Provisional credit");
  });

  it("validates score weights and previews the server-calculated future impact before confirmation", async () => {
    await render();

    await act(async () => {
      change(container.querySelector<HTMLInputElement>("#applicationWeightPercent")!, "50");
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>("[data-action='preview-rules']")?.click();
    });
    expect(container.textContent).toContain("Weights must total 100%");
    expect(previewPerformanceRulesMock).not.toHaveBeenCalled();

    await act(async () => {
      change(container.querySelector<HTMLInputElement>("#applicationWeightPercent")!, "45");
      change(container.querySelector<HTMLInputElement>("#rule-effective-from")!, "2026-09-20T00:00");
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>("[data-action='preview-rules']")?.click();
    });

    expect(previewPerformanceRulesMock).toHaveBeenCalled();
    expect(container.textContent).toContain("Impact preview");
    expect(container.textContent).toContain("5 more applications");
    expect(updatePerformanceRulesMock).not.toHaveBeenCalled();
  });

  it("requires an explicit confirmation before saving a future-effective rule version", async () => {
    await render();
    await act(async () => {
      change(container.querySelector<HTMLInputElement>("#rule-effective-from")!, "2026-09-20T00:00");
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>("[data-action='preview-rules']")?.click();
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>("[data-action='save-rules']")?.click();
    });
    expect(container.textContent).toContain("Confirm the impact preview before saving");
    expect(updatePerformanceRulesMock).not.toHaveBeenCalled();

    await act(async () => {
      container.querySelector<HTMLInputElement>("#confirm-rule-impact")?.click();
      container.querySelector<HTMLButtonElement>("[data-action='save-rules']")?.click();
    });
    expect(updatePerformanceRulesMock).toHaveBeenCalledWith(expect.objectContaining({
      id: rule.id,
      expectedVersion: rule.version,
      effectiveFrom: "2026-09-20T00:00:00.000Z",
    }));
  });

  it("edits BD targets and configures holidays and reduced leave", async () => {
    await render();

    await act(async () => {
      change(container.querySelector<HTMLInputElement>(`#bd-target-${target.id}`)!, "90");
      container.querySelector<HTMLButtonElement>("[data-action='save-bd-target']")?.click();
    });
    expect(updateBdTargetScheduleMock).toHaveBeenCalledWith(target.id, expect.objectContaining({ dailyTarget: 90, expectedVersion: target.version }));

    await act(async () => {
      change(container.querySelector<HTMLInputElement>("#holiday-date")!, "2026-12-25");
      change(container.querySelector<HTMLInputElement>("#holiday-name")!, "Winter holiday");
      container.querySelector<HTMLButtonElement>("[data-action='add-holiday']")?.click();
    });
    expect(createPerformanceHolidayMock).toHaveBeenCalledWith({ holidayDate: "2026-12-25", name: "Winter holiday" });

    await act(async () => {
      change(container.querySelector<HTMLSelectElement>("#leave-bd")!, bd.id);
      change(container.querySelector<HTMLInputElement>("#leave-start")!, "2026-09-21T09:00");
      change(container.querySelector<HTMLInputElement>("#leave-end")!, "2026-09-22T17:00");
      change(container.querySelector<HTMLInputElement>("#leave-start-hour")!, "10");
      change(container.querySelector<HTMLInputElement>("#leave-end-hour")!, "14");
      container.querySelector<HTMLButtonElement>("[data-action='save-leave']")?.click();
    });
    expect(createPerformanceApprovedLeaveMock).toHaveBeenCalledWith(expect.objectContaining({
      bdId: bd.id,
      startsAt: "2026-09-21T09:00:00.000Z",
      endsAt: "2026-09-22T17:00:00.000Z",
      availableStartHour: 10,
      availableEndHour: 14,
    }));
  });

  it("requires a review reason before resolving a pending duplicate override", async () => {
    await render();

    await act(async () => {
      container.querySelector<HTMLButtonElement>("[data-review-decision='REJECTED']")?.click();
    });
    expect(container.textContent).toContain("A decision reason is required");
    expect(reviewDuplicateOverrideMock).not.toHaveBeenCalled();

    await act(async () => {
      change(container.querySelector<HTMLInputElement>(`#review-reason-${review.id}`)!, "Same canonical job posting.");
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>("[data-review-decision='REJECTED']")?.click();
    });
    expect(reviewDuplicateOverrideMock).toHaveBeenCalledWith(review.id, {
      status: "REJECTED",
      reviewReason: "Same canonical job posting.",
      expectedVersion: review.version,
    });
  });

  it("edits future business-calendar records and shows a historical-protection error from the API", async () => {
    updatePerformanceHolidayMock.mockRejectedValueOnce(new Error("Started holidays cannot rewrite historical performance"));
    await render();

    await act(async () => {
      container.querySelector<HTMLButtonElement>(`[data-action='edit-holiday-${holiday.id}']`)?.click();
      change(container.querySelector<HTMLInputElement>("#holiday-name")!, "Observed winter holiday");
      container.querySelector<HTMLButtonElement>("[data-action='save-holiday']")?.click();
    });
    expect(updatePerformanceHolidayMock).toHaveBeenCalledWith(holiday.id, {
      holidayDate: holiday.holidayDate,
      name: "Observed winter holiday",
      expectedVersion: holiday.version,
    });
    expect(container.textContent).toContain("Started holidays cannot rewrite historical performance");

    await act(async () => {
      container.querySelector<HTMLButtonElement>(`[data-action='edit-leave-${leaveRecord.id}']`)?.click();
      change(container.querySelector<HTMLInputElement>("#leave-reason")!, "Client conference");
      container.querySelector<HTMLButtonElement>("[data-action='save-leave']")?.click();
    });
    expect(updatePerformanceApprovedLeaveMock).toHaveBeenCalledWith(leaveRecord.id, expect.objectContaining({
      bdId: bd.id,
      reason: "Client conference",
      expectedVersion: leaveRecord.version,
    }));

    await act(async () => {
      container.querySelector<HTMLButtonElement>(`[data-action='delete-holiday-${holiday.id}']`)?.click();
      container.querySelector<HTMLButtonElement>(`[data-action='delete-leave-${leaveRecord.id}']`)?.click();
    });
    expect(deletePerformanceHolidayMock).toHaveBeenCalledWith(holiday.id, holiday.version);
    expect(deletePerformanceApprovedLeaveMock).toHaveBeenCalledWith(leaveRecord.id, leaveRecord.version + 1);
  });

  it("renders ordered rule provenance and exposes field-level timezone and numeric validation", async () => {
    await render();

    expect(container.textContent).toContain("Rule version history");
    expect(container.textContent).toContain("Version 2");
    expect(container.textContent).toContain("Maya Chen");

    await act(async () => {
      change(container.querySelector<HTMLInputElement>("#businessCalendarTimeZone")!, "Not/AZone");
      change(container.querySelector<HTMLInputElement>("#applicationWeightPercent")!, "101");
      container.querySelector<HTMLButtonElement>("[data-action='preview-rules']")?.click();
    });
    const timezone = container.querySelector<HTMLInputElement>("#businessCalendarTimeZone")!;
    const applicationWeight = container.querySelector<HTMLInputElement>("#applicationWeightPercent")!;
    expect(timezone.getAttribute("aria-invalid")).toBe("true");
    expect(timezone.getAttribute("aria-describedby")).toBe("businessCalendarTimeZone-error");
    expect(applicationWeight.getAttribute("aria-invalid")).toBe("true");
    expect(applicationWeight.getAttribute("max")).toBe("100");
    expect(container.textContent).toContain("Business calendar timezone must be a valid IANA timezone");
  });
});
