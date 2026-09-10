import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow } from "./performance-helpers";

const closerEmail = "noah.closer@orbit.local";
const closerPassword = process.env.ORBIT_DEMO_PASSWORD ?? "OrbitDemo123!";
const assignedLeadId = "70000000-0000-4000-8000-000000000002";
const unassignedLeadId = "70000000-0000-4000-8000-000000000001";

async function signInAsCloser(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(closerEmail);
  await page.getByLabel("Password").fill(closerPassword);
  await page.getByRole("button", { name: "Sign in to Orbit" }).click();
  await expect(page).toHaveURL("/");
}

test.describe("Closer workspace", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsCloser(page);
  });

  test("shows assigned interview work and role-scoped navigation", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Good morning,/ })).toBeVisible();
    await expect(page.getByLabel("Active interview pipeline")).toContainText("Avery");
    await expect(page.getByLabel("Next interview briefing")).toBeVisible();
    await expect(page.getByRole("link", { name: /^Calendar:/ })).toBeVisible();

    const navigation = page.getByRole("navigation", { name: "Primary navigation" });
    for (const label of ["Dashboard", "Leads", "Tasks", "Activity", "Account settings"]) {
      await expect(navigation.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    for (const label of ["Candidates", "Profiles", "Interview calendar", "Employer directory", "Analytics", "Users"]) {
      await expect(navigation.getByRole("link", { name: label, exact: true })).toHaveCount(0);
    }
  });

  test("keeps the closer workbench proportional, aligned, and responsive", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await expect(page.getByLabel("Closer operational workspace")).toBeVisible();

    const calendar = page.getByLabel("Primary calendar");
    const controlRail = page.getByLabel("Closer control rail");
    const pipeline = page.getByLabel("Active interview pipeline");
    const updates = page.getByLabel("Recent updates");
    const [calendarBox, railBox, pipelineBox, updatesBox] = await Promise.all([
      calendar.boundingBox(),
      controlRail.boundingBox(),
      pipeline.boundingBox(),
      updates.boundingBox(),
    ]);

    expect(calendarBox).not.toBeNull();
    expect(railBox).not.toBeNull();
    const alignmentTolerance = 2;
    expect(Math.abs(calendarBox!.height - railBox!.height)).toBeLessThanOrEqual(alignmentTolerance);
    expect(calendarBox!.width / (calendarBox!.width + railBox!.width)).toBeCloseTo(0.68, 2);
    expect(Math.abs(pipelineBox!.y - updatesBox!.y)).toBeLessThanOrEqual(alignmentTolerance);
    expect(Math.abs(pipelineBox!.height - updatesBox!.height)).toBeLessThanOrEqual(alignmentTolerance);
    await expect(page.getByLabel(/^Rounds · 7 days:/)).toBeVisible();
    expect(await pipeline.locator("ul").evaluate((element) => getComputedStyle(element).overflowY)).toBe("auto");
    expect(await updates.locator("ol").evaluate((element) => getComputedStyle(element).overflowY)).toBe("auto");

    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    const order = await Promise.all([
      page.getByLabel("Closer summary").boundingBox(),
      page.getByLabel("Next interview briefing").boundingBox(),
      calendar.boundingBox(),
      page.getByLabel("Needs attention").boundingBox(),
      pipeline.boundingBox(),
      updates.boundingBox(),
    ]);
    const tops = order.map((box) => box?.y ?? -1);
    expect(tops).toEqual([...tops].sort((left, right) => left - right));
  });

  test("can open assigned application and interview workspace without admin controls", async ({ page }) => {
    await page.goto(`/leads/${assignedLeadId}`);
    await expect(page.getByRole("heading", { name: "Backend Engineer" })).toBeVisible();
    await expect(page.getByText("Responsible Closer")).toBeVisible();
    await expect(page.getByText("Interview ownership")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Communications/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Comments/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Offers/ })).toHaveCount(0);

    await page.goto(`/leads/${assignedLeadId}/interviews`);
    await expect(page.getByRole("link", { exact: true, name: "Interviews" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("region", { name: "Interview rounds" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark attended" }).first()).toBeVisible();
    await expect(page.getByText("Edit interview")).toHaveCount(0);
    await expect(page.getByPlaceholder("Cancellation reason")).toHaveCount(0);
  });

  test("shows assigned interviews and closer actions on the calendar", async ({ page }) => {
    await page.goto("/?calendarView=day");
    await expect(page).toHaveURL(/\?calendarView=day$/);
    const calendar = page.getByLabel("Calendar view");
    await expect(calendar).toBeVisible();
    await page.getByRole("button", { name: "Week view", exact: true }).click();
    const scheduledEvent = calendar.getByTestId("calendar-event").filter({ hasText: "SCHEDULED" }).first();
    await expect(scheduledEvent).toBeVisible();
    await scheduledEvent.click();
    await expect(page.getByRole("button", { name: "Mark attended" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark missed" }).first()).toBeVisible();
    await expect(page.getByPlaceholder("Cancellation reason")).toHaveCount(0);
  });

  test("loads closer task, availability, activity, and notification surfaces", async ({ page }) => {
    for (const [route, heading] of [
      ["/tasks", "Tasks"],
      ["/availability", "My availability"],
      ["/activity", "Activity"],
      ["/notifications", "Notifications"],
    ] as const) {
      await page.goto(route);
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    }
  });

  test("does not expose an unassigned application by direct URL", async ({ page }) => {
    await page.goto(`/leads/${unassignedLeadId}`);
    await expect(page.getByRole("heading", { name: "Lead unavailable" })).toBeVisible();
    await expect(page.getByText(/not authorized|forbidden|permission/i)).toBeVisible();
  });
});
