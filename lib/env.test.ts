import { getRequiredEnv } from "@/lib/env";

describe("getRequiredEnv", () => {
  it("returns the value when present", () => {
    process.env.TEST_PRESENT_ENV = "present-value";

    expect(getRequiredEnv("TEST_PRESENT_ENV")).toBe("present-value");

    delete process.env.TEST_PRESENT_ENV;
  });

  it("throws when the value is missing", () => {
    delete process.env.TEST_MISSING_ENV;

    expect(() => getRequiredEnv("TEST_MISSING_ENV")).toThrow(
      "Missing required environment variable: TEST_MISSING_ENV",
    );
  });
});
