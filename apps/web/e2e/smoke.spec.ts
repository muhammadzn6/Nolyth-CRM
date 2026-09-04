import { expect, test } from "@playwright/test";

const apiOrigin = process.env.ORBIT_E2E_API_ORIGIN ?? "http://localhost:3101";

test("serves the public login route", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Sign in to your workspace" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in to Orbit" })).toBeVisible();
});

test("reports API process liveness", async ({ request }) => {
  const response = await request.get(`${apiOrigin}/health/live`);

  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toEqual({
    success: true,
    data: { status: "ok" },
    meta: { requestId: expect.any(String) },
  });
});

test("allows the seeded administrator to reach the authenticated shell", async ({ page }) => {
  const password = process.env.ORBIT_SEED_ADMIN_PASSWORD ?? "ci-only-orbit-admin-password";

  await page.goto("/login");
  await page.getByLabel("Work email").fill("admin@orbit.local");
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in to Orbit" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Today at a glance" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toContainText("Admin");
});
