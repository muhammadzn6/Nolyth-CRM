import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv-parser";

describe("parseCsv", () => {
  it("parses quoted commas, trims headers, and reports data rows from row two", () => {
    expect(parseCsv(" Name ,Email\n\"Avery, Chen\", avery@example.com ")).toEqual({
      headers: ["name", "email"],
      rows: [{ row: 2, values: { name: "Avery, Chen", email: "avery@example.com" } }],
    });
  });

  it("rejects duplicate or empty headers", () => {
    expect(() => parseCsv("name,name\nA,B")).toThrow("duplicate header");
    expect(() => parseCsv(",email\nA,a@example.com")).toThrow("empty header");
  });
});
