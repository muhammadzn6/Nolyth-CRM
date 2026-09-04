import { describe, expect, it } from "vitest";

import { resolveApiPort } from "./main";

describe("API port configuration", () => {
  it("uses an isolated API port without changing the shared process port", () => {
    expect(resolveApiPort({ API_PORT: "3101", PORT: "3100" })).toBe(3101);
  });

  it("preserves the existing PORT and default fallbacks", () => {
    expect(resolveApiPort({ PORT: "4101" })).toBe(4101);
    expect(resolveApiPort({})).toBe(3101);
  });
});
