export type WorkdayHours = {
  startHour: number;
  endHour: number;
};

export type ApprovedLeave = {
  startsAt: Date;
  endsAt: Date;
  /** A reduced local working window for each affected day; omitted means unavailable. */
  availableHours?: WorkdayHours;
};

export type BusinessHoursSchedule = {
  /** IANA timezone used for recurring weekday and workday-window evaluation. */
  timeZone: string;
  /** JavaScript weekday numbers, where Sunday is 0 and Saturday is 6. */
  workingDays: readonly number[];
  workday: WorkdayHours;
  /** Date-only holidays, represented by their UTC calendar date. */
  holidays?: readonly Date[];
  leaves?: readonly ApprovedLeave[];
};

type Interval = { start: Date; end: Date };
type LocalDate = { year: number; month: number; day: number };

function assertValidInterval(start: Date, end: Date): void {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    throw new Error("Expected a valid chronological interval");
  }
}

function validateHours({ startHour, endHour }: WorkdayHours): void {
  if (
    !Number.isInteger(startHour)
    || !Number.isInteger(endHour)
    || startHour < 0
    || endHour > 24
    || startHour >= endHour
  ) {
    throw new Error("Workday hours must be whole hours between 00:00 and 24:00");
  }
}

export function validateApprovedLeaveAvailability(availableHours: WorkdayHours | undefined, workday: WorkdayHours): void {
  if (!availableHours) return;
  validateHours(availableHours);
  if (availableHours.startHour < workday.startHour || availableHours.endHour > workday.endHour) {
    throw new Error("Reduced leave availability must fall within the configured workday");
  }
}

function assertValidTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
  } catch {
    throw new Error("Expected a valid IANA timezone");
  }
}

function assertValidSchedule(schedule: BusinessHoursSchedule): void {
  assertValidTimeZone(schedule.timeZone);
  validateHours(schedule.workday);
  if (schedule.workingDays.length === 0) throw new Error("At least one working day is required");
  if (schedule.workingDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
    throw new Error("Working days must be JavaScript weekday numbers");
  }
  for (const leave of schedule.leaves ?? []) validateApprovedLeaveAvailability(leave.availableHours, schedule.workday);
}

function localParts(value: Date, timeZone: string): LocalDate & { hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((entry) => entry.type === type)?.value);

  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    second: part("second"),
  };
}

function localDate(value: Date, timeZone: string): LocalDate {
  const { year, month, day } = localParts(value, timeZone);
  return { year, month, day };
}

function compareLocalDates(left: LocalDate, right: LocalDate): number {
  return left.year - right.year || left.month - right.month || left.day - right.day;
}

function addLocalDays(value: LocalDate, days: number): LocalDate {
  const next = new Date(Date.UTC(value.year, value.month - 1, value.day + days));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

function localWeekday(value: LocalDate): number {
  return new Date(Date.UTC(value.year, value.month - 1, value.day)).getUTCDay();
}

function localDateKey(value: LocalDate): string {
  return `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
}

function holidayDateKey(value: Date): string {
  if (Number.isNaN(value.getTime())) throw new Error("Expected a valid holiday date");
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

function timeZoneOffsetMilliseconds(value: Date, timeZone: string): number {
  const parts = localParts(value, timeZone);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - value.getTime();
}

function compareLocalDateTimes(
  left: LocalDate & { hour: number; minute: number; second: number },
  right: LocalDate & { hour: number; minute: number; second: number },
): number {
  return compareLocalDates(left, right)
    || left.hour - right.hour
    || left.minute - right.minute
    || left.second - right.second;
}

function localDateTime(value: LocalDate, hour: number, timeZone: string): Date {
  if (hour === 24) return localDateTime(addLocalDays(value, 1), 0, timeZone);
  const target = Date.UTC(value.year, value.month - 1, value.day, hour);
  const offsets = new Set([-36, -24, -12, 0, 12, 24, 36].map((hours) =>
    timeZoneOffsetMilliseconds(new Date(target + hours * 3_600_000), timeZone),
  ));
  const wanted = { ...value, hour, minute: 0, second: 0 };
  const candidates = [...offsets]
    .map((offset) => new Date(target - offset))
    .sort((left, right) => left.getTime() - right.getTime());
  const exact = candidates.find((candidate) => compareLocalDateTimes(localParts(candidate, timeZone), wanted) === 0);
  if (exact) return exact;

  // A spring-forward gap has no exact wall-clock time. Resolve it to the first valid instant after the gap.
  const afterGap = candidates.find((candidate) => compareLocalDateTimes(localParts(candidate, timeZone), wanted) > 0);
  if (afterGap) return afterGap;

  throw new Error("Could not resolve local time in configured IANA timezone");
}

function dayInterval(day: LocalDate, timeZone: string): Interval {
  return {
    start: localDateTime(day, 0, timeZone),
    end: localDateTime(addLocalDays(day, 1), 0, timeZone),
  };
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

function normalIntervalsForDay(day: LocalDate, schedule: BusinessHoursSchedule): Interval[] {
  if (!schedule.workingDays.includes(localWeekday(day))) return [];
  if (schedule.holidays?.some((holiday) => holidayDateKey(holiday) === localDateKey(day))) return [];

  return [{
    start: localDateTime(day, schedule.workday.startHour, schedule.timeZone),
    end: localDateTime(day, schedule.workday.endHour, schedule.timeZone),
  }];
}

function availableIntervalsForDay(day: LocalDate, schedule: BusinessHoursSchedule): Interval[] {
  let intervals = normalIntervalsForDay(day, schedule);
  if (intervals.length === 0) return [];

  const localDay = dayInterval(day, schedule.timeZone);
  for (const leave of schedule.leaves ?? []) {
    assertValidInterval(leave.startsAt, leave.endsAt);
    const leaveInterval = { start: leave.startsAt, end: leave.endsAt };
    if (!intersects(localDay, leaveInterval)) continue;

    if (leave.availableHours) {
      const reducedWindow = {
        start: localDateTime(day, leave.availableHours.startHour, schedule.timeZone),
        end: localDateTime(day, leave.availableHours.endHour, schedule.timeZone),
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

function durationHours(intervals: readonly Interval[]): number {
  return intervals.reduce((total, interval) => total + interval.end.getTime() - interval.start.getTime(), 0) / 3_600_000;
}

function roundToOneDecimal(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

export function getEligibleWorkdayCapacity(day: Date, schedule: BusinessHoursSchedule): number {
  if (Number.isNaN(day.getTime())) throw new Error("Expected a valid day");
  assertValidSchedule(schedule);
  const local = localDate(day, schedule.timeZone);
  const normalHours = durationHours(normalIntervalsForDay(local, { ...schedule, holidays: [] }));
  if (normalHours === 0) return 0;
  return roundToOneDecimal(durationHours(availableIntervalsForDay(local, schedule)) / normalHours);
}

export function calculateProratedDailyTarget(dailyTarget: number, day: Date, schedule: BusinessHoursSchedule): number {
  if (!Number.isFinite(dailyTarget) || dailyTarget < 0) throw new Error("Daily target must be non-negative");
  return roundToOneDecimal(dailyTarget * getEligibleWorkdayCapacity(day, schedule));
}

export function isEligibleWorkingDay(day: Date, schedule: BusinessHoursSchedule): boolean {
  return getEligibleWorkdayCapacity(day, schedule) > 0;
}

export function businessHoursBetween(start: Date, end: Date, schedule: BusinessHoursSchedule): number {
  assertValidInterval(start, end);
  assertValidSchedule(schedule);
  if (start.getTime() === end.getTime()) return 0;

  let totalMilliseconds = 0;
  const endDay = localDate(end, schedule.timeZone);
  for (let day = localDate(start, schedule.timeZone); compareLocalDates(day, endDay) <= 0; day = addLocalDays(day, 1)) {
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
  assertValidSchedule(schedule);
  if (businessHours === 0) return new Date(start);

  let remainingMilliseconds = businessHours * 3_600_000;
  let cursor = new Date(start);
  const lastSearchDay = addLocalDays(localDate(start, schedule.timeZone), 11 * 366);

  for (let day = localDate(start, schedule.timeZone); compareLocalDates(day, lastSearchDay) <= 0; day = addLocalDays(day, 1)) {
    for (const available of availableIntervalsForDay(day, schedule)) {
      const current = available.start > cursor ? available.start : cursor;
      if (current >= available.end) continue;
      const availableMilliseconds = available.end.getTime() - current.getTime();
      if (remainingMilliseconds <= availableMilliseconds) return new Date(current.getTime() + remainingMilliseconds);
      remainingMilliseconds -= availableMilliseconds;
    }
    cursor = dayInterval(addLocalDays(day, 1), schedule.timeZone).start;
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
  compliance: "MET" | "MISSED" | "PENDING" | "PAUSED";
  breached: boolean;
  elapsedBusinessHours: number;
  dueAt: Date;
} {
  const stoppedAt = input.completedAt ?? input.reassignedAt ?? input.now;
  const dueAt = addBusinessHours(input.startedAt, input.requiredBusinessHours, input.schedule);
  const elapsedBusinessHours = businessHoursBetween(input.startedAt, stoppedAt, input.schedule);
  const completedLate = Boolean(input.completedAt && input.completedAt > dueAt);
  const status = input.completedAt
    ? "COMPLETED"
    : input.reassignedAt
      ? "PAUSED_FOR_REASSIGNMENT"
      : input.now > dueAt
        ? "OVERDUE"
        : "OPEN";
  const compliance = input.completedAt
    ? completedLate ? "MISSED" : "MET"
    : input.reassignedAt
      ? "PAUSED"
      : input.now > dueAt ? "MISSED" : "PENDING";

  return { status, compliance, breached: compliance === "MISSED", elapsedBusinessHours, dueAt };
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
  compliance: "MET" | "MISSED" | "PENDING";
  breached: boolean;
  dueAt: Date;
} {
  const dueAt = addBusinessHours(input.recruiterRespondedAt, input.requiredBusinessHours, input.schedule);
  if (input.reassignedAt) {
    const compliance = input.reassignedAt <= dueAt ? "MET" : "MISSED";
    return { status: "REASSIGNED", compliance, breached: compliance === "MISSED", dueAt };
  }
  const overdue = input.now > dueAt;
  return { status: overdue ? "OVERDUE" : "OPEN", compliance: overdue ? "MISSED" : "PENDING", breached: overdue, dueAt };
}
