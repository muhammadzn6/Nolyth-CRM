import { expect, test } from "@playwright/test";
import { assertPerformancePorts, auditBrowser, expectNoHorizontalOverflow, getPerformanceApiResponse, requestPerformanceApiResponse, requiredE2eCredential, saveBrowserScreenshot, signIn } from "./performance-helpers";

test.describe("BD performance workflow", () => {
  test("shows target progress, score coverage, peer-safe metrics, and interview actions", async ({ page }, testInfo) => {
    assertPerformancePorts(testInfo.project.use.baseURL);
    const bdPassword = requiredE2eCredential("ORBIT_E2E_BD_PASSWORD");
    const audit = auditBrowser(page);
    await signIn(page, "maya.bd@orbit.local", bdPassword);

    await page.getByLabel("Add application").click();
    await expect(page).toHaveURL(/\/leads\?new=application/);
    await expect(page.getByRole("form", { name: "Add application" })).toBeVisible();
    await page.goto("/");

    await expect(page.getByLabel("BD work queue")).toBeVisible();
    const qualifiedApplications = page.getByLabel(/Qualified applications today:/);
    await expect(qualifiedApplications).toBeVisible();
    await expect(page.getByLabel(/Remaining target:/)).toBeVisible();
    await qualifiedApplications.click();
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
    await expect(teamRanking).toContainText("Record health");
    await expect(teamRanking).toContainText("Duplicate rate");
    await expect(teamRanking).not.toContainText("Recruiter email");
    await expect(teamRanking).not.toContainText("Override reason");

    const section = page.getByLabel("BD operations");
    await expect(section.getByRole("link", { name: "Edit" }).first()).toBeVisible();
    await expect(section.getByRole("link", { name: "Open application" }).first()).toBeVisible();
    await expect(section.getByRole("link", { name: "Open calendar" }).last()).toBeVisible();
    await section.getByRole("link", { name: "Edit" }).first().click();
    await expect(page).toHaveURL(/\/leads\/[^/]+\/interviews\?edit=/);
    await page.goto("/");
    await section.getByRole("link", { name: "Open application" }).first().click();
    await expect(page).toHaveURL(/\/leads\/[^/]+$/);
    await page.goto("/");
    await section.getByRole("link", { name: "Open calendar" }).last().click();
    await expect(page).toHaveURL(/\/calendar\?date=/);
    await expect(page.getByLabel("Calendar view")).toBeVisible();
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
    audit.expectClean();
  });

  test("keeps BD performance surfaces inside a narrow viewport", async ({ page }, testInfo) => {
    assertPerformancePorts(testInfo.project.use.baseURL);
    const bdPassword = requiredE2eCredential("ORBIT_E2E_BD_PASSWORD");
    const audit = auditBrowser(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, "maya.bd@orbit.local", bdPassword);

    await expect(page.getByLabel("BD work queue")).toBeVisible();
    await expect(page.getByLabel("Personal BD performance")).toBeVisible();
    await expect(page.getByLabel("BD team ranking")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    audit.expectClean();
  });
});
