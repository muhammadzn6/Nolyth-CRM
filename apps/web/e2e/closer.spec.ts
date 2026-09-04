import { expect, test } from "@playwright/test";

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
    await expect(page.getByLabel("Assigned applications")).toContainText("Avery");
    await expect(page.getByRole("heading", { name: "Next meeting briefing" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Google Calendar" })).toBeVisible();

    const navigation = page.getByRole("navigation", { name: "Primary navigation" });
    for (const label of ["Dashboard", "Leads", "Tasks", "Interview calendar", "Activity", "Account settings"]) {
      await expect(navigation.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    for (const label of ["Candidates", "Profiles", "Employer directory", "Analytics", "Users"]) {
      await expect(navigation.getByRole("link", { name: label, exact: true })).toHaveCount(0);
    }
  });

  test("can open assigned application and interview workspace without admin controls", async ({ page }) => {
    await page.goto(`/leads/${assignedLeadId}`);
    await expect(page.getByRole("heading", { name: "Backend Engineer" })).toBeVisible();
    await expect(page.getByText("Responsible Closer")).toBeVisible();
    await expect(page.getByText("Interview ownership")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Communications/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Comments/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Offers/ })).toBeVisible();

    await page.goto(`/leads/${assignedLeadId}/interviews`);
    await expect(page.getByRole("heading", { name: "Interviews" })).toBeVisible();
    await expect(page.getByText("Mark attended")).toHaveCount(0);
    await expect(page.getByText("Edit interview")).toHaveCount(0);
  });

  test("shows assigned interviews and closer actions on the calendar", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page.getByRole("heading", { name: "Interview calendar" })).toBeVisible();
    await expect(page.getByText("SCHEDULED", { exact: true }).first()).toBeVisible();
    await page.getByTestId("calendar-event").first().click();
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
