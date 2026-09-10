import { expect, test } from "@playwright/test";
import { assertPerformancePorts, auditBrowser, expectNoHorizontalOverflow, requiredE2eCredential, saveBrowserScreenshot, signIn } from "./performance-helpers";

test.describe("Admin BD performance workflow", () => {
  test("keeps the Admin operational pulse on one desktop row", async ({ page }, testInfo) => {
    assertPerformancePorts(testInfo.project.use.baseURL);
    const adminPassword = requiredE2eCredential("ORBIT_E2E_ADMIN_PASSWORD");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await signIn(page, "admin@orbit.local", adminPassword);

    const cards = page.getByLabel("Workspace pulse").locator(".editorial-pulse-card");
    await expect(cards).toHaveCount(8);
    const topEdges = await cards.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().top));
    expect(Math.max(...topEdges) - Math.min(...topEdges)).toBeLessThanOrEqual(1);

    const childOverflow = await cards.evaluateAll((elements) =>
      elements.map((element) => {
        const cardRight = element.getBoundingClientRect().right;
        return Math.max(...Array.from(element.children, (child) => child.getBoundingClientRect().right - cardRight));
      }),
    );
    expect(Math.max(...childOverflow)).toBeLessThanOrEqual(1);
  });

  test("reviews leaderboard state, drill-downs, baseline, reassignment queue, and future rule history", async ({ page }, testInfo) => {
    assertPerformancePorts(testInfo.project.use.baseURL);
    const adminPassword = requiredE2eCredential("ORBIT_E2E_ADMIN_PASSWORD");
    const audit = auditBrowser(page);
    await signIn(page, "admin@orbit.local", adminPassword);

    await expect(page.getByLabel("BD team performance KPIs")).toBeVisible();
    const performancePeriod = page.getByLabel("Performance period");
    await performancePeriod.getByRole("link", { name: "7 days" }).click();
    await expect(page).toHaveURL(/performancePeriod=7d/);
    await expect(performancePeriod.getByRole("link", { name: "Today" })).toBeVisible();
    await expect(performancePeriod.getByRole("link", { name: "30 days" })).toBeVisible();
    await page.getByRole("link", { name: "Qualified applications" }).click();
    await expect(page).toHaveURL(/performanceMetric=QUALIFIED_APPLICATIONS/);
    await expect(page.getByLabel("Performance score drill-down")).toBeVisible();
    await expect(page.getByLabel("Building baseline")).toBeVisible();
    await expect(page.getByLabel("Admin reassignment queue")).toBeVisible();

    await page.goto("/admin/performance");
    await expect(page.getByRole("heading", { name: "Performance rules" })).toBeVisible();
    const currentEffectiveValue = await page.locator("#rule-effective-from").inputValue();
    const currentEffectiveFrom = new Date(`${currentEffectiveValue}:00.000Z`);
    const effectiveFrom = new Date(Math.max(
      Date.now() + 72 * 60 * 60 * 1000,
      currentEffectiveFrom.getTime() + 24 * 60 * 60 * 1000,
    ));
    const localDateTime = `${effectiveFrom.getUTCFullYear()}-${String(effectiveFrom.getUTCMonth() + 1).padStart(2, "0")}-${String(effectiveFrom.getUTCDate()).padStart(2, "0")}T12:00`;
    await page.locator("#rule-effective-from").fill(localDateTime);
    await page.getByRole("button", { name: "Preview impact" }).click();
    await expect(page.getByLabel("Performance rule impact preview")).toBeVisible();
    await page.locator("#confirm-rule-impact").check();
    const saveResponse = page.waitForResponse((response) => response.request().method() === "PATCH" && response.url().includes("/performance/rules"));
    await page.getByRole("button", { name: "Save future version" }).click();
    expect((await saveResponse).ok()).toBeTruthy();
    await expect(page.getByRole("status")).toContainText("Future-effective performance rules saved.");
    await expect(page.getByRole("heading", { name: "Rule version history" })).toBeVisible();
    await saveBrowserScreenshot(page, testInfo, "admin-performance");
    audit.expectClean();
  });

  test("keeps Admin dashboard and rules surfaces inside a narrow viewport", async ({ page }, testInfo) => {
    assertPerformancePorts(testInfo.project.use.baseURL);
    const adminPassword = requiredE2eCredential("ORBIT_E2E_ADMIN_PASSWORD");
    const audit = auditBrowser(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, "admin@orbit.local", adminPassword);

    await expect(page.getByLabel("BD team performance KPIs")).toBeVisible();
    await expect(page.getByLabel("Building baseline")).toBeVisible();
    await expect(page.getByLabel("Admin reassignment queue")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/admin/performance");
    await expect(page.getByRole("heading", { name: "Performance rules" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    audit.expectClean();
  });
});
