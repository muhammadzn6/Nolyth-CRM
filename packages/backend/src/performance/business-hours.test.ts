import { describe, expect, it } from "vitest";

import {
  addBusinessHours,
  businessCalendarDate,
  businessHoursBetween,
  calculateProratedDailyTarget,
  calculateAdminReassignmentSla,
  calculateFollowUpSla,
  getEligibleWorkdayCapacity,
  isEligibleWorkingDay,
  nextEligibleWorkingDay,
  type BusinessHoursSchedule,
} from "./business-hours";

const schedule: BusinessHoursSchedule = {
  timeZone: "UTC",
  workingDays: [1, 2, 3, 4, 5],
  workday: { startHour: 9, endHour: 17 },
};

describe("businessHoursBetween", () => {
  it("excludes non-working weekend hours", () => {
    expect(businessHoursBetween(
      new Date("2026-09-04T16:00:00.000Z"),
      new Date("2026-09-07T10:00:00.000Z"),
      schedule,
    )).toBe(2);
  });

  it("excludes configured holidays and approved leave", () => {
    expect(businessHoursBetween(
      new Date("2026-09-07T09:00:00.000Z"),
      new Date("2026-09-09T17:00:00.000Z"),
      {
        ...schedule,
        holidays: [new Date("2026-09-08T00:00:00.000Z")],
        leaves: [{ startsAt: new Date("2026-09-07T09:00:00.000Z"), endsAt: new Date("2026-09-07T17:00:00.000Z") }],
      },
    )).toBe(8);
  });

  it("uses a reduced schedule instead of a full-day leave exclusion", () => {
    expect(businessHoursBetween(
      new Date("2026-09-08T09:00:00.000Z"),
      new Date("2026-09-08T17:00:00.000Z"),
      {
        ...schedule,
        leaves: [{
          startsAt: new Date("2026-09-08T00:00:00.000Z"),
          endsAt: new Date("2026-09-09T00:00:00.000Z"),
          availableHours: { startHour: 9, endHour: 13 },
        }],
      },
    )).toBe(4);
  });

  it("uses the configured IANA timezone across a US daylight-saving transition", () => {
    const newYorkSchedule: BusinessHoursSchedule = {
      timeZone: "America/New_York",
      workingDays: [1, 2, 3, 4, 5],
      workday: { startHour: 9, endHour: 17 },
    };

    expect(addBusinessHours(new Date("2026-03-06T21:00:00.000Z"), 2, newYorkSchedule)).toEqual(
      new Date("2026-03-09T14:00:00.000Z"),
    );
  });

  it("starts a spring-forward work window at the first valid local instant", () => {
    const springForwardSchedule: BusinessHoursSchedule = {
      timeZone: "America/New_York",
      workingDays: [0],
      workday: { startHour: 2, endHour: 8 },
    };

    expect(addBusinessHours(new Date("2026-03-08T05:00:00.000Z"), 1, springForwardSchedule)).toEqual(
      new Date("2026-03-08T08:00:00.000Z"),
    );
  });

  it("uses the first occurrence of an ambiguous fall-back local hour", () => {
    const fallBackSchedule: BusinessHoursSchedule = {
      timeZone: "America/New_York",
      workingDays: [0],
      workday: { startHour: 1, endHour: 8 },
    };

    expect(addBusinessHours(new Date("2026-11-01T04:00:00.000Z"), 1, fallBackSchedule)).toEqual(
      new Date("2026-11-01T06:00:00.000Z"),
    );
  });

  it("evaluates recurring work windows in the configured local timezone", () => {
    const karachiSchedule: BusinessHoursSchedule = {
      timeZone: "Asia/Karachi",
      workingDays: [1, 2, 3, 4, 5],
      workday: { startHour: 9, endHour: 17 },
    };

    expect(businessHoursBetween(
      new Date("2026-09-07T03:00:00.000Z"),
      new Date("2026-09-07T06:00:00.000Z"),
      karachiSchedule,
    )).toBe(2);
  });
});

describe("isEligibleWorkingDay", () => {
  it("preserves the persisted DATE calendar day for US target calculations", () => {
    const newYorkSchedule: BusinessHoursSchedule = {
      timeZone: "America/New_York",
      workingDays: [1, 2, 3, 4, 5],
      workday: { startHour: 9, endHour: 17 },
    };
    // PostgreSQL DATE values are materialized at UTC midnight by Prisma.
    const persistedMonday = new Date("2026-09-07T00:00:00.000Z");

    expect(getEligibleWorkdayCapacity(persistedMonday, newYorkSchedule)).toBe(1);
    expect(calculateProratedDailyTarget(70, persistedMonday, newYorkSchedule)).toBe(70);
  });

  it("excludes holidays and full approved leave from target-working-day eligibility", () => {
    const calendar: BusinessHoursSchedule = {
      ...schedule,
      holidays: [new Date("2026-09-08T00:00:00.000Z")],
      leaves: [{ startsAt: new Date("2026-09-09T00:00:00.000Z"), endsAt: new Date("2026-09-10T00:00:00.000Z") }],
    };

    expect(isEligibleWorkingDay(new Date("2026-09-07T12:00:00.000Z"), calendar)).toBe(true);
    expect(isEligibleWorkingDay(new Date("2026-09-08T12:00:00.000Z"), calendar)).toBe(false);
    expect(isEligibleWorkingDay(new Date("2026-09-09T12:00:00.000Z"), calendar)).toBe(false);
  });

  it("returns capacity and a prorated target for reduced leave", () => {
    const day = new Date("2026-09-08T12:00:00.000Z");
    const fullLeave: BusinessHoursSchedule = {
      ...schedule,
      leaves: [{ startsAt: new Date("2026-09-08T00:00:00.000Z"), endsAt: new Date("2026-09-09T00:00:00.000Z") }],
    };
    const halfDay: BusinessHoursSchedule = {
      ...schedule,
      leaves: [{
        startsAt: new Date("2026-09-08T00:00:00.000Z"),
        endsAt: new Date("2026-09-09T00:00:00.000Z"),
        availableHours: { startHour: 9, endHour: 13 },
      }],
    };

    expect(getEligibleWorkdayCapacity(day, fullLeave)).toBe(0);
    expect(calculateProratedDailyTarget(70, day, fullLeave)).toBe(0);
    expect(getEligibleWorkdayCapacity(day, halfDay)).toBe(0.5);
    expect(calculateProratedDailyTarget(70, day, halfDay)).toBe(35);
  });

  it("rejects reduced leave availability outside the configured workday", () => {
    expect(() => calculateProratedDailyTarget(70, new Date("2026-09-08T12:00:00.000Z"), {
      ...schedule,
      leaves: [{
        startsAt: new Date("2026-09-08T00:00:00.000Z"),
        endsAt: new Date("2026-09-09T00:00:00.000Z"),
        availableHours: { startHour: 8, endHour: 13 },
      }],
    })).toThrow("Reduced leave availability must fall within the configured workday");
  });
});

describe("follow-up SLA timing", () => {
  it("pauses the original BD follow-up clock when the item enters Needs Reassignment", () => {
    expect(calculateFollowUpSla({
      startedAt: new Date("2026-09-07T09:00:00.000Z"),
      pausedAt: new Date("2026-09-07T12:00:00.000Z"),
      requiredBusinessHours: 4,
      now: new Date("2026-09-07T17:00:00.000Z"),
      schedule,
    })).toEqual({
      status: "PAUSED_FOR_REASSIGNMENT",
      compliance: "PAUSED",
      breached: false,
      elapsedBusinessHours: 3,
      dueAt: new Date("2026-09-07T13:00:00.000Z"),
    });
  });

  it("keeps the original BD SLA paused even when Admin reassigns after leave ends", () => {
    const originalBdSchedule: BusinessHoursSchedule = {
      ...schedule,
      leaves: [{
        startsAt: new Date("2026-09-07T09:00:00.000Z"),
        endsAt: new Date("2026-09-07T12:00:00.000Z"),
      }],
    };

    expect(calculateFollowUpSla({
      startedAt: new Date("2026-09-07T09:00:00.000Z"),
      pausedAt: new Date("2026-09-07T09:00:00.000Z"),
      requiredBusinessHours: 4,
      now: new Date("2026-09-08T10:00:00.000Z"),
      schedule: originalBdSchedule,
    })).toMatchObject({
      status: "PAUSED_FOR_REASSIGNMENT",
      compliance: "PAUSED",
      elapsedBusinessHours: 0,
    });

    expect(calculateFollowUpSla({
      startedAt: new Date("2026-09-08T10:00:00.000Z"),
      requiredBusinessHours: 4,
      now: new Date("2026-09-08T11:00:00.000Z"),
      schedule,
    })).toMatchObject({
      status: "OPEN",
      elapsedBusinessHours: 1,
      dueAt: new Date("2026-09-08T14:00:00.000Z"),
    });
  });

  it("returns explicit completion compliance at and after the exact deadline", () => {
    const input = {
      startedAt: new Date("2026-09-07T09:00:00.000Z"),
      requiredBusinessHours: 4,
      now: new Date("2026-09-07T18:00:00.000Z"),
      schedule,
    };

    expect(calculateFollowUpSla({ ...input, completedAt: new Date("2026-09-07T13:00:00.000Z") })).toMatchObject({
      status: "COMPLETED",
      compliance: "MET",
      breached: false,
      dueAt: new Date("2026-09-07T13:00:00.000Z"),
    });
    expect(calculateFollowUpSla({ ...input, completedAt: new Date("2026-09-07T13:00:00.001Z") })).toMatchObject({
      status: "COMPLETED",
      compliance: "MISSED",
      breached: true,
      dueAt: new Date("2026-09-07T13:00:00.000Z"),
    });
  });

  it("starts Admin reassignment SLA at recruiter response and marks only a passed boundary overdue", () => {
    const input = {
      recruiterRespondedAt: new Date("2026-09-07T16:00:00.000Z"),
      requiredBusinessHours: 2,
      adminSchedule: schedule,
    };

    expect(calculateAdminReassignmentSla({ ...input, now: new Date("2026-09-08T10:00:00.000Z") })).toEqual({
      status: "OPEN",
      compliance: "PENDING",
      breached: false,
      dueAt: new Date("2026-09-08T10:00:00.000Z"),
    });
    expect(calculateAdminReassignmentSla({ ...input, now: new Date("2026-09-08T10:00:00.001Z") })).toEqual({
      status: "OVERDUE",
      compliance: "MISSED",
      breached: true,
      dueAt: new Date("2026-09-08T10:00:00.000Z"),
    });
  });

  it("marks Admin reassignment as met at the exact deadline and missed after it", () => {
    const input = {
      recruiterRespondedAt: new Date("2026-09-07T09:00:00.000Z"),
      requiredBusinessHours: 2,
      now: new Date("2026-09-07T12:00:00.000Z"),
      adminSchedule: schedule,
    };

    expect(calculateAdminReassignmentSla({ ...input, reassignedAt: new Date("2026-09-07T11:00:00.000Z") })).toMatchObject({
      status: "REASSIGNED",
      compliance: "MET",
      breached: false,
      dueAt: new Date("2026-09-07T11:00:00.000Z"),
    });
    expect(calculateAdminReassignmentSla({ ...input, reassignedAt: new Date("2026-09-07T11:00:00.001Z") })).toMatchObject({
      status: "REASSIGNED",
      compliance: "MISSED",
      breached: true,
      dueAt: new Date("2026-09-07T11:00:00.000Z"),
    });
  });

  it("uses the Admin calendar, not the absent BD leave, for reassignment SLA", () => {
    const absentBdSchedule: BusinessHoursSchedule = {
      ...schedule,
      leaves: [{
        startsAt: new Date("2026-09-07T09:00:00.000Z"),
        endsAt: new Date("2026-09-09T09:00:00.000Z"),
      }],
    };
    const adminSchedule = {
      ...schedule,
    };

    expect(calculateAdminReassignmentSla({
      recruiterRespondedAt: new Date("2026-09-07T09:00:00.000Z"),
      requiredBusinessHours: 2,
      now: new Date("2026-09-07T10:00:00.000Z"),
      adminSchedule,
    })).toMatchObject({
      status: "OPEN",
      dueAt: new Date("2026-09-07T11:00:00.000Z"),
    });

    // `leaves` may exist on a structurally compatible calendar object, but the
    // Admin helper deliberately discards them before calculating the deadline.
    expect(calculateAdminReassignmentSla({
      recruiterRespondedAt: new Date("2026-09-07T09:00:00.000Z"),
      requiredBusinessHours: 2,
      now: new Date("2026-09-07T10:00:00.000Z"),
      adminSchedule: absentBdSchedule,
    })).toMatchObject({
      dueAt: new Date("2026-09-07T11:00:00.000Z"),
    });

    expect(calculateAdminReassignmentSla({
      recruiterRespondedAt: new Date("2026-09-04T16:00:00.000Z"),
      requiredBusinessHours: 2,
      now: new Date("2026-09-08T10:00:00.000Z"),
      adminSchedule: {
        ...absentBdSchedule,
        holidays: [new Date("2026-09-07T00:00:00.000Z")],
      },
    })).toMatchObject({
      dueAt: new Date("2026-09-08T10:00:00.000Z"),
    });
  });

  it("adds business hours across non-working time", () => {
    expect(addBusinessHours(new Date("2026-09-04T16:00:00.000Z"), 2, schedule)).toEqual(
      new Date("2026-09-07T10:00:00.000Z"),
    );
  });

  it("finds the next eligible business-day boundary after the current local day", () => {
    expect(nextEligibleWorkingDay(new Date("2026-09-10T16:00:00.000Z"), {
      ...schedule,
      holidays: [new Date("2026-09-11T00:00:00.000Z")],
    })).toEqual(new Date("2026-09-14T00:00:00.000Z"));
  });

  it("preserves the current business-calendar date across timezone boundaries", () => {
    expect(businessCalendarDate(new Date("2026-09-10T21:00:00.000Z"), "Asia/Karachi")).toEqual(
      new Date("2026-09-11T00:00:00.000Z"),
    );
  });
});
