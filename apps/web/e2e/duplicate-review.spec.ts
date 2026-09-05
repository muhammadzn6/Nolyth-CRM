import { expect, test } from "@playwright/test";
import { assertPerformancePorts, auditBrowser, requiredE2eCredential, saveBrowserScreenshot, signIn } from "./performance-helpers";

type IntakeResponse = { data?: { duplicate?: { classification?: string; qualifiedCredit?: boolean; reviewId?: string | null }; lead?: { appliedDate?: string } } };
type DuplicateReviewResponse = { data?: { status?: string; provisionalCreditGranted?: boolean; lead?: { qualifiedCredit?: boolean; duplicateClassification?: string } } };

async function fillApplication(page: import("@playwright/test").Page, input: { company: string; title: string; url: string }) {
  const form = page.getByRole("form", { name: "Add application" });
  await form.getByLabel("Job title").fill(input.title);
  await form.getByLabel("Company").fill(input.company);
  await form.getByLabel("JD link").fill(input.url);
  await form.getByLabel("Recruiter name").fill("Orbit E2E Recruiter");
  await form.getByLabel("Recruiter email").fill("orbit-e2e-recruiter@example.test");
}

async function submitIntake(page: import("@playwright/test").Page) {
  const response = page.waitForResponse((candidate) => candidate.request().method() === "POST" && candidate.url().includes("/api/v1/leads/intake"))
    .then(async (candidate) => ({ body: await candidate.json() as IntakeResponse, status: candidate.status() }));
  await page.getByRole("button", { name: "Add application" }).last().click();
  return response;
}

test.describe("Duplicate review workflow", () => {
  test("rejects incomplete intake and preserves duplicate credit decisions through Admin review", async ({ page }, testInfo) => {
    assertPerformancePorts(testInfo.project.use.baseURL);
    const bdPassword = requiredE2eCredential("ORBIT_E2E_BD_PASSWORD");
    const adminPassword = requiredE2eCredential("ORBIT_E2E_ADMIN_PASSWORD");
    const audit = auditBrowser(page);
    const runId = `${Date.now()}-${testInfo.retry}`;
    const approved = { company: `Orbit E2E Approved ${runId}`, title: `Platform Engineer Approved ${runId}`, url: `https://jobs.example.test/roles/${runId}/approved?utm_source=orbit#details` };
    const rejected = { company: `Orbit E2E Rejected ${runId}`, title: `Platform Engineer Rejected ${runId}`, url: `https://jobs.example.test/roles/${runId}/rejected?utm_source=orbit#details` };

    await signIn(page, "maya.bd@orbit.local", bdPassword);
    const incomplete = await page.evaluate(async (apiOrigin) => {
      const response = await fetch(`${apiOrigin}/api/v1/leads/intake`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profileId: "not-a-profile", companyName: "", jobTitle: "", rawUrl: "invalid", recruiterName: "", recruiterEmail: "" }),
      });
      return { status: response.status, body: await response.json() };
    }, process.env.ORBIT_E2E_API_ORIGIN ?? "http://localhost:3101");
    expect(incomplete.status).toBe(400);
    audit.allowResponse("/api/v1/leads/intake");

    await page.goto("/leads?new=application");
    await fillApplication(page, approved);
    const ordinary = await submitIntake(page);
    expect(ordinary.status).toBe(201);
    const ordinaryBody = ordinary.body;
    expect(ordinaryBody.data?.duplicate).toMatchObject({ classification: "NONE", qualifiedCredit: true });
    expect(ordinaryBody.data?.lead?.appliedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await page.goto("/leads?new=application");
    await fillApplication(page, { ...approved, url: `https://jobs.example.test/roles/${runId}/approved/?utm_medium=email` });
    const confirmed = await submitIntake(page);
    expect(confirmed.status).toBe(201);
    const confirmedBody = confirmed.body;
    expect(confirmedBody.data?.duplicate).toMatchObject({ classification: "CONFIRMED", qualifiedCredit: false, reviewId: null });

    await page.goto("/leads?new=application");
    await fillApplication(page, { ...approved, url: `https://jobs.example.test/roles/${runId}/approved-other` });
    const likelyConflict = await submitIntake(page);
    expect(likelyConflict.status).toBe(409);
    audit.allowResponse("/api/v1/leads/intake");
    audit.allowConsole("status: 409");
    audit.allowConsole("status of 409");
    await expect(page.getByText("Likely duplicate", { exact: true })).toBeVisible();
    await page.getByLabel("Override reason").fill("Different requisition and recruiter instruction.");
    const provisional = await submitIntake(page);
    expect(provisional.status).toBe(201);
    const provisionalBody = provisional.body;
    expect(provisionalBody.data?.duplicate).toMatchObject({ classification: "LIKELY", qualifiedCredit: true });
    expect(provisionalBody.data?.duplicate?.reviewId).toBeTruthy();

    await page.goto("/leads?new=application");
    await fillApplication(page, rejected);
    expect((await submitIntake(page)).status).toBe(201);
    await page.goto("/leads?new=application");
    await fillApplication(page, { ...rejected, url: `https://jobs.example.test/roles/${runId}/rejected-other` });
    expect((await submitIntake(page)).status).toBe(409);
    audit.allowResponse("/api/v1/leads/intake");
    await page.getByLabel("Override reason").fill("Different requisition and recruiter instruction.");
    const rejectedProvisional = await submitIntake(page);
    expect(rejectedProvisional.status).toBe(201);
    expect(rejectedProvisional.body.data?.duplicate).toMatchObject({ classification: "LIKELY", qualifiedCredit: true });

    await page.context().clearCookies();
    await signIn(page, "admin@orbit.local", adminPassword);
    await page.goto("/admin/performance");
    const approvedReview = page.locator("article").filter({ hasText: `${approved.company} · ${approved.title}` });
    await expect(approvedReview).toBeVisible();
    await approvedReview.getByLabel("Decision reason").fill("Verified as a different requisition.");
    const approval = page.waitForResponse(async (response) => response.request().method() === "POST" && response.url().includes("/performance/duplicate-reviews/") && (await response.json() as DuplicateReviewResponse).data?.lead?.qualifiedCredit === true);
    await approvedReview.getByRole("button", { name: "Approve" }).click();
    expect((await approval).ok()).toBeTruthy();
    await expect(page.getByRole("status")).toContainText("Duplicate override approved.");

    const rejectedReview = page.locator("article").filter({ hasText: `${rejected.company} · ${rejected.title}` });
    await expect(rejectedReview).toBeVisible();
    await rejectedReview.getByLabel("Decision reason").fill("Confirmed same candidate and requisition.");
    const rejection = page.waitForResponse(async (response) => response.request().method() === "POST" && response.url().includes("/performance/duplicate-reviews/") && (await response.json() as DuplicateReviewResponse).data?.lead?.qualifiedCredit === false);
    await rejectedReview.getByRole("button", { name: "Reject" }).click();
    expect((await rejection).ok()).toBeTruthy();
    await expect(page.getByRole("status")).toContainText("Duplicate override rejected.");
    await expect(page.getByText(`${rejected.company} · ${rejected.title}`)).toHaveCount(0);
    await saveBrowserScreenshot(page, testInfo, "duplicate-review");
    audit.expectClean();
  });
});
