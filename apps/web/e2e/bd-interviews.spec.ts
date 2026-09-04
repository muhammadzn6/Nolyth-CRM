import { expect, test } from "@playwright/test";

const bdPassword = process.env.ORBIT_DEMO_PASSWORD ?? "OrbitDemo123!";
const assignedLeadId = "70000000-0000-4000-8000-000000000002";

test("BD can schedule and manage interviews for an owned application", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Work email").fill("maya.bd@orbit.local");
  await page.getByLabel("Password").fill(bdPassword);
  await page.getByRole("button", { name: "Sign in to Orbit" }).click();
  await expect(page).toHaveURL("/");

  await page.goto(`/leads/${assignedLeadId}/interviews`);
  await expect(page.getByRole("heading", { name: "Interviews" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Schedule interview" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Schedule interview" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit interview" }).first()).toBeVisible();

  await page.goto("/calendar");
  await expect(page.getByRole("heading", { name: "Interview calendar" })).toBeVisible();
  await expect(page.getByText("SCHEDULED", { exact: true }).first()).toBeVisible();
  await page.getByTestId("calendar-event").first().click();
  await expect(page.getByPlaceholder("Cancellation reason").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark attended" })).toHaveCount(0);
});
