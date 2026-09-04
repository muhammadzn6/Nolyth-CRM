import { expect, test } from "@playwright/test";

const bdPassword = process.env.ORBIT_DEMO_PASSWORD ?? "OrbitDemo123!";
const leadId = "70000000-0000-4000-8000-000000000002";

async function signInAsBd(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Work email").fill("maya.bd@orbit.local");
  await page.getByLabel("Password").fill(bdPassword);
  await page.getByRole("button", { name: "Sign in to Orbit" }).click();
  await expect(page).toHaveURL("/");
}

test.describe("BD recruiter workflows", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsBd(page);
  });

  test("shows intake-focused KPIs and daily target signals", async ({ page }) => {
    const pulse = page.getByLabel("BD intake pulse");
    await expect(pulse).toBeVisible();
    for (const label of ["Applications today", "Remaining target", "Data quality issues", "Duplicate applications", "Recruiter responses", "Active applications", "Follow-ups due", "Interviews to schedule"]) {
      await expect(pulse.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(pulse.getByRole("link", { name: /Applications today:.*daily target of 70/ })).toBeVisible();
  });

  test("creates and edits an internal communication and comment", async ({ page }) => {
    const runId = Date.now().toString();
    await page.goto(`/leads/${leadId}/communications`);
    await page.getByLabel("Communication details").fill(`BD communication ${runId}`);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(`BD communication ${runId}`)).toBeVisible();
    const communicationCard = page.getByText(`BD communication ${runId}`).locator("..");
    await communicationCard.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Edit entry").fill(`BD communication edited ${runId}`);
    await communicationCard.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(`BD communication edited ${runId}`)).toBeVisible();

    await page.goto(`/leads/${leadId}/comments`);
    await page.getByLabel("Comment").fill(`BD comment ${runId}`);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(`BD comment ${runId}`)).toBeVisible();
    const commentCard = page.getByText(`BD comment ${runId}`).locator("..");
    await commentCard.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Edit entry").fill(`BD comment edited ${runId}`);
    await commentCard.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(`BD comment edited ${runId}`)).toBeVisible();
  });

  test("creates and edits an offer for the owned application", async ({ page }) => {
    const runId = Date.now().toString();
    await page.goto(`/leads/${leadId}/offers`);
    await page.getByLabel("Compensation amount").first().fill("145000");
    await page.getByLabel("Offer details").first().fill(`BD offer ${runId}`);
    await page.getByRole("button", { name: "Create offer" }).click();
    await expect(page.getByText(`BD offer ${runId}`)).toBeVisible();
    const editOfferCard = page.getByText(`BD offer ${runId}`).locator("..");
    await expect(editOfferCard.getByRole("heading", { name: "Edit offer" })).toBeVisible();
    await editOfferCard.getByLabel("Offer details").fill(`BD offer edited ${runId}`);
    await editOfferCard.getByRole("button", { name: "Save offer" }).click();
    await expect(page.getByText(`BD offer edited ${runId}`)).toBeVisible();
  });

  test("creates, edits, and cancels an interview that appears on the calendar", async ({ page }) => {
    const runId = Date.now().toString();
    const startDate = new Date();
    // Keep each run isolated from seeded and previously-created interviews.
    startDate.setFullYear(2100 + (Number(runId.slice(-4)) % 7000), 0, 15);
    startDate.setHours(9 + (Number(runId.slice(-2)) % 8), (Number(runId.slice(-3)) % 4) * 15, 0, 0);
    const endDate = new Date(startDate.getTime() + 45 * 60 * 1000);
    const inputDate = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}T${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
    const start = inputDate(startDate);
    const end = inputDate(endDate);
    await page.goto(`/leads/${leadId}/interviews`);
    await page.waitForLoadState("networkidle");
    const initialInterviewCount = await page.getByRole("button", { name: "Edit interview" }).count();
    const scheduleForm = page.locator("form").filter({ hasText: "Schedule interview" });
    const datetimeInputs = scheduleForm.locator('input[type="datetime-local"]');
    await datetimeInputs.nth(0).fill(start);
    await datetimeInputs.nth(1).fill(end);
    await expect(datetimeInputs.nth(0)).toHaveValue(start);
    await expect(datetimeInputs.nth(1)).toHaveValue(end);
    await scheduleForm.getByLabel("Interviewer").fill(`Recruiter ${runId}`);
    const createResponse = page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/interview-rounds"));
    await scheduleForm.getByRole("button", { name: "Schedule interview" }).click();
    const response = await createResponse;
    expect(response.ok(), `Interview creation returned HTTP ${response.status()}`).toBe(true);
    await page.waitForLoadState("load");
    await page.waitForTimeout(250);
    await page.goto(`/leads/${leadId}/interviews`);
    await expect(page.getByRole("button", { name: "Edit interview" })).toHaveCount(initialInterviewCount + 1);
    await page.getByRole("button", { name: "Edit interview" }).last().click();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();
    await page.getByLabel("Preparation notes").last().fill(`Updated by BD ${runId}`);
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForLoadState("load");
    await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(0);
  });
});
