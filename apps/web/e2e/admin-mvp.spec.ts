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

  test("keeps legacy employer bookmarks inside the application workflow", async ({ page }) => {
    await page.goto("/admin/clients");
    await expect(page).toHaveURL("/leads");
    await expect(page.getByRole("heading", { name: "Applications", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Employers" })).toHaveCount(0);
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

    await page.goto("/?calendarView=day");
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
    const leadLink = page.getByRole("table", { name: "Application records" }).getByRole("link").first();
    await expect(leadLink).toBeVisible();
    await leadLink.click();
    const leadWorkspace = page.getByRole("navigation", { name: "Lead workspace" });
    await expect(leadWorkspace.getByRole("link", { name: "Communications", exact: true })).toBeVisible();
    await expect(leadWorkspace.getByRole("link", { name: "Comments", exact: true })).toBeVisible();
    await expect(leadWorkspace.getByRole("link", { name: "Offers", exact: true })).toBeVisible();
    await expect(leadWorkspace.getByRole("link", { name: "Activity", exact: true })).toBeVisible();
  });

  test("exposes eligible Closer assignment from an application", async ({ page }) => {
    await page.goto("/leads/70000000-0000-4000-8000-000000000002");
    await page.getByRole("button", { name: /^(Change|Assign) closer$/i }).click();
    const dialog = page.getByRole("dialog", { name: /(Change|Assign) responsible Closer/ });
    await expect(dialog).toBeVisible();
    const selector = dialog.getByLabel("Responsible Closer", { exact: true });
    await expect(selector).toBeVisible();
    await expect(selector.locator("option")).toHaveCount(2);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
  });
});
