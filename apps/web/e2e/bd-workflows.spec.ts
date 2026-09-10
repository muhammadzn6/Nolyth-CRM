import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow } from "./performance-helpers";

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

  test("creates and edits an internal communication and comment", async ({ page }) => {
    const runId = Date.now().toString();
    await page.goto(`/leads/${leadId}/communications`);
    await page.getByRole("button", { name: "Add communication" }).click();
    const communicationDialog = page.getByRole("dialog", { name: "Add communication" });
    await communicationDialog.getByLabel("Communication details").fill(`BD communication ${runId}`);
    await communicationDialog.getByRole("button", { name: "Save communication" }).click();
    await expect(page.getByText(`BD communication ${runId}`)).toBeVisible();
    const communicationCard = page.getByText(`BD communication ${runId}`).locator("..");
    await communicationCard.getByRole("button", { name: "Edit" }).click();
    const editCommunicationDialog = page.getByRole("dialog", { name: "Edit communication" });
    await editCommunicationDialog.getByLabel("Communication details").fill(`BD communication edited ${runId}`);
    await editCommunicationDialog.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(`BD communication edited ${runId}`)).toBeVisible();

    await page.goto(`/leads/${leadId}/comments`);
    await page.getByRole("button", { name: "Add comment" }).click();
    const commentDialog = page.getByRole("dialog", { name: "Add comment" });
    await commentDialog.getByLabel("Comment", { exact: true }).fill(`BD comment ${runId}`);
    await commentDialog.getByRole("button", { name: "Save comment" }).click();
    await expect(page.getByText(`BD comment ${runId}`)).toBeVisible();
    const commentCard = page.getByText(`BD comment ${runId}`).locator("..");
    await commentCard.getByRole("button", { name: "Edit" }).click();
    const editCommentDialog = page.getByRole("dialog", { name: "Edit comment" });
    await editCommentDialog.getByLabel("Comment", { exact: true }).fill(`BD comment edited ${runId}`);
    await editCommentDialog.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(`BD comment edited ${runId}`)).toBeVisible();
  });

  test("keeps the application workspace inside a narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/leads/${leadId}`);
    await expect(page.getByRole("heading", { name: "Backend Engineer" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("opens application actions for communication and interview scheduling from overview", async ({ page }) => {
    await page.goto(`/leads/${leadId}`);
    await page.getByRole("button", { name: "Application actions" }).click();
    await expect(page.getByRole("button", { name: "Log communication" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Schedule interview" })).toBeVisible();
    await page.getByRole("button", { name: "Log communication" }).click();
    await expect(page.getByRole("dialog", { name: "Log communication" })).toBeVisible();
  });

  test("creates and edits an offer for the owned application", async ({ page }) => {
    const runId = Date.now().toString();
    await page.goto(`/leads/${leadId}/offers`);
    await page.getByRole("button", { name: "Create offer" }).click();
    const createOfferDialog = page.getByRole("dialog", { name: "Create offer" });
    await createOfferDialog.getByLabel("Compensation amount").fill("145000");
    await createOfferDialog.getByLabel("Offer details").fill(`BD offer ${runId}`);
    await createOfferDialog.getByRole("button", { name: "Create offer", exact: true }).click();
    await expect(page.getByText(`BD offer ${runId}`)).toBeVisible();
    const editOfferCard = page.getByText(`BD offer ${runId}`).locator("..");
    await editOfferCard.getByRole("button", { name: "Edit offer", exact: true }).click();
    const editOfferDialog = page.getByRole("dialog", { name: "Edit offer" });
    await editOfferDialog.getByLabel("Offer details").fill(`BD offer edited ${runId}`);
    await editOfferDialog.getByRole("button", { name: "Save offer" }).click();
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
    await page.getByRole("button", { name: "Schedule interview" }).click();
    const scheduleForm = page.getByRole("dialog", { name: "Schedule interview" });
    const datetimeInputs = scheduleForm.locator('input[type="datetime-local"]');
    await datetimeInputs.nth(0).fill(start);
    await datetimeInputs.nth(1).fill(end);
    await expect(datetimeInputs.nth(0)).toHaveValue(start);
    await expect(datetimeInputs.nth(1)).toHaveValue(end);
    await scheduleForm.getByLabel("Interviewer").fill(`Recruiter ${runId}`);
    const createResponse = page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/interview-rounds"));
    await scheduleForm.getByRole("button", { name: "Schedule interview", exact: true }).click();
    const response = await createResponse;
    expect(response.ok(), `Interview creation failed with ${response.status()}`).toBe(true);
    await page.waitForLoadState("load");
    await page.waitForTimeout(250);
    await page.goto(`/leads/${leadId}/interviews`);
    await expect(page.getByRole("button", { name: "Edit interview" })).toHaveCount(initialInterviewCount + 1);
    let createdCard = page.getByRole("article", { name: `Interview with Recruiter ${runId}` });
    await createdCard.getByRole("button", { name: "Edit interview" }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit interview" });
    await expect(editDialog.getByRole("button", { name: "Save changes" })).toBeVisible();
    await editDialog.getByLabel("Preparation notes").fill(`Updated by BD ${runId}`);
    const updateResponse = page.waitForResponse((response) => response.request().method() === "PATCH" && response.url().includes("/interview-rounds/"));
    const updateReload = page.waitForEvent("framenavigated");
    await editDialog.getByRole("button", { name: "Save changes" }).click({ noWaitAfter: true });
    expect((await updateResponse).ok()).toBe(true);
    await updateReload;
    createdCard = page.getByRole("article", { name: `Interview with Recruiter ${runId}` });
    await createdCard.getByRole("button", { name: "Cancel interview" }).click();
    const cancelDialog = page.getByRole("dialog", { name: "Cancel interview" });
    await cancelDialog.getByPlaceholder("Why is this interview being cancelled?").fill(`Cancelled by BD ${runId}`);
    const cancelResponse = page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/cancel"));
    const cancelReload = page.waitForEvent("framenavigated");
    await cancelDialog.getByRole("button", { exact: true, name: "Cancel interview" }).click({ noWaitAfter: true });
    expect((await cancelResponse).ok()).toBe(true);
    await cancelReload;
    await expect(page.getByRole("article", { name: `Interview with Recruiter ${runId}` })).toContainText("CANCELLED");
  });
});
