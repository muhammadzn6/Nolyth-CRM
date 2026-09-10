import { expect, test, type Page } from "@playwright/test";

import {
  assertPerformancePorts,
  auditBrowser,
  requestPerformanceApiResponse,
  requiredE2eCredential,
  signIn,
} from "./performance-helpers";

const adminEmail = "admin@orbit.local";
const bdEmail = "maya.bd@orbit.local";
const closerEmail = "noah.closer@orbit.local";
const bdId = "10000000-0000-4000-8000-000000000001";
const closerId = "10000000-0000-4000-8000-000000000002";

type ApiEnvelope<T> = { data: T };

function dataFrom<T>(body: unknown): T {
  expect(body).toBeTruthy();
  expect(typeof body).toBe("object");
  expect(body).toHaveProperty("data");
  return (body as ApiEnvelope<T>).data;
}

async function changeUser(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await signIn(page, email, password);
}

function interviewRoundCard(page: Page, interviewer: string) {
  return page
    .getByRole("region", { name: "Interview rounds" })
    .locator(":scope > *")
    .filter({ hasText: interviewer })
    .first();
}

test("runs the complete application-to-placement handoff across Admin, BD, and Closer", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  assertPerformancePorts(testInfo.project.use.baseURL);
  const browserAudit = auditBrowser(page);
  const adminPassword = requiredE2eCredential("ORBIT_E2E_ADMIN_PASSWORD");
  const bdPassword = requiredE2eCredential("ORBIT_E2E_BD_PASSWORD");
  const closerPassword = process.env.ORBIT_DEMO_PASSWORD ?? "OrbitDemo123!";
  const runId = `${Date.now()}-${testInfo.workerIndex}`;
  const candidateName = `Journey Candidate ${runId}`;
  const profileName = `Journey Profile ${runId}`;
  const jobTitle = `Platform Journey ${runId}`;
  const companyName = `Journey Systems ${runId}`;
  const recruiterName = `Recruiter ${runId}`;
  const recruiterEmail = `recruiter.${runId}@example.com`;
  const communicationBody = `Positive recruiter response ${runId}`;
  const interviewer = `Interviewer ${runId}`;
  const closerNotes = `Closer notes ${runId}`;
  const officialFeedback = `Passed interview ${runId}`;
  const offerDetails = `Placement offer ${runId}`;

  const seed = Number(runId.replace(/\D/g, "").slice(-8));
  const year = 2000 + (seed % 20);
  const month = 1;
  const day = 2 + (Math.floor(seed / 240) % 25);
  const hour = 8 + (Math.floor(seed / 6_000) % 8);
  const minute = Math.floor(seed / 48_000) % 2 === 0 ? 0 : 30;
  const pad = (value: number) => String(value).padStart(2, "0");
  const startsAtLocal = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
  const endsAtLocal = `${year}-${pad(month)}-${pad(day)}T${pad(hour + 1)}:${pad(minute)}`;
  const expectedStartsAt = new Date(Date.UTC(year, month - 1, day, hour + 5, minute)).toISOString();

  await signIn(page, adminEmail, adminPassword);

  const candidateResponse = await requestPerformanceApiResponse(page, {
    path: "/candidates",
    method: "POST",
    data: {
      firstName: candidateName,
      lastName: "E2E",
      email: `journey.${runId}@example.com`,
      timezone: "America/New_York",
    },
  });
  expect(candidateResponse.status).toBe(201);
  const candidate = dataFrom<{ id: string }>(candidateResponse.body);

  const profileResponse = await requestPerformanceApiResponse(page, {
    path: "/profiles",
    method: "POST",
    data: { candidateId: candidate.id, name: profileName },
  });
  expect(profileResponse.status).toBe(201);
  const profile = dataFrom<{ id: string; version: number }>(profileResponse.body);

  const activationResponse = await requestPerformanceApiResponse(page, {
    path: `/profiles/${profile.id}/activate`,
    method: "POST",
    data: { expectedVersion: profile.version },
  });
  expect(activationResponse.status).toBe(201);

  const bdAssignmentResponse = await requestPerformanceApiResponse(page, {
    path: `/profiles/${profile.id}/bd-assignments`,
    method: "POST",
    data: { userId: bdId },
  });
  expect(bdAssignmentResponse.status).toBe(201);

  const closerEligibilityResponse = await requestPerformanceApiResponse(page, {
    path: `/profiles/${profile.id}/closer-eligibility`,
    method: "POST",
    data: { userId: closerId },
  });
  expect(closerEligibilityResponse.status).toBe(201);

  await changeUser(page, bdEmail, bdPassword);
  await page.goto("/leads?new=application");
  const intakeDialog = page.getByRole("dialog", { name: "Add application" });
  await expect(intakeDialog).toBeVisible();
  await intakeDialog.getByLabel("Candidate profile").selectOption({ label: profileName });
  await intakeDialog.getByLabel("Job title").fill(jobTitle);
  await intakeDialog.getByLabel("Company").fill(companyName);
  await intakeDialog.getByLabel("JD link").fill(`https://jobs.example.com/${runId}`);
  await intakeDialog.getByLabel("Recruiter name").fill(recruiterName);
  await intakeDialog.getByLabel("Recruiter email").fill(recruiterEmail);
  const intakeResponsePromise = page.waitForResponse((response) =>
    response.request().method() === "POST" && response.url().endsWith("/api/v1/leads/intake"),
  );
  await intakeDialog.getByRole("button", { name: "Add application", exact: true }).click();
  const intakeResponse = await intakeResponsePromise;
  expect(intakeResponse.status()).toBe(201);
  const intake = dataFrom<{ lead: { id: string; status: string } }>(await intakeResponse.json());
  const leadId = intake.lead.id;
  expect(intake.lead.status).toBe("APPLIED");
  await expect(intakeDialog).toBeHidden();

  await page.goto(`/leads/${leadId}/communications`);
  await page.getByRole("button", { name: "Log recruiter response" }).click();
  const communicationDialog = page.getByRole("dialog", { name: "Log recruiter response" });
  await communicationDialog.getByLabel("Direction").selectOption("INBOUND");
  await communicationDialog.getByLabel("Recruiter or contact").selectOption({ label: `${recruiterName} · ${recruiterEmail}` });
  await communicationDialog.getByLabel("Subject").fill(`Interview invitation ${runId}`);
  await communicationDialog.getByLabel("Outcome").fill("Positive response");
  await communicationDialog.getByLabel("Communication details").fill(communicationBody);
  const communicationResponsePromise = page.waitForResponse((response) =>
    response.request().method() === "POST" && response.url().endsWith(`/api/v1/leads/${leadId}/communications`),
  );
  await communicationDialog.getByRole("button", { name: "Save communication" }).click();
  expect((await communicationResponsePromise).status()).toBe(201);
  await expect(communicationDialog).toBeHidden();
  await expect(page.getByText(communicationBody)).toBeVisible();

  const responseReceived = await requestPerformanceApiResponse(page, { path: `/leads/${leadId}`, method: "GET" });
  expect(responseReceived.status).toBe(200);
  expect(dataFrom<{ status: string }>(responseReceived.body).status).toBe("RESPONSE_RECEIVED");

  await page.goto(`/leads/${leadId}`);
  await page.getByRole("button", { name: "Assign closer" }).click();
  const closerDialog = page.getByRole("dialog", { name: "Assign responsible Closer" });
  await closerDialog.getByLabel("Responsible Closer", { exact: true }).selectOption(closerId);
  const closerAssignmentPromise = page.waitForResponse((response) =>
    response.request().method() === "POST" && response.url().endsWith(`/api/v1/leads/${leadId}/closer`),
  );
  await closerDialog.getByRole("button", { name: "Save closer" }).click();
  expect((await closerAssignmentPromise).status()).toBe(201);
  await expect(closerDialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Change closer" })).toBeVisible();

  await page.goto(`/leads/${leadId}/interviews`);
  await page.getByRole("button", { name: "Schedule interview" }).click();
  const interviewDialog = page.getByRole("dialog", { name: "Schedule interview" });
  await interviewDialog.getByLabel("Closer").selectOption(closerId);
  await interviewDialog.getByLabel("Round type").selectOption("TECHNICAL");
  await interviewDialog.getByLabel("Starts").fill(startsAtLocal);
  await interviewDialog.getByLabel("Ends").fill(endsAtLocal);
  await interviewDialog.getByLabel("Timezone").fill("America/New_York");
  await interviewDialog.getByLabel("Interviewer").fill(interviewer);
  await interviewDialog.getByLabel("Meeting link").fill(`https://meet.example.com/${runId}`);
  await interviewDialog.getByLabel("Preparation notes").fill(`Prepare system design ${runId}`);
  const interviewResponsePromise = page.waitForResponse((response) =>
    response.request().method() === "POST" && response.url().endsWith(`/api/v1/leads/${leadId}/interview-rounds`),
  );
  await interviewDialog.getByRole("button", { name: "Schedule interview", exact: true }).click();
  const interviewResponse = await interviewResponsePromise;
  expect(interviewResponse.status()).toBe(201);
  const interview = dataFrom<{ id: string; startsAt: string; status: string }>(await interviewResponse.json());
  expect(interview.startsAt).toBe(expectedStartsAt);
  expect(interview.status).toBe("SCHEDULED");
  await expect(interviewDialog).toBeHidden();
  await expect(page.getByText(`${interviewer}`)).toBeVisible();
  await expect(page.getByText("60 min", { exact: false })).toBeVisible();
  await expect(page.getByText("Noah Patel (Closer)", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Join meeting" })).toBeVisible();

  await changeUser(page, closerEmail, closerPassword);
  await page.goto(`/leads/${leadId}/interviews`);
  let interviewCard = interviewRoundCard(page, interviewer);
  const attendanceResponsePromise = page.waitForResponse((response) =>
    response.request().method() === "POST" && response.url().endsWith(`/api/v1/interview-rounds/${interview.id}/attendance`),
  );
  const attendanceReload = page.waitForEvent("framenavigated");
  await interviewCard.getByRole("button", { name: "Mark attended" }).click({ noWaitAfter: true });
  expect((await attendanceResponsePromise).status()).toBe(201);
  await attendanceReload;
  interviewCard = interviewRoundCard(page, interviewer);
  await expect(interviewCard).toContainText("WAITING FEEDBACK");
  await interviewCard.getByPlaceholder("Closer notes").fill(closerNotes);
  const notesResponsePromise = page.waitForResponse((response) =>
    response.request().method() === "POST" && response.url().endsWith(`/api/v1/interview-rounds/${interview.id}/closer-notes`),
  );
  const notesReload = page.waitForEvent("framenavigated");
  await interviewCard.getByRole("button", { name: "Save notes" }).click({ noWaitAfter: true });
  expect((await notesResponsePromise).status()).toBe(201);
  await notesReload;

  await changeUser(page, bdEmail, bdPassword);
  await page.goto(`/leads/${leadId}/interviews`);
  interviewCard = interviewRoundCard(page, interviewer);
  await interviewCard.getByLabel("Official outcome").selectOption("PASSED");
  await interviewCard.getByPlaceholder("Official feedback (optional)").fill(officialFeedback);
  const outcomeResponsePromise = page.waitForResponse((response) =>
    response.request().method() === "POST" && response.url().endsWith(`/api/v1/interview-rounds/${interview.id}/official-result`),
  );
  const outcomeReload = page.waitForEvent("framenavigated");
  await interviewCard.getByRole("button", { name: "Save outcome" }).click({ noWaitAfter: true });
  expect((await outcomeResponsePromise).status()).toBe(201);
  await outcomeReload;
  interviewCard = interviewRoundCard(page, interviewer);
  await expect(interviewCard).toContainText("PASSED");

  await page.goto(`/leads/${leadId}/offers`);
  await page.getByRole("button", { name: "Create offer" }).click();
  const offerDialog = page.getByRole("dialog", { name: "Create offer" });
  await offerDialog.getByLabel("Compensation amount").fill("165000");
  await offerDialog.getByLabel("Currency").fill("USD");
  await offerDialog.getByLabel("Employment type").fill("Full-time");
  await offerDialog.getByLabel("Offer details").fill(offerDetails);
  const offerResponsePromise = page.waitForResponse((response) =>
    response.request().method() === "POST" && response.url().endsWith(`/api/v1/leads/${leadId}/offers`),
  );
  await offerDialog.getByRole("button", { name: "Create offer", exact: true }).click();
  const offerResponse = await offerResponsePromise;
  expect(offerResponse.status()).toBe(201);
  const offer = dataFrom<{ id: string }>(await offerResponse.json());
  await expect(offerDialog).toBeHidden();
  await expect(page.getByText(offerDetails)).toBeVisible();

  let offerCard = page.getByText(offerDetails, { exact: true }).locator("..");
  const acceptResponsePromise = page.waitForResponse((response) =>
    response.request().method() === "POST" && response.url().endsWith(`/api/v1/offers/${offer.id}/decision`),
  );
  const acceptReload = page.waitForEvent("framenavigated");
  await offerCard.getByRole("button", { name: "Accept", exact: true }).click({ noWaitAfter: true });
  expect((await acceptResponsePromise).status()).toBe(201);
  await acceptReload;
  await page.waitForLoadState("networkidle");

  offerCard = page.getByText(offerDetails, { exact: true }).locator("..");
  await offerCard.getByLabel("Placement start date").fill("2030-01-15");
  await expect(offerCard.getByRole("button", { name: "Confirm start date" })).toBeEnabled();
  const placementResponsePromise = page.waitForResponse((response) =>
    response.request().method() === "POST" && response.url().endsWith(`/api/v1/offers/${offer.id}/place`),
  );
  const placementReload = page.waitForEvent("framenavigated");
  await offerCard.getByRole("button", { name: "Confirm start date" }).click({ noWaitAfter: true });
  expect((await placementResponsePromise).status()).toBe(201);
  await placementReload;
  await expect(page.getByRole("button", { name: "Mark started" })).toBeVisible();

  const startedResponsePromise = page.waitForResponse((response) =>
    response.request().method() === "POST" && response.url().endsWith(`/api/v1/offers/${offer.id}/start`),
  );
  const startedReload = page.waitForEvent("framenavigated");
  await page.getByRole("button", { name: "Mark started" }).click({ noWaitAfter: true });
  expect((await startedResponsePromise).status()).toBe(201);
  await startedReload;
  await expect(page.getByRole("button", { name: "Mark started" })).toHaveCount(0);

  await changeUser(page, adminEmail, adminPassword);
  await page.goto(`/leads/${leadId}`);
  await expect(page.getByRole("heading", { name: jobTitle })).toBeVisible();
  await expect(page.getByText("STARTED", { exact: true })).toBeVisible();

  const finalLeadResponse = await requestPerformanceApiResponse(page, { path: `/leads/${leadId}`, method: "GET" });
  expect(finalLeadResponse.status).toBe(200);
  expect(dataFrom<{ status: string; responsibleCloserId: string | null; startDate: string | null }>(finalLeadResponse.body)).toMatchObject({
    status: "STARTED",
    responsibleCloserId: closerId,
    startDate: "2030-01-15",
  });

  const finalRoundsResponse = await requestPerformanceApiResponse(page, { path: `/leads/${leadId}/interview-rounds`, method: "GET" });
  expect(finalRoundsResponse.status).toBe(200);
  const finalRound = dataFrom<Array<{
    attendance: string | null;
    closerNotes: string | null;
    id: string;
    officialFeedback: string | null;
    officialResult: string | null;
    startsAt: string;
    status: string;
  }>>(finalRoundsResponse.body).find((round) => round.id === interview.id);
  expect(finalRound).toMatchObject({
    attendance: "ATTENDED",
    closerNotes,
    officialFeedback,
    officialResult: "PASSED",
    startsAt: expectedStartsAt,
    status: "PASSED",
  });

  browserAudit.expectClean();
});
