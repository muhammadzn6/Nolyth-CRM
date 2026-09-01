import { cn } from "@/lib/utils/cn";

describe("cn", () => {
  it("joins truthy class names", () => {
    expect(cn("base", undefined, false, "active")).toBe("base active");
  });
});
