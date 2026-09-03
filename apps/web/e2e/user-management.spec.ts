import { expect, test, type Page } from "@playwright/test";

const adminEmail = "admin@orbit.local";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in to Orbit" }).click();
  await expect(page).toHaveURL("/");
}

test("admin can invite a teammate, the teammate accepts, and admin manages access", async ({ page, browser }) => {
  const adminPassword = process.env.ORBIT_SEED_ADMIN_PASSWORD;
  expect(adminPassword, "ORBIT_SEED_ADMIN_PASSWORD must match the seeded admin password").toBeTruthy();

  const runId = `${Date.now()}-${test.info().workerIndex}`;
  const teammateName = `Smoke User ${runId}`;
  const teammateEmail = `smoke-user-${runId}@orbit.local`;
  const teammatePassword = "correct horse battery staple";

  await signIn(page, adminEmail, adminPassword!);
  await page.goto("/admin/users");

  await expect(page.getByRole("heading", { name: "Users and invitations" })).toBeVisible();
  const createForm = page.locator('form[aria-label="Create user invitation"]');
  await createForm.getByLabel("Name").fill(teammateName);
  await createForm.getByLabel("Work email").fill(teammateEmail);
  await createForm.getByLabel("Timezone").fill("UTC");
  await createForm.getByRole("button", { name: "Create the first teammate" }).click();

  await expect(page.getByRole("status")).toContainText(`Invitation ready for ${teammateName}`);
  const invitationLink = await page
    .getByText(/\/invite\//)
    .last()
    .textContent();
  expect(invitationLink).toContain("/invite/");

  const inviteContext = await browser.newContext();
  const invitePage = await inviteContext.newPage();
  await invitePage.goto(invitationLink!.trim());
  await expect(invitePage.getByRole("heading", { name: "Set up your account" })).toBeVisible();
  await invitePage.getByLabel("Create password").fill(teammatePassword);
  await invitePage.getByLabel("Confirm password").fill(teammatePassword);
  await invitePage.getByRole("button", { name: "Create password" }).click();
  await expect(invitePage).toHaveURL("/login");

  await signIn(invitePage, teammateEmail, teammatePassword);
  await expect(invitePage.getByRole("navigation", { name: "Primary navigation" })).not.toContainText("Users");
  await invitePage.close();
  await inviteContext.close();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Users and invitations" })).toBeVisible();
  await page.getByRole("button", { name: `Revoke sessions for ${teammateName}` }).click();
  await expect(page.getByRole("status")).toContainText(`Sessions revoked for ${teammateName}`);
  await page.getByRole("button", { name: `Deactivate ${teammateName}` }).click();
  await expect(page.getByRole("status")).toContainText(`${teammateName} is now inactive`);
});
