import { formatJobUrlCompact, formatJobUrlDisplay, isSafeWebUrl, normalizeJobUrl } from "@/lib/utils/url";

describe("url utils", () => {
  it("normalizes trailing slashes and tracking params", () => {
    expect(
      normalizeJobUrl("https://Example.com/jobs/1/?utm_source=linkedin"),
    ).toBe("https://example.com/jobs/1");
  });

  it("formats display URLs compactly", () => {
    expect(formatJobUrlDisplay("https://www.google.com/careers/ai-engineer")).toBe(
      "google.com/careers/ai-engineer",
    );
  });

  it("formats compact job URL labels with hostname only", () => {
    expect(formatJobUrlCompact("https://www.linkedin.com/jobs/view/1234567890")).toBe(
      "linkedin.com",
    );
  });

  it("accepts only safe web URLs", () => {
    expect(isSafeWebUrl("https://example.com/job")).toBe(true);
    expect(isSafeWebUrl("javascript:alert(1)")).toBe(false);
  });
});
