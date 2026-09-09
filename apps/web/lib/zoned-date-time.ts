const LOCAL_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const CANONICAL_UTC_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/;

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export class ZonedDateTimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZonedDateTimeError";
  }
}

function formatter(timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    throw new ZonedDateTimeError("Enter a valid IANA timezone.");
  }
}

function zonedParts(value: Date, timeZone: string): DateTimeParts {
  const values = Object.fromEntries(
    formatter(timeZone)
      .formatToParts(value)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value: part }) => [type, Number(part)]),
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function parseLocalDateTime(value: string): DateTimeParts {
  const match = LOCAL_DATE_TIME_PATTERN.exec(value);
  if (!match) {
    throw new ZonedDateTimeError("Enter a valid local date and time.");
  }

  const [, year, month, day, hour, minute] = match;
  const parts = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: 0,
  };
  const date = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute),
  );

  if (
    date.getUTCFullYear() !== parts.year ||
    date.getUTCMonth() !== parts.month - 1 ||
    date.getUTCDate() !== parts.day ||
    date.getUTCHours() !== parts.hour ||
    date.getUTCMinutes() !== parts.minute
  ) {
    throw new ZonedDateTimeError("Enter a valid local date and time.");
  }

  return parts;
}

function parseCanonicalUtcDateTime(value: string) {
  const match = CANONICAL_UTC_PATTERN.exec(value);
  if (!match) {
    throw new ZonedDateTimeError("Enter a valid UTC date and time.");
  }

  const instant = new Date(value);
  if (Number.isNaN(instant.getTime()) || instant.toISOString() !== value) {
    throw new ZonedDateTimeError("Enter a valid UTC date and time.");
  }

  return instant;
}

function sameMinute(left: DateTimeParts, right: DateTimeParts) {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute
  );
}

function offsetAt(instant: number, timeZone: string) {
  const parts = zonedParts(new Date(instant), timeZone);
  return (
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    ) - Math.floor(instant / 1000) * 1000
  );
}

export function zonedLocalDateTimeToIso(value: string, timeZone: string) {
  const target = parseLocalDateTime(value);
  formatter(timeZone);
  const wallClockAsUtc = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
  );
  const offsets = new Set<number>();

  for (let hours = -48; hours <= 48; hours += 6) {
    offsets.add(offsetAt(wallClockAsUtc + hours * 60 * 60 * 1000, timeZone));
  }

  const matches = [...offsets]
    .map((offset) => wallClockAsUtc - offset)
    .filter((instant) => sameMinute(zonedParts(new Date(instant), timeZone), target));
  const uniqueMatches = [...new Set(matches)];

  if (uniqueMatches.length === 0) {
    throw new ZonedDateTimeError(
      "That local time does not exist in the selected timezone.",
    );
  }
  if (uniqueMatches.length > 1) {
    throw new ZonedDateTimeError(
      "That local time is ambiguous in the selected timezone.",
    );
  }

  return new Date(uniqueMatches[0]).toISOString();
}

export function isoToZonedLocalDateTime(value: string, timeZone: string) {
  const instant = parseCanonicalUtcDateTime(value);
  const parts = zonedParts(instant, timeZone);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}
