export const defaultBusinessTimeZone = "America/New_York";

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute"), second: value("second") };
}

export function businessDateDisplay(now: Date, timeZone: string) {
  const businessDate = zonedParts(now, timeZone);
  return {
    day: String(businessDate.day).padStart(2, "0"),
    label: new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone,
    }).format(now),
    week: Math.ceil(businessDate.day / 7),
    year: businessDate.year,
  };
}

export function calendarDateForTimeZone(now: Date, timeZone: string) {
  const businessDate = zonedParts(now, timeZone);
  return new Date(businessDate.year, businessDate.month - 1, businessDate.day, 12);
}

export function businessDayPerformanceRange(now: Date, timeZone: string) {
  const businessDate = zonedParts(now, timeZone);
  const desired = Date.UTC(businessDate.year, businessDate.month - 1, businessDate.day);
  let candidate = desired;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = zonedParts(new Date(candidate), timeZone);
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    candidate += desired - represented;
  }
  return { from: new Date(candidate).toISOString(), to: now.toISOString() };
}
