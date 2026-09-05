export type WorkdayHours = {
  startHour: number;
  endHour: number;
};

export type ApprovedLeave = {
  startsAt: Date;
  endsAt: Date;
  /** A reduced working window for each affected day; omitted means unavailable. */
  availableHours?: WorkdayHours;
};

export type BusinessHoursSchedule = {
  /** JavaScript UTC weekday numbers, where Sunday is 0 and Saturday is 6. */
  workingDays: readonly number[];
  workday: WorkdayHours;
  holidays?: readonly Date[];
  leaves?: readonly ApprovedLeave[];
};

type Interval = { start: Date; end: Date };

function assertValidInterval(start: Date, end: Date): void {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    throw new Error("Expected a valid chronological interval");
  }
}

function validateHours({ startHour, endHour }: WorkdayHours): void {
  if (!Number.isInteger(startHour) || !Number.isInteger(endHour) || startHour < 0 || endHour > 24 || startHour >= endHour) {
    throw new Error("Workday hours must be whole hours between 00:00 and 24:00");
  }
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function nextUtcDay(value: Date): Date {
  const next = startOfUtcDay(value);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function sameUtcDay(left: Date, right: Date): boolean {
  return left.getUTCFullYear() === right.getUTCFullYear()
    && left.getUTCMonth() === right.getUTCMonth()
    && left.getUTCDate() === right.getUTCDate();
}

function intersects(left: Interval, right: Interval): boolean {
  return left.start < right.end && right.start < left.end;
}

function intersection(left: Interval, right: Interval): Interval | null {
  if (!intersects(left, right)) return null;
  return {
    start: new Date(Math.max(left.start.getTime(), right.start.getTime())),
    end: new Date(Math.min(left.end.getTime(), right.end.getTime())),
  };
}

function subtract(intervals: readonly Interval[], blocked: Interval): Interval[] {
  return intervals.flatMap((interval) => {
    const overlap = intersection(interval, blocked);
    if (!overlap) return [interval];

    const remaining: Interval[] = [];
    if (interval.start < overlap.start) remaining.push({ start: interval.start, end: overlap.start });
    if (overlap.end < interval.end) remaining.push({ start: overlap.end, end: interval.end });
    return remaining;
  });
}

function utcHourOnDay(day: Date, hour: number): Date {
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour));
}

function availableIntervalsForDay(day: Date, schedule: BusinessHoursSchedule): Interval[] {
  validateHours(schedule.workday);
  if (!schedule.workingDays.includes(day.getUTCDay())) return [];
  if (schedule.holidays?.some((holiday) => sameUtcDay(holiday, day))) return [];

  let intervals: Interval[] = [{
    start: utcHourOnDay(day, schedule.workday.startHour),
    end: utcHourOnDay(day, schedule.workday.endHour),
  }];
  const dayInterval = { start: day, end: nextUtcDay(day) };

  for (const leave of schedule.leaves ?? []) {
    assertValidInterval(leave.startsAt, leave.endsAt);
    const leaveInterval = { start: leave.startsAt, end: leave.endsAt };
    if (!intersects(dayInterval, leaveInterval)) continue;

    if (leave.availableHours) {
      validateHours(leave.availableHours);
      const reducedWindow = {
        start: utcHourOnDay(day, leave.availableHours.startHour),
        end: utcHourOnDay(day, leave.availableHours.endHour),
      };
      intervals = intervals.flatMap((interval) => {
        const available = intersection(interval, reducedWindow);
        return available ? [available] : [];
      });
      continue;
    }

    intervals = subtract(intervals, leaveInterval);
  }

  return intervals;
}

export function isEligibleWorkingDay(day: Date, schedule: BusinessHoursSchedule): boolean {
  if (Number.isNaN(day.getTime())) throw new Error("Expected a valid day");
  return availableIntervalsForDay(startOfUtcDay(day), schedule).length > 0;
}

/**
 * Calculates elapsed hours in the supplied UTC business calendar. Schedules
 * intentionally use UTC so persisted timestamps can be evaluated without a
 * process-local timezone dependency.
 */
export function businessHoursBetween(start: Date, end: Date, schedule: BusinessHoursSchedule): number {
  assertValidInterval(start, end);
  if (start.getTime() === end.getTime()) return 0;

  let totalMilliseconds = 0;
  for (let day = startOfUtcDay(start); day <= end; day = nextUtcDay(day)) {
    for (const available of availableIntervalsForDay(day, schedule)) {
      const overlap = intersection(available, { start, end });
      if (overlap) totalMilliseconds += overlap.end.getTime() - overlap.start.getTime();
    }
  }

  return totalMilliseconds / 3_600_000;
}

export function addBusinessHours(start: Date, businessHours: number, schedule: BusinessHoursSchedule): Date {
  if (Number.isNaN(start.getTime()) || businessHours < 0 || !Number.isFinite(businessHours)) {
    throw new Error("Expected a valid start and a non-negative business-hour duration");
  }
  if (businessHours === 0) return new Date(start);
  if (schedule.workingDays.length === 0) throw new Error("At least one working day is required");

  let remainingMilliseconds = businessHours * 3_600_000;
  let cursor = new Date(start);
  const lastSearchDay = new Date(start);
  lastSearchDay.setUTCFullYear(lastSearchDay.getUTCFullYear() + 11);

  while (cursor < lastSearchDay) {
    const day = startOfUtcDay(cursor);
    for (const available of availableIntervalsForDay(day, schedule)) {
      const current = available.start > cursor ? available.start : cursor;
      if (current >= available.end) continue;
      const availableMilliseconds = available.end.getTime() - current.getTime();
      if (remainingMilliseconds <= availableMilliseconds) {
        return new Date(current.getTime() + remainingMilliseconds);
      }
      remainingMilliseconds -= availableMilliseconds;
    }
    cursor = nextUtcDay(day);
  }

  throw new Error("Business-hour duration could not be scheduled within eleven years");
}

export type FollowUpSlaInput = {
  startedAt: Date;
  requiredBusinessHours: number;
  schedule: BusinessHoursSchedule;
  now: Date;
  reassignedAt?: Date;
  completedAt?: Date;
};

export function calculateFollowUpSla(input: FollowUpSlaInput): {
  status: "OPEN" | "COMPLETED" | "OVERDUE" | "PAUSED_FOR_REASSIGNMENT";
  elapsedBusinessHours: number;
  dueAt: Date;
} {
  const stoppedAt = input.completedAt ?? input.reassignedAt ?? input.now;
  const dueAt = addBusinessHours(input.startedAt, input.requiredBusinessHours, input.schedule);
  const elapsedBusinessHours = businessHoursBetween(input.startedAt, stoppedAt, input.schedule);
  const status = input.completedAt
    ? "COMPLETED"
    : input.reassignedAt
      ? "PAUSED_FOR_REASSIGNMENT"
      : input.now > dueAt
        ? "OVERDUE"
        : "OPEN";

  return { status, elapsedBusinessHours, dueAt };
}

export type AdminReassignmentSlaInput = {
  recruiterRespondedAt: Date;
  requiredBusinessHours: number;
  schedule: BusinessHoursSchedule;
  now: Date;
  reassignedAt?: Date;
};

export function calculateAdminReassignmentSla(input: AdminReassignmentSlaInput): {
  status: "OPEN" | "OVERDUE" | "REASSIGNED";
  dueAt: Date;
} {
  const dueAt = addBusinessHours(input.recruiterRespondedAt, input.requiredBusinessHours, input.schedule);
  if (input.reassignedAt) return { status: "REASSIGNED", dueAt };
  return { status: input.now > dueAt ? "OVERDUE" : "OPEN", dueAt };
}
