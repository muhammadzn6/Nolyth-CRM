import { parseBulkPaste } from "@/lib/leads/parse-bulk-paste";

describe("parseBulkPaste", () => {
  it("parses two-column company and URL rows", () => {
    expect(
      parseBulkPaste("Google\thttps://example.com/google\nMeta\thttps://example.com/meta"),
    ).toEqual([
      { companyName: "Google", jobUrl: "https://example.com/google" },
      { companyName: "Meta", jobUrl: "https://example.com/meta" },
    ]);
  });

  it("parses three-column rows with optional job title", () => {
    expect(
      parseBulkPaste(
        "Google\tSenior AI Engineer\thttps://example.com/google-ai\nMeta\tML Engineer\thttps://example.com/meta-ml",
      ),
    ).toEqual([
      {
        companyName: "Google",
        jobTitle: "Senior AI Engineer",
        jobUrl: "https://example.com/google-ai",
      },
      {
        companyName: "Meta",
        jobTitle: "ML Engineer",
        jobUrl: "https://example.com/meta-ml",
      },
    ]);
  });

  it("ignores malformed rows", () => {
    expect(parseBulkPaste("Incomplete row\n\t\nGoogle\t\n")).toEqual([]);
  });
});
