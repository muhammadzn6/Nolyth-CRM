import { expect, test } from "@playwright/test";

const adminPassword = process.env.ORBIT_SEED_ADMIN_PASSWORD ?? "ci-only-orbit-admin-password";

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Work email").fill("admin@orbit.local");
  await page.getByLabel("Password").fill(adminPassword);
  await page.getByRole("button", { name: "Sign in to Orbit" }).click();
  await expect(page).toHaveURL("/");
}

test.describe("admin MVP surfaces", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("exposes employer CRUD and administration", async ({ page }) => {
    await page.goto("/admin/clients");
    await expect(page.getByRole("heading", { name: "Employers" })).toBeVisible();
    await expect(page.getByRole("link", { name: "New employer" })).toBeVisible();
    await page.getByRole("link", { name: "New employer" }).click();
    await expect(page.getByRole("heading", { name: "New employer" })).toBeVisible();
    await expect(page.getByRole("form", { name: "Create employer" })).toBeVisible();
  });

  test("exposes import, collaboration, and profile tab surfaces", async ({ page }) => {
    await page.goto("/candidates");
    await expect(page.getByRole("heading", { name: "Candidates", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Import candidates" }).click();
    await expect(page.getByRole("heading", { name: "Bulk import candidates" })).toBeVisible();
    await page.goto("/leads");
    await page.getByRole("button", { name: "Import applications" }).click();
    await expect(page.getByRole("heading", { name: "Bulk import leads" })).toBeVisible();
    await page.goto("/reset-password");
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  });

  test("loads every admin navigation page", async ({ page }) => {
    const pages = [
      ["/", /Good morning,/],
      ["/candidates", "Candidates"],
      ["/profiles", "Profiles"],
      ["/leads", "Applications"],
      ["/tasks", "Tasks"],
      ["/admin/clients", "Employers"],
      ["/analytics", "Analytics"],
      ["/activity", "Activity"],
      ["/admin/users", "Users and invitations"],
      ["/settings", "Account settings"],
      ["/notifications", "Notifications"],
    ] as const;

    for (const [route, heading] of pages) {
      await page.goto(route);
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    }

    await page.goto("/calendar");
    await expect(page).toHaveURL(/\/?\?calendarView=day$/);
    await expect(page.getByRole("heading", { name: /Good morning,/ })).toBeVisible();
  });

  test("loads profile tabs and lead collaboration routes", async ({ page }) => {
    await page.goto("/profiles");
    const profileLink = page.locator('a[href^="/profiles/"]').first();
    await expect(profileLink).toBeVisible();
    const profileRoute = await profileLink.getAttribute("href");
    expect(profileRoute).toBeTruthy();
    await page.goto(profileRoute!);
    const profileSections = page.getByLabel("Profile sections");
    for (const tab of ["Leads", "Interviews", "Tasks", "Documents", "Activity", "Analytics"]) {
      await expect(profileSections.getByRole("link", { name: tab, exact: true })).toBeVisible();
    }

    await page.goto("/leads");
    const leadLink = page.locator('a[href^="/leads/"]').first();
    await expect(leadLink).toBeVisible();
    await leadLink.click();
    await expect(page.getByRole("link", { name: /Communications/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Comments/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Offers/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Activity →", exact: true })).toBeVisible();
  });

  test("assigns an eligible Closer from an application", async ({ page }) => {
    await page.goto("/leads/70000000-0000-4000-8000-000000000002");
    await expect(page.getByRole("heading", { name: "Interview ownership" })).toBeVisible();
    const selector = page.getByLabel("Application Closer");
    await expect(selector).toBeVisible();
    await expect(selector.locator("option")).toHaveCount(2);
    await selector.selectOption("10000000-0000-4000-8000-000000000002");
    await page.getByRole("button", { name: "Assign Closer" }).click();
    await expect(page.getByRole("status")).toHaveText("Closer assigned to this application.");
  });
});
