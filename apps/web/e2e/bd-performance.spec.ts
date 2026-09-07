import { expect, test } from "@playwright/test";
import { assertPerformancePorts, auditBrowser, expectNoHorizontalOverflow, getPerformanceApiResponse, requestPerformanceApiResponse, requiredE2eCredential, saveBrowserScreenshot, signIn } from "./performance-helpers";

test.describe("BD performance workflow", () => {
  test("shows target progress, score coverage, peer-safe metrics, and interview actions", async ({ page }, testInfo) => {
    assertPerformancePorts(testInfo.project.use.baseURL);
    const bdPassword = requiredE2eCredential("ORBIT_E2E_BD_PASSWORD");
    const audit = auditBrowser(page);
    await signIn(page, "maya.bd@orbit.local", bdPassword);

    await page.locator("main").getByLabel("Add application").click();
    await expect(page).toHaveURL(/\/leads\?new=application/);
    await expect(page.getByRole("form", { name: "Add application" })).toBeVisible();
    await page.goto("/");

    const dailyTracker = page.getByRole("region", { name: "BD daily activity tracker" });
    await expect(dailyTracker).toBeVisible();
    await expect(dailyTracker).toContainText("qualified applications");
    await expect(dailyTracker).toContainText("remaining");
    await dailyTracker.getByRole("link", { name: /View \d+ qualified applications/ }).click();
    await expect(page).toHaveURL(/\/leads$/);
    await page.goto("/");
    const personalPerformance = page.getByLabel("Personal BD performance");
    await expect(personalPerformance).toBeVisible();
    await expect(personalPerformance.getByText(/coverage$/)).toBeVisible();
    await personalPerformance.getByRole("link", { name: "View your application details" }).click();
    await expect(page).toHaveURL(/performanceMetric=QUALIFIED_APPLICATIONS/);
    await expect(page.getByLabel("Performance score drill-down")).toBeVisible();
    await page.goto("/");

    const teamRanking = page.getByLabel("BD team ranking");
    await expect(teamRanking).toBeVisible();
    await expect(teamRanking).toContainText("Qualified");
    await expect(teamRanking).toContainText("Health");
    await expect(teamRanking).not.toContainText("Duplicate rate");
    await expect(teamRanking).not.toContainText("Audit pass");
    await expect(teamRanking).not.toContainText("Recruiter email");
    await expect(teamRanking).not.toContainText("Override reason");

    const recentApplications = page.getByLabel("BD recent applications");
    await recentApplications.locator('a[href^="/leads/"]').first().click();
    await expect(page).toHaveURL(/\/leads\/[^/]+$/);
    await page.goto("/");

    const calendar = page.getByRole("region", { name: "BD calendar", exact: true });
    await expect(calendar).toBeVisible();
    await calendar.getByRole("button", { name: "Week calendar view" }).click();
    await expect(calendar.getByTestId("bd-mini-week-grid")).toBeVisible();
    await calendar.locator(".bd-mini-calendar-event").first().click();
    await expect(page).toHaveURL(/\/leads\/[^/]+\/interviews\?edit=/);
    await saveBrowserScreenshot(page, testInfo, "bd-performance");
    audit.expectClean();
  });

  test("denies Admin performance routes and APIs to a BD", async ({ page }, testInfo) => {
    assertPerformancePorts(testInfo.project.use.baseURL);
    const bdPassword = requiredE2eCredential("ORBIT_E2E_BD_PASSWORD");
    const audit = auditBrowser(page);
    await signIn(page, "maya.bd@orbit.local", bdPassword);

    await page.goto("/admin/performance");
    await expect(page).toHaveURL(/\/unauthorized$/);
    await expect(page.getByRole("heading", { name: "Performance rules" })).toHaveCount(0);
    await expect(page.getByText("Rule version history")).toHaveCount(0);

    const now = new Date().toISOString();
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    for (const path of [
      `/performance/admin?${new URLSearchParams({ from, to: now })}`,
      `/performance/admin/drilldown?${new URLSearchParams({ from, to: now, metric: "QUALIFIED_APPLICATIONS" })}`,
      "/performance/rules",
      "/performance/admin/reassignment-queue",
    ]) {
      const response = await getPerformanceApiResponse(page, path);
      expect(response.status, `${path} must deny a BD`).toBe(403);
      expect(JSON.stringify(response.body)).not.toContain("qualifiedApplications");
      audit.allowResponse(path.split("?")[0]!);
    }

    const futureEffectiveFrom = "2030-01-01T00:00:00.000Z";
    for (const request of [
      { path: "/performance/rules/history", method: "GET" as const },
      { path: "/performance/rules/preview", method: "POST" as const, data: { effectiveFrom: futureEffectiveFrom } },
      {
        path: "/performance/rules",
        method: "PATCH" as const,
        data: {
          id: "10000000-0000-4000-8000-000000000001",
          expectedVersion: 1,
          effectiveFrom: futureEffectiveFrom,
        },
      },
    ]) {
      const response = await requestPerformanceApiResponse(page, request);
      expect(response.status, `${request.method} ${request.path} must deny a BD`).toBe(403);
      expect(JSON.stringify(response.body)).not.toContain("defaultDailyTarget");
      expect(JSON.stringify(response.body)).not.toContain("qualifiedApplications");
    }
    audit.allowConsole("403 (Forbidden)");
    audit.expectClean();
  });

  test("keeps BD performance surfaces inside a narrow viewport", async ({ page }, testInfo) => {
    assertPerformancePorts(testInfo.project.use.baseURL);
    const bdPassword = requiredE2eCredential("ORBIT_E2E_BD_PASSWORD");
    const audit = auditBrowser(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, "maya.bd@orbit.local", bdPassword);

    await expect(page.getByRole("region", { name: "BD daily activity tracker" })).toBeVisible();
    await expect(page.getByLabel("Personal BD performance")).toBeVisible();
    await expect(page.getByLabel("BD team ranking")).toBeVisible();
    const pairedCardHeights = await page.locator('[aria-label="BD calendar"], [aria-label="BD recent applications"]').evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().height));
    expect(pairedCardHeights).toHaveLength(2);
    expect(Math.abs(pairedCardHeights[0]! - pairedCardHeights[1]!)).toBeLessThanOrEqual(1);
    await expectNoHorizontalOverflow(page);
    audit.expectClean();
  });
});
