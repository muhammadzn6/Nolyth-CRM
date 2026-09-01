import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password helpers", () => {
  it("hashes and verifies credentials", async () => {
    const hash = await hashPassword("secret123");

    expect(hash).not.toBe("secret123");
    await expect(verifyPassword("secret123", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });
});
