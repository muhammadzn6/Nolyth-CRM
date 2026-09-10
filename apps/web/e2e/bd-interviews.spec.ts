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
  await expect(page.getByRole("region", { name: "Interview rounds" })).toBeVisible();
  await page.getByRole("button", { name: "Schedule interview" }).click();
  const scheduleDialog = page.getByRole("dialog", { name: "Schedule interview" });
  await expect(scheduleDialog).toBeVisible();
  await expect(scheduleDialog.getByRole("button", { name: "Schedule interview", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close Schedule interview" }).click();
  await expect(page.getByRole("button", { name: "Edit interview" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Cancel interview" }).first().click();
  const cancelDialog = page.getByRole("dialog", { name: "Cancel interview" });
  await expect(cancelDialog.getByLabel("Cancellation reason", { exact: true })).toBeVisible();
  await cancelDialog.getByRole("button", { name: "Keep interview" }).click();
  await expect(cancelDialog).toHaveCount(0);

  await page.goto("/?calendarView=week");
  const calendar = page.getByRole("region", { name: "BD calendar", exact: true });
  await expect(calendar).toBeVisible();
  await calendar.getByRole("button", { name: "Week calendar view" }).click();
  await expect(calendar.getByTestId("bd-mini-week-grid")).toBeVisible();
  await expect(calendar.locator(".bd-mini-calendar-event").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark attended" })).toHaveCount(0);
});
