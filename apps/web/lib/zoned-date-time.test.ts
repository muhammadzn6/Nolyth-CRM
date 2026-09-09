import { describe, expect, it } from "vitest";

import {
  isoToZonedLocalDateTime,
  zonedLocalDateTimeToIso,
} from "./zoned-date-time";

describe("zoned local datetime conversion", () => {
  it("interprets New York wall time independently of the browser timezone", () => {
    expect(
      zonedLocalDateTimeToIso("2026-09-08T10:00", "America/New_York"),
    ).toBe("2026-09-08T14:00:00.000Z");
  });

  it("interprets Karachi wall time as the matching UTC instant", () => {
    expect(zonedLocalDateTimeToIso("2026-09-08T10:00", "Asia/Karachi")).toBe(
      "2026-09-08T05:00:00.000Z",
    );
  });

  it("round-trips a stored instant into its interview timezone", () => {
    expect(
      isoToZonedLocalDateTime("2026-09-08T14:00:00.000Z", "America/New_York"),
    ).toBe("2026-09-08T10:00");
  });

  it("rejects a nonexistent daylight-saving wall time", () => {
    expect(() =>
      zonedLocalDateTimeToIso("2026-03-08T02:30", "America/New_York"),
    ).toThrow("does not exist");
  });

  it("rejects an ambiguous daylight-saving wall time", () => {
    expect(() =>
      zonedLocalDateTimeToIso("2026-11-01T01:30", "America/New_York"),
    ).toThrow("ambiguous");
  });

  it("rejects invalid timezone names", () => {
    expect(() => zonedLocalDateTimeToIso("2026-09-08T10:00", "New York")).toThrow(
      "valid IANA timezone",
    );
  });

  it("rejects malformed local datetime values", () => {
    expect(() => zonedLocalDateTimeToIso("09/08/2026 10:00", "UTC")).toThrow(
      "valid local date and time",
    );
  });

  it("rejects impossible canonical-looking UTC dates", () => {
    expect(() =>
      isoToZonedLocalDateTime("2026-02-30T14:00:00.000Z", "UTC"),
    ).toThrow("valid UTC date and time");
  });

  it("rejects timezone-less datetime values", () => {
    expect(() => isoToZonedLocalDateTime("2026-09-08T14:00", "UTC")).toThrow(
      "valid UTC date and time",
    );
  });
});
