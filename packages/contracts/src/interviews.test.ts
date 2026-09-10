import { describe, expect, it } from "vitest";

import { interviewAttendanceSchema, officialResultSchema } from "./interviews";

describe("interview mutation contracts", () => {
  it("accepts only explicit attended or missed attendance", () => {
    expect(interviewAttendanceSchema.safeParse({ attendance: "ATTENDED", expectedVersion: 1 }).success).toBe(true);
    expect(interviewAttendanceSchema.safeParse({ attendance: "MISSED", expectedVersion: 1 }).success).toBe(true);
    expect(interviewAttendanceSchema.safeParse({ attendance: "UNKNOWN", expectedVersion: 1 }).success).toBe(false);
  });

  it("requires a passed or failed official outcome with optional notes", () => {
    expect(officialResultSchema.safeParse({ outcome: "PASSED", notes: "Strong technical round", expectedVersion: 1 }).success).toBe(true);
    expect(officialResultSchema.safeParse({ outcome: "FAILED", expectedVersion: 1 }).success).toBe(true);
    expect(officialResultSchema.safeParse({ result: "Strong technical round", expectedVersion: 1 }).success).toBe(false);
  });
});
