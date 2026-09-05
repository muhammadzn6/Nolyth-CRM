import {
  acceptInvitationSchema,
  changePasswordRequestSchema,
  passwordResetRequestSchema,
  passwordResetCompleteSchema,
  passwordResetResponseSchema,
  archiveCandidateRequestSchema,
  archiveProfileRequestSchema,
  assignmentSchema,
  assignmentUserRequestSchema,
  candidateListQuerySchema,
  candidateSummarySchema,
  companySummarySchema,
  calendarQuerySchema,
  closerDashboardDataSchema,
  interviewSummarySchema,
  activityEventSummarySchema,
  activityListQuerySchema,
  analyticsBreakdownSchema,
  analyticsQuerySchema,
  analyticsKpisSchema,
  notificationListQuerySchema,
  notificationSummarySchema,
  createDocumentSchema,
  documentSummarySchema,
  documentUploadIntentResultSchema,
  documentDownloadResultSchema,
  taskListQuerySchema,
  taskSummarySchema,
  completeTaskSchema,
  cancelTaskSchema,
  communicationListQuerySchema,
  communicationSummarySchema,
  commentSummarySchema,
  offerSummarySchema,
  offerDecisionSchema,
  placementDateSchema,
  startPlacementSchema,
  createOfferSchema,
  updateOfferSchema,
  interviewStatusActionSchema,
  interviewAttendanceSchema,
  interviewNotesSchema,
  officialResultSchema,
  updateInterviewSchema,
  availabilityRuleSchema,
  availabilityExceptionSchema,
  availabilityRuleInputSchema,
  availabilityExceptionInputSchema,
  createCommentSchema,
  createCommunicationSchema,
  createCandidateSchema,
  createProfileSchema,
  endAssignmentRequestSchema,
  createUserSchema,
  errorResponseSchema,
  loginRequestSchema,
  createLeadSchema,
  createApplicationIntakeSchema,
  applicationIntakeResultSchema,
  leadDetailSchema,
  leadListQuerySchema,
  leadSummarySchema,
  profileListQuerySchema,
  profileStatusRequestSchema,
  profileSummarySchema,
  restoreCandidateRequestSchema,
  sessionUserSchema,
  successResponseSchema,
  updateCandidateRequestSchema,
  updateProfileRequestSchema,
  updateUserSchema,
  userSummarySchema,
  uuidSchema,
  type Assignment,
  type AcceptInvitation,
  type ChangePasswordRequest,
  type CandidateListQuery,
  type CandidateSummary,
  type CompanySummary,
  type CreateCompany,
  type UpdateCompanyRequest,
  type CloserDashboardData,
  type InterviewSummary,
  type ActivityEventSummary,
  type AnalyticsKpis,
  type NotificationSummary,
  type DocumentSummary,
  type TaskListQuery,
  type TaskSummary,
  type CreateCandidate,
  type CreateProfile,
  type CreateLead,
  type CreateApplicationIntake,
  type ApplicationIntakeResult,
  type LeadListQuery,
  type LeadSummary,
  type CreateUser,
  type LoginRequest,
  type ProfileListQuery,
  type ProfileSummary,
  type SessionUser,
  type UpdateCandidate,
  type UpdateProfile,
  type UpdateUser,
  type UserSummary,
  type CommunicationSummary,
  type CommentSummary,
  type OfferSummary,
  type CreateOffer,
  type AvailabilityRule,
  type AvailabilityException,
  type AvailabilityRuleInput,
  type AvailabilityExceptionInput,
  type CreateComment,
  type CreateCommunication,
  type UpdateCommunication,
  type UpdateComment,
  type CreateInterview,
  type UpdateInterview,
  createInterviewSchema,
  calendarConnectionSchema,
  companyCloserAssignmentSchema,
  createCompanySchema,
  updateCompanyRequestSchema,
  googleCalendarConnectSchema,
  type CalendarConnection,
  type CompanyCloserAssignment,
  bulkImportResultSchema,
  bdTargetScheduleInputSchema,
  bdWorkQueueSchema,
  bdTargetScheduleSchema,
  duplicateReviewWithLeadSchema,
  performanceApprovedLeaveInputSchema,
  performanceApprovedLeaveSchema,
  performanceHolidayInputSchema,
  performanceHolidaySchema,
  performanceRuleInputSchema,
  performanceRuleMutationSchema,
  performanceRulePreviewSchema,
  performanceRuleSchema,
  updateBdTargetScheduleInputSchema,
  updateDuplicateReviewInputSchema,
  updatePerformanceApprovedLeaveInputSchema,
  updatePerformanceHolidayInputSchema,
  performanceVersionInputSchema,
  type BdTargetSchedule,
  type BdWorkQueue,
  type PerformanceApprovedLeave,
  type PerformanceHoliday,
  type PerformanceRuleMutation,
  type PerformanceRulePreview,
  type PerformanceRuleSet,
} from "@orbit/contracts";
import { loadWebEnv } from "@orbit/config";

export type CreateUserResult = {
  user: UserSummary;
  invitationToken: string;
};

export type CandidateDetail = CandidateSummary & { profiles: ProfileSummary[] };
export type CandidateContext = Pick<CandidateSummary, "id" | "firstName" | "lastName" | "preferredName">;
export type ProfileDetail = ProfileSummary & { candidate: CandidateContext };
export type Page<T> = { items: T[]; nextCursor: string | null };
export type LeadDetail = LeadSummary & { company: Record<string, unknown>; contacts: ReadonlyArray<Record<string, unknown>> };
export type CandidateListInput = Omit<CandidateListQuery, "limit"> & { limit?: number };
export type ProfileListInput = Omit<ProfileListQuery, "limit"> & { limit?: number };
export type LeadListInput = Partial<Omit<LeadListQuery, "limit">> & { limit?: number };
export type CalendarInput = { companyId?: string; from?: string; to?: string };
export type TaskListInput = Partial<Omit<TaskListQuery, "limit">> & { limit?: number };
export type DashboardData = { kpis: AnalyticsKpis; breakdowns: { statuses: Array<{ key: string; count: number }>; sources: Array<{ key: string; count: number }> }; upcomingInterviews: number };
export type DuplicateReviewWithLead = ReturnType<typeof duplicateReviewWithLeadSchema.parse>;
export type PerformanceRuleInput = Omit<PerformanceRuleMutation, "id" | "expectedVersion">;
export type CreateBdTargetSchedule = Pick<BdTargetSchedule, "bdId" | "dailyTarget"> & {
  effectiveTo?: string;
  auditMetadata?: Record<string, unknown>;
};
export type CreatePerformanceHoliday = Pick<PerformanceHoliday, "holidayDate" | "name"> & {
  auditMetadata?: Record<string, unknown>;
};
export type CreatePerformanceApprovedLeave = Pick<
  PerformanceApprovedLeave,
  "bdId" | "startsAt" | "endsAt" | "reason" | "availableStartHour" | "availableEndHour"
>;
export type { PerformanceRulePreview };
export type { BdWorkQueue };
type Schema<T> = {
  safeParse(data: unknown):
    | { success: true; data: T }
    | { success: false };
};

function getApiBaseUrl(): string {
  return loadWebEnv({
    NEXT_PUBLIC_APP_BASE_URL: process.env.NEXT_PUBLIC_APP_BASE_URL,
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  }).apiBaseUrl;
}

function getTrustedOrigin(): string {
  const env = loadWebEnv({
    NEXT_PUBLIC_APP_BASE_URL: process.env.NEXT_PUBLIC_APP_BASE_URL,
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  });
  return new URL(env.appBaseUrl).origin;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly requestId?: string,
    public readonly status?: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function readEnvelope(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  if (response.ok) {
    const parsed = successResponseSchema.safeParse(body);
    if (!parsed.success) throw new ApiClientError("The API returned an invalid response.", "INVALID_RESPONSE", undefined, response.status);
    return parsed.data.data;
  }

  const parsed = errorResponseSchema.safeParse(body);
  if (parsed.success) {
    throw new ApiClientError(parsed.data.error.message, parsed.data.error.code, parsed.data.meta.requestId, response.status, parsed.data.error.details);
  }
  throw new ApiClientError("Orbit could not complete the request.", "INVALID_RESPONSE", undefined, response.status);
}

function parseUserId(id: string): string {
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) throw new ApiClientError("The selected user is invalid.", "VALIDATION_ERROR");
  return parsed.data;
}

function parseUserSummary(data: unknown): UserSummary {
  const parsed = userSummarySchema.safeParse(data);
  if (!parsed.success) throw new ApiClientError("The API returned an invalid user.", "INVALID_RESPONSE");
  return parsed.data;
}

function parseId(id: string, label: string): string {
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) throw new ApiClientError(`The selected ${label} is invalid.`, "VALIDATION_ERROR");
  return parsed.data;
}

function parseResource<T>(schema: Schema<T>, data: unknown, label: string): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new ApiClientError(`The API returned an invalid ${label}.`, "INVALID_RESPONSE");
  return parsed.data;
}

function parsePage<T>(data: unknown, itemSchema: Schema<T>, label: string): Page<T> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new ApiClientError(`The API returned an invalid ${label}.`, "INVALID_RESPONSE");
  }
  const candidate = data as { items?: unknown; nextCursor?: unknown };
  if (
    Object.keys(candidate).some((key) => key !== "items" && key !== "nextCursor") ||
    !Array.isArray(candidate.items) ||
    !(candidate.nextCursor === null || uuidSchema.safeParse(candidate.nextCursor).success)
  ) {
    throw new ApiClientError(`The API returned an invalid ${label}.`, "INVALID_RESPONSE");
  }
  return {
    items: candidate.items.map((item) => parseResource(itemSchema, item, label)),
    nextCursor: candidate.nextCursor as string | null,
  };
}

function queryString(values: Record<string, unknown>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) query.set(key, String(value));
  }
  return query.toString();
}

async function read(path: string, cookie?: string): Promise<unknown> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    cache: "no-store",
    credentials: "include",
    headers: cookie ? { cookie } : undefined,
  });
  console.info("[Orbit frontend] API read", { path, status: response.status, ok: response.ok });
  if (!response.ok) console.error("[Orbit frontend] API read failed", { path, status: response.status });
  return readEnvelope(response);
}

async function mutate(
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<unknown> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    credentials: "include",
    headers: body === undefined
      ? { origin: getTrustedOrigin() }
      : { "content-type": "application/json", origin: getTrustedOrigin() },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  console.info("[Orbit frontend] API mutate", { method, path, status: response.status, ok: response.ok });
  if (!response.ok) console.error("[Orbit frontend] API mutate failed", { method, path, status: response.status });
  return readEnvelope(response);
}

function parseInput<T>(schema: Schema<T>, input: unknown, message: string): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new ApiClientError(message, "VALIDATION_ERROR");
  return parsed.data;
}

function parseCandidateDetail(data: unknown): CandidateDetail {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new ApiClientError("The API returned an invalid candidate.", "INVALID_RESPONSE");
  }
  const { profiles, ...summary } = data as Record<string, unknown>;
  if (!Array.isArray(profiles)) {
    throw new ApiClientError("The API returned an invalid candidate.", "INVALID_RESPONSE");
  }
  return {
    ...parseResource(candidateSummarySchema, summary, "candidate"),
    profiles: profiles.map((profile) => parseResource(profileSummarySchema, profile, "profile")),
  };
}

function parseCandidateContext(data: unknown): CandidateContext {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new ApiClientError("The API returned an invalid profile candidate.", "INVALID_RESPONSE");
  }
  const candidate = data as Record<string, unknown>;
  const expectedKeys = ["firstName", "id", "lastName", "preferredName"];
  if (
    Object.keys(candidate).sort().join(",") !== expectedKeys.join(",") ||
    !uuidSchema.safeParse(candidate.id).success ||
    typeof candidate.firstName !== "string" || !candidate.firstName.trim() ||
    typeof candidate.lastName !== "string" || !candidate.lastName.trim() ||
    !(candidate.preferredName === null ||
      (typeof candidate.preferredName === "string" && candidate.preferredName.trim()))
  ) {
    throw new ApiClientError("The API returned an invalid profile candidate.", "INVALID_RESPONSE");
  }
  return candidate as CandidateContext;
}

function parseProfileDetail(data: unknown): ProfileDetail {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new ApiClientError("The API returned an invalid profile.", "INVALID_RESPONSE");
  }
  const { candidate, ...summary } = data as Record<string, unknown>;
  return {
    ...parseResource(profileSummarySchema, summary, "profile"),
    candidate: parseCandidateContext(candidate),
  };
}

function parseCreateUserResult(data: unknown): CreateUserResult {
  if (!data || typeof data !== "object") {
    throw new ApiClientError("The API returned an invalid invitation.", "INVALID_RESPONSE");
  }

  const candidate = data as { user?: unknown; invitationToken?: unknown };
  if (typeof candidate.invitationToken !== "string" || candidate.invitationToken.trim().length === 0) {
    throw new ApiClientError("The API returned an invalid invitation.", "INVALID_RESPONSE");
  }

  return {
    user: parseUserSummary(candidate.user),
    invitationToken: candidate.invitationToken,
  };
}

export async function login(input: LoginRequest): Promise<SessionUser> {
  const parsed = loginRequestSchema.safeParse(input);
  if (!parsed.success) throw new ApiClientError("Enter a valid work email and password.", "VALIDATION_ERROR");

  const response = await fetch(`${getApiBaseUrl()}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", origin: getTrustedOrigin() },
    body: JSON.stringify(parsed.data),
  });
  console.info("[Orbit frontend] API login", { status: response.status, ok: response.ok });
  if (!response.ok) console.error("[Orbit frontend] API login failed", { status: response.status });
  const data = await readEnvelope(response);
  const actor = sessionUserSchema.safeParse(data);
  if (!actor.success) throw new ApiClientError("The API returned an invalid user session.", "INVALID_RESPONSE");
  return actor.data;
}

export async function logout(): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: { origin: getTrustedOrigin() },
  });

  if (!response.ok) await readEnvelope(response);
}

export async function changePassword(input: ChangePasswordRequest): Promise<void> {
  const parsed = changePasswordRequestSchema.safeParse(input);
  if (!parsed.success) throw new ApiClientError("Use a new password with at least 12 characters.", "VALIDATION_ERROR");

  const response = await fetch(`${getApiBaseUrl()}/auth/change-password`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", origin: getTrustedOrigin() },
    body: JSON.stringify(parsed.data),
  });
  await readEnvelope(response);
}

export async function requestPasswordReset(email: string): Promise<{ accepted: true; token?: string }> {
  const parsed = parseInput(passwordResetRequestSchema, { email }, "Enter a valid email address.");
  return parseResource(passwordResetResponseSchema, await mutate("/auth/password-reset/request", "POST", parsed), "password reset request");
}

export async function completePasswordReset(token: string, newPassword: string): Promise<void> {
  const parsed = parseInput(passwordResetCompleteSchema, { token, newPassword }, "Enter a valid reset token and password.");
  await mutate("/auth/password-reset/complete", "POST", parsed);
}

export async function getCurrentActor(cookie?: string): Promise<SessionUser | null> {
  const response = await fetch(`${getApiBaseUrl()}/auth/me`, {
    cache: "no-store",
    credentials: "include",
    headers: cookie ? { cookie } : undefined,
  });
  if (response.status === 401) return null;

  const data = await readEnvelope(response);
  const actor = sessionUserSchema.safeParse(data);
  if (!actor.success) throw new ApiClientError("The API returned an invalid user session.", "INVALID_RESPONSE");
  return actor.data;
}

export async function listUsers(cookie?: string): Promise<UserSummary[]> {
  const response = await fetch(`${getApiBaseUrl()}/users`, {
    cache: "no-store",
    credentials: "include",
    headers: cookie ? { cookie } : undefined,
  });
  const data = await readEnvelope(response);
  const users = userSummarySchema.array().safeParse(data);
  if (!users.success) throw new ApiClientError("The API returned an invalid user list.", "INVALID_RESPONSE");
  return users.data;
}

export async function createUser(input: CreateUser): Promise<CreateUserResult> {
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) throw new ApiClientError("Enter a valid name, email, role, and timezone.", "VALIDATION_ERROR");

  const response = await fetch(`${getApiBaseUrl()}/users`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", origin: getTrustedOrigin() },
    body: JSON.stringify(parsed.data),
  });
  return parseCreateUserResult(await readEnvelope(response));
}

export async function updateUser(id: string, input: UpdateUser): Promise<UserSummary> {
  const userId = parseUserId(id);
  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) throw new ApiClientError("Enter a valid user update.", "VALIDATION_ERROR");

  const response = await fetch(`${getApiBaseUrl()}/users/${userId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "content-type": "application/json", origin: getTrustedOrigin() },
    body: JSON.stringify(parsed.data),
  });
  return parseUserSummary(await readEnvelope(response));
}

export async function revokeUserSessions(id: string): Promise<void> {
  const userId = parseUserId(id);
  const response = await fetch(`${getApiBaseUrl()}/users/${userId}/revoke-sessions`, {
    method: "POST",
    credentials: "include",
    headers: { origin: getTrustedOrigin() },
  });

  await readEnvelope(response);
}

export async function resendInvitation(id: string): Promise<CreateUserResult> {
  const userId = parseUserId(id);
  const response = await fetch(`${getApiBaseUrl()}/users/${userId}/resend-invitation`, { method: "POST", credentials: "include", headers: { origin: getTrustedOrigin() } });
  return parseCreateUserResult(await readEnvelope(response));
}

export async function acceptInvitation(input: AcceptInvitation): Promise<SessionUser> {
  const parsed = acceptInvitationSchema.safeParse(input);
  if (!parsed.success) throw new ApiClientError("Use a valid invitation link and a password with at least 12 characters.", "VALIDATION_ERROR");

  const response = await fetch(`${getApiBaseUrl()}/auth/invitations/accept`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", origin: getTrustedOrigin() },
    body: JSON.stringify(parsed.data),
  });
  const data = await readEnvelope(response);
  const actor = sessionUserSchema.safeParse(data);
  if (!actor.success) throw new ApiClientError("The API returned an invalid user session.", "INVALID_RESPONSE");
  return actor.data;
}

export async function listCandidates(
  input: CandidateListInput = {},
  cookie?: string,
): Promise<Page<CandidateSummary>> {
  const query = parseInput(candidateListQuerySchema, input, "Enter valid candidate filters.");
  const data = await read(`/candidates?${queryString(query)}`, cookie);
  return parsePage(data, candidateSummarySchema, "candidate list");
}

export async function listLeads(input: LeadListInput = {}, cookie?: string): Promise<Page<LeadSummary>> {
  const query = parseInput(leadListQuerySchema, input, "Enter valid lead filters.");
  return parsePage(await read(`/leads?${queryString(query)}`, cookie), leadSummarySchema, "lead list");
}

export async function getCalendar(input: CalendarInput = {}, cookie?: string): Promise<InterviewSummary[]> {
  const query = parseInput(calendarQuerySchema, input, "Enter a valid calendar range.");
  const data = await read(`/calendar?${queryString(query)}`, cookie);
  const parsed = interviewSummarySchema.array().safeParse(data);
  if (!parsed.success) throw new ApiClientError("The API returned an invalid calendar.", "INVALID_RESPONSE");
  return parsed.data;
}

export async function listLeadInterviewRounds(leadId: string, cookie?: string): Promise<InterviewSummary[]> {
  const id = parseId(leadId, "lead");
  const parsed = interviewSummarySchema.array().safeParse(await read(`/leads/${id}/interview-rounds`, cookie));
  if (!parsed.success) throw new ApiClientError("The API returned an invalid interview list.", "INVALID_RESPONSE");
  return parsed.data;
}

export async function createLeadInterview(leadId: string, input: CreateInterview): Promise<InterviewSummary> {
  const id = parseId(leadId, "lead");
  const value = parseInput(createInterviewSchema, input, "Enter valid interview details.");
  return parseResource(interviewSummarySchema, await mutate(`/leads/${id}/interview-rounds`, "POST", value), "interview");
}

export async function updateInterview(id: string, input: UpdateInterview): Promise<InterviewSummary> {
  const roundId = parseId(id, "interview round");
  const value = parseInput(updateInterviewSchema, input, "Enter valid interview details.");
  return parseResource(interviewSummarySchema, await mutate(`/interview-rounds/${roundId}`, "PATCH", value), "interview");
}

export async function listTasks(input: TaskListInput = {}, cookie?: string): Promise<TaskSummary[]> {
  const query = parseInput(taskListQuerySchema, input, "Enter valid task filters.");
  const data = await read(`/tasks?${queryString(query)}`, cookie);
  const parsed = taskSummarySchema.array().safeParse(data);
  if (!parsed.success) throw new ApiClientError("The API returned an invalid task list.", "INVALID_RESPONSE");
  return parsed.data;
}

export async function getBdWorkQueue(cookie?: string): Promise<BdWorkQueue> {
  return parseResource(bdWorkQueueSchema, await read("/performance/me/work-queue", cookie), "BD work queue");
}

export async function completeTask(id: string, expectedVersion: number, notes?: string): Promise<TaskSummary> {
  const taskId = parseId(id, "task");
  const command = parseInput(completeTaskSchema, { expectedVersion, ...(notes?.trim() ? { notes: notes.trim() } : {}) }, "Enter valid completion details.");
  return parseResource(taskSummarySchema, await mutate(`/tasks/${taskId}/complete`, "POST", command), "task");
}

export async function cancelTask(id: string, expectedVersion: number, reason: string): Promise<TaskSummary> {
  const taskId = parseId(id, "task");
  const command = parseInput(cancelTaskSchema, { expectedVersion, reason }, "Enter a cancellation reason.");
  return parseResource(taskSummarySchema, await mutate(`/tasks/${taskId}/cancel`, "POST", command), "task");
}

export async function listNotifications(input: { unreadOnly?: boolean; limit?: number } = {}, cookie?: string): Promise<NotificationSummary[]> {
  const query = parseInput(notificationListQuerySchema, input, "Enter valid notification filters.");
  const data = await read(`/notifications?${queryString(query)}`, cookie);
  const parsed = notificationSummarySchema.array().safeParse(data);
  if (!parsed.success) throw new ApiClientError("The API returned an invalid notification list.", "INVALID_RESPONSE");
  return parsed.data;
}

export async function listActivity(input: { companyId?: string; leadId?: string; profileId?: string; limit?: number } = {}, cookie?: string): Promise<ActivityEventSummary[]> {
  const query = parseInput(activityListQuerySchema, input, "Enter valid activity filters.");
  const data = await read(`/activity?${queryString(query)}`, cookie);
  const parsed = activityEventSummarySchema.array().safeParse(data);
  if (!parsed.success) throw new ApiClientError("The API returned an invalid activity feed.", "INVALID_RESPONSE");
  return parsed.data;
}

export async function listLeadCommunications(leadId: string, cookie?: string): Promise<CommunicationSummary[]> {
  const id = parseId(leadId, "lead");
  const query = parseInput(communicationListQuerySchema, {}, "Enter valid communication filters.");
  const parsed = communicationSummarySchema.array().safeParse(await read(`/leads/${id}/communications?${queryString(query)}`, cookie));
  if (!parsed.success) throw new ApiClientError("The API returned an invalid communication list.", "INVALID_RESPONSE");
  return parsed.data;
}

export async function listLeadComments(leadId: string, cookie?: string): Promise<CommentSummary[]> {
  const id = parseId(leadId, "lead");
  const parsed = commentSummarySchema.array().safeParse(await read(`/leads/${id}/comments`, cookie));
  if (!parsed.success) throw new ApiClientError("The API returned an invalid comment list.", "INVALID_RESPONSE");
  return parsed.data;
}

export async function listLeadOffers(leadId: string, cookie?: string): Promise<OfferSummary[]> {
  const id = parseId(leadId, "lead");
  const parsed = offerSummarySchema.array().safeParse(await read(`/leads/${id}/offers`, cookie));
  if (!parsed.success) throw new ApiClientError("The API returned an invalid offer list.", "INVALID_RESPONSE");
  return parsed.data;
}

export async function decideOffer(id: string, decision: "ACCEPTED" | "DECLINED", expectedVersion: number): Promise<OfferSummary> {
  const offerId = parseId(id, "offer");
  const command = parseInput(offerDecisionSchema, { decision, expectedVersion }, "Enter a valid offer decision.");
  return parseResource(offerSummarySchema, await mutate(`/offers/${offerId}/decision`, "POST", command), "offer");
}

export async function placeOffer(id: string, startDate: string, expectedVersion: number): Promise<OfferSummary> {
  const offerId = parseId(id, "offer");
  const command = parseInput(placementDateSchema, { startDate, expectedVersion }, "Enter a valid placement date.");
  return parseResource(offerSummarySchema, await mutate(`/offers/${offerId}/place`, "POST", command), "offer");
}

export async function startPlacement(id: string, expectedVersion: number): Promise<OfferSummary> {
  const offerId = parseId(id, "offer");
  const command = parseInput(startPlacementSchema, { expectedVersion }, "Enter a valid placement action.");
  return parseResource(offerSummarySchema, await mutate(`/offers/${offerId}/start`, "POST", command), "offer");
}

export async function createLeadOffer(leadId: string, input: CreateOffer): Promise<OfferSummary> {
  const id = parseId(leadId, "lead"); const value = parseInput(createOfferSchema, input, "Enter valid offer details.");
  return parseResource(offerSummarySchema, await mutate(`/leads/${id}/offers`, "POST", value), "offer");
}

export async function updateOffer(id: string, input: Omit<CreateOffer, "decisionDeadline"> & { decisionDeadline?: string | null; expectedVersion: number }): Promise<OfferSummary> {
  const offerId = parseId(id, "offer"); const value = parseInput(updateOfferSchema, input, "Enter valid offer details.");
  return parseResource(offerSummarySchema, await mutate(`/offers/${offerId}`, "PATCH", value), "offer");
}

export async function cancelInterview(id: string, expectedVersion: number, reason?: string): Promise<InterviewSummary> {
  const roundId = parseId(id, "interview round");
  const command = parseInput(interviewStatusActionSchema, { expectedVersion, ...(reason?.trim() ? { reason: reason.trim() } : {}) }, "Enter a valid cancellation.");
  return parseResource(interviewSummarySchema, await mutate(`/interview-rounds/${roundId}/cancel`, "POST", command), "interview");
}

export async function recordInterviewAttendance(id: string, attendance: "ATTENDED" | "MISSED" | "UNKNOWN", expectedVersion: number): Promise<InterviewSummary> {
  const roundId = parseId(id, "interview round");
  const command = parseInput(interviewAttendanceSchema, { attendance, expectedVersion }, "Enter valid attendance.");
  return parseResource(interviewSummarySchema, await mutate(`/interview-rounds/${roundId}/attendance`, "POST", command), "interview");
}

export async function saveInterviewNotes(id: string, notes: string, expectedVersion: number): Promise<InterviewSummary> {
  const roundId = parseId(id, "interview round");
  const command = parseInput(interviewNotesSchema, { notes, expectedVersion }, "Enter interview notes.");
  return parseResource(interviewSummarySchema, await mutate(`/interview-rounds/${roundId}/closer-notes`, "POST", command), "interview");
}

export async function saveOfficialInterviewResult(id: string, result: string, expectedVersion: number): Promise<InterviewSummary> {
  const roundId = parseId(id, "interview round");
  const command = parseInput(officialResultSchema, { result, expectedVersion }, "Enter an official result.");
  return parseResource(interviewSummarySchema, await mutate(`/interview-rounds/${roundId}/official-result`, "POST", command), "interview");
}

export async function getAvailability(closerId: string, cookie?: string): Promise<{ rules: AvailabilityRule[]; exceptions: AvailabilityException[] }> {
  const id = parseId(closerId, "Closer");
  const data = await read(`/closers/${id}/availability`, cookie);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new ApiClientError("The API returned invalid availability.", "INVALID_RESPONSE");
  const value = data as { rules?: unknown; exceptions?: unknown };
  const rules = availabilityRuleSchema.array().safeParse(value.rules); const exceptions = availabilityExceptionSchema.array().safeParse(value.exceptions);
  if (!rules.success || !exceptions.success) throw new ApiClientError("The API returned invalid availability.", "INVALID_RESPONSE");
  return { rules: rules.data, exceptions: exceptions.data };
}

export async function replaceAvailabilityRules(input: AvailabilityRuleInput[]): Promise<{ rules: AvailabilityRule[]; exceptions: AvailabilityException[] }> {
  const rules = parseInput(availabilityRuleInputSchema.array(), input, "Enter valid availability rules.");
  const data = await mutate("/me/availability/rules", "PUT", rules);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new ApiClientError("The API returned invalid availability.", "INVALID_RESPONSE");
  const value = data as { rules?: unknown; exceptions?: unknown }; const parsedRules = availabilityRuleSchema.array().safeParse(value.rules); const parsedExceptions = availabilityExceptionSchema.array().safeParse(value.exceptions);
  if (!parsedRules.success || !parsedExceptions.success) throw new ApiClientError("The API returned invalid availability.", "INVALID_RESPONSE");
  return { rules: parsedRules.data, exceptions: parsedExceptions.data };
}

export async function addAvailabilityException(input: AvailabilityExceptionInput): Promise<AvailabilityException> {
  const value = parseInput(availabilityExceptionInputSchema, input, "Enter a valid availability exception.");
  return parseResource(availabilityExceptionSchema, await mutate("/me/availability/exceptions", "POST", value), "availability exception");
}

export async function removeAvailabilityException(id: string): Promise<void> {
  const exceptionId = parseId(id, "availability exception");
  const result = await mutate(`/me/availability/exceptions/${exceptionId}`, "DELETE");
  if (result !== null) throw new ApiClientError("The API returned an invalid delete result.", "INVALID_RESPONSE");
}

export async function createLeadComment(leadId: string, input: CreateComment): Promise<CommentSummary> {
  const id = parseId(leadId, "lead"); const value = parseInput(createCommentSchema, input, "Enter a valid comment.");
  return parseResource(commentSummarySchema, await mutate(`/leads/${id}/comments`, "POST", value), "comment");
}

export async function createLeadCommunication(leadId: string, input: CreateCommunication): Promise<CommunicationSummary> {
  const id = parseId(leadId, "lead"); const value = parseInput(createCommunicationSchema, input, "Enter a valid communication.");
  return parseResource(communicationSummarySchema, await mutate(`/leads/${id}/communications`, "POST", value), "communication");
}

export async function updateLeadComment(id: string, input: UpdateComment): Promise<CommentSummary> {
  const commentId = parseId(id, "comment");
  return parseResource(commentSummarySchema, await mutate(`/leads/comments/${commentId}`, "PATCH", input), "comment");
}

export async function updateLeadCommunication(id: string, input: UpdateCommunication & { expectedVersion: number }): Promise<CommunicationSummary> {
  const communicationId = parseId(id, "communication");
  return parseResource(communicationSummarySchema, await mutate(`/leads/communications/${communicationId}`, "PATCH", input), "communication");
}

export async function getDashboard(cookie?: string, input: { companyId?: string; profileId?: string } = {}): Promise<DashboardData> {
  const query = parseInput(analyticsQuerySchema, input, "Enter valid analytics filters.");
  const suffix = queryString(query);
  const data = await read(suffix ? `/dashboard?${suffix}` : "/dashboard", cookie);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new ApiClientError("The API returned an invalid dashboard.", "INVALID_RESPONSE");
  const value = data as Record<string, unknown>;
  const kpis = analyticsKpisSchema.safeParse(value.kpis);
  const breakdowns = value.breakdowns as Record<string, unknown> | undefined;
  const statuses = analyticsBreakdownSchema.safeParse(breakdowns?.statuses);
  const sources = analyticsBreakdownSchema.safeParse(breakdowns?.sources);
  if (!kpis.success || !statuses.success || !sources.success || typeof value.upcomingInterviews !== "number") throw new ApiClientError("The API returned an invalid dashboard.", "INVALID_RESPONSE");
  return { kpis: kpis.data, breakdowns: { statuses: statuses.data, sources: sources.data }, upcomingInterviews: value.upcomingInterviews };
}

export async function getCloserDashboard(cookie?: string): Promise<CloserDashboardData> {
  console.info("[Orbit frontend] loading closer dashboard");
  return parseResource(
    closerDashboardDataSchema,
    await read("/closer-dashboard", cookie),
    "closer dashboard",
  );
}

export async function listCompanies(cookie?: string): Promise<CompanySummary[]> {
  const data = await read("/leads/companies?limit=100", cookie);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new ApiClientError("The API returned an invalid company list.", "INVALID_RESPONSE");
  const parsed = companySummarySchema.array().safeParse((data as Record<string, unknown>).items);
  if (!parsed.success) throw new ApiClientError("The API returned an invalid company list.", "INVALID_RESPONSE");
  return parsed.data;
}

export async function createCompany(input: CreateCompany): Promise<CompanySummary> {
  const value = parseInput(createCompanySchema, input, "Enter valid client details.");
  return parseResource(companySummarySchema, await mutate("/leads/companies", "POST", value), "client");
}

export async function updateCompany(id: string, input: UpdateCompanyRequest): Promise<CompanySummary> {
  const companyId = parseId(id, "company");
  const value = parseInput(updateCompanyRequestSchema, input, "Enter valid client details.");
  return parseResource(companySummarySchema, await mutate(`/leads/companies/${companyId}`, "PATCH", value), "client");
}

export async function listCompanyClosers(companyId: string, cookie?: string): Promise<CompanyCloserAssignment[]> {
  const id = parseId(companyId, "company");
  const parsed = companyCloserAssignmentSchema.array().safeParse(await read(`/leads/companies/${id}/closers`, cookie));
  if (!parsed.success) throw new ApiClientError("The API returned an invalid client closer list.", "INVALID_RESPONSE");
  return parsed.data;
}

export async function assignCompanyCloser(companyId: string, closerId: string): Promise<CompanyCloserAssignment> {
  const id = parseId(companyId, "company"); const userId = parseId(closerId, "closer");
  const parsed = companyCloserAssignmentSchema.safeParse(await mutate(`/leads/companies/${id}/closers`, "POST", { closerId: userId }));
  if (!parsed.success) throw new ApiClientError("The API returned an invalid client closer assignment.", "INVALID_RESPONSE");
  return parsed.data;
}

export async function removeCompanyCloser(companyId: string, closerId: string): Promise<void> {
  const id = parseId(companyId, "company"); const userId = parseId(closerId, "closer");
  await mutate(`/leads/companies/${id}/closers/${userId}`, "DELETE");
}

export async function assignLeadCloser(leadId: string, closerId: string, expectedVersion: number): Promise<LeadSummary> {
  const id = parseId(leadId, "lead");
  const userId = parseId(closerId, "closer");
  return parseResource(leadSummarySchema, await mutate(`/leads/${id}/closer`, "POST", { closerId: userId, expectedVersion }), "lead");
}

export async function getGoogleCalendarStatus(companyId: string, cookie?: string): Promise<CalendarConnection> {
  const id = parseId(companyId, "company");
  return parseResource(calendarConnectionSchema, await read(`/calendar/google/status?companyId=${id}`, cookie), "Google Calendar status");
}

export async function connectGoogleCalendar(companyId: string): Promise<string> {
  const id = parseId(companyId, "company");
  return parseResource(googleCalendarConnectSchema, await read(`/calendar/google/connect?companyId=${id}`), "Google Calendar connection").authorizationUrl;
}

export async function disconnectGoogleCalendar(companyId: string): Promise<void> {
  const id = parseId(companyId, "company");
  const result = await mutate(`/calendar/google?companyId=${id}`, "DELETE");
  if (result !== null) throw new ApiClientError("The API returned an invalid disconnect result.", "INVALID_RESPONSE");
}

export async function getProfileGoogleCalendarStatus(profileId: string, cookie?: string): Promise<CalendarConnection> {
  const id = parseId(profileId, "profile");
  return parseResource(calendarConnectionSchema, await read(`/calendar/google/status?profileId=${id}`, cookie), "candidate calendar status");
}

export async function connectProfileGoogleCalendar(profileId: string): Promise<string> {
  const id = parseId(profileId, "profile");
  return parseResource(googleCalendarConnectSchema, await read(`/calendar/google/connect?profileId=${id}`), "candidate calendar connection").authorizationUrl;
}

export async function disconnectProfileGoogleCalendar(profileId: string): Promise<void> {
  const id = parseId(profileId, "profile");
  const result = await mutate(`/calendar/google?profileId=${id}`, "DELETE");
  if (result !== null) throw new ApiClientError("The API returned an invalid disconnect result.", "INVALID_RESPONSE");
}

export async function listDocuments(profileId: string, cookie?: string): Promise<DocumentSummary[]> {
  const id = parseId(profileId, "profile");
  const data = await read(`/profiles/${id}/documents`, cookie);
  const parsed = documentSummarySchema.array().safeParse(data);
  if (!parsed.success) throw new ApiClientError("The API returned an invalid document list.", "INVALID_RESPONSE");
  return parsed.data;
}

export async function uploadDocument(profileId: string, input: { file: File; type: "CV" | "COVER_LETTER" | "SUPPORTING" | "OTHER"; title: string }): Promise<DocumentSummary> {
  const id = parseId(profileId, "profile");
  const checksum = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await input.file.arrayBuffer()))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const intentResponse = await fetch(`${getApiBaseUrl()}/profiles/${id}/documents/upload-intent`, { method: "POST", credentials: "include", headers: { "content-type": "application/json", origin: getTrustedOrigin() }, body: JSON.stringify({ filename: input.file.name, contentType: input.file.type, contentLength: input.file.size, idempotencyKey: crypto.randomUUID() }) });
  const intent = documentUploadIntentResultSchema.parse(await readEnvelope(intentResponse));
  const upload = await fetch(intent.uploadUrl, { method: "PUT", headers: { "content-type": input.file.type, "content-length": String(input.file.size) }, body: input.file });
  if (!upload.ok) throw new ApiClientError("The document could not be uploaded to storage.", "STORAGE_UPLOAD_FAILED", undefined, upload.status);
  const command = createDocumentSchema.parse({ type: input.type, title: input.title, originalFilename: input.file.name, mimeType: input.file.type, sizeBytes: input.file.size, storageKey: intent.storageKey, checksum });
  return parseResource(documentSummarySchema, await mutate(`/profiles/${id}/documents`, "POST", command), "document");
}

export async function getDocumentDownloadUrl(documentId: string, versionId: string): Promise<string> {
  const document = parseId(documentId, "document");
  const version = parseId(versionId, "document version");
  const result = documentDownloadResultSchema.safeParse(await read(`/documents/${document}/versions/${version}/download`));
  if (!result.success) throw new ApiClientError("The API returned an invalid document download link.", "INVALID_RESPONSE");
  return result.data.downloadUrl;
}

export async function archiveDocument(documentId: string, reason: string): Promise<void> {
  const id = parseId(documentId, "document");
  if (!reason.trim()) throw new ApiClientError("Enter an archive reason.", "VALIDATION_ERROR");
  const result = await mutate(`/documents/${id}/archive`, "POST", { reason: reason.trim() });
  if (result !== null) throw new ApiClientError("The API returned an invalid archive result.", "INVALID_RESPONSE");
}

export async function uploadDocumentVersion(documentId: string, profileId: string, file: File): Promise<DocumentSummary> {
  const document = parseId(documentId, "document");
  const profile = parseId(profileId, "profile");
  const checksum = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const intentResponse = await fetch(`${getApiBaseUrl()}/profiles/${profile}/documents/upload-intent`, { method: "POST", credentials: "include", headers: { "content-type": "application/json", origin: getTrustedOrigin() }, body: JSON.stringify({ filename: file.name, contentType: file.type, contentLength: file.size, idempotencyKey: crypto.randomUUID() }) });
  const intent = documentUploadIntentResultSchema.parse(await readEnvelope(intentResponse));
  const upload = await fetch(intent.uploadUrl, { method: "PUT", headers: { "content-type": file.type, "content-length": String(file.size) }, body: file });
  if (!upload.ok) throw new ApiClientError("The document version could not be uploaded to storage.", "STORAGE_UPLOAD_FAILED", undefined, upload.status);
  const result = await mutate(`/documents/${document}/versions`, "POST", { originalFilename: file.name, mimeType: file.type, sizeBytes: file.size, storageKey: intent.storageKey, checksum });
  return parseResource(documentSummarySchema, result, "document");
}

export async function getLead(id: string, cookie?: string): Promise<LeadDetail> {
  const leadId = parseId(id, "lead");
  return parseResource(leadDetailSchema, await read(`/leads/${leadId}`, cookie), "lead");
}

export async function createLead(input: CreateLead): Promise<LeadSummary> {
  const command = parseInput(createLeadSchema, input, "Enter valid lead details.");
  return parseResource(leadSummarySchema, await mutate("/leads", "POST", command), "lead");
}

export async function createApplicationIntake(input: CreateApplicationIntake): Promise<ApplicationIntakeResult> {
  const command = parseInput(createApplicationIntakeSchema, input, "Enter valid application details.");
  return parseResource(applicationIntakeResultSchema, await mutate("/leads/intake", "POST", command), "application");
}

export async function createCandidate(input: CreateCandidate): Promise<CandidateSummary> {
  const command = parseInput(createCandidateSchema, input, "Enter valid candidate details.");
  return parseResource(
    candidateSummarySchema,
    await mutate("/candidates", "POST", command),
    "candidate",
  );
}

export async function importCandidatesCsv(csv: string): Promise<{ imported: number; failed: number; errors: Array<{ row: number; message: string }> }> {
  return parseResource(bulkImportResultSchema, await mutate("/imports/candidates", "POST", { csv }), "candidate import");
}

export async function importLeadsCsv(csv: string): Promise<{ imported: number; failed: number; errors: Array<{ row: number; message: string }> }> {
  return parseResource(bulkImportResultSchema, await mutate("/imports/leads", "POST", { csv }), "lead import");
}

export async function getCandidate(id: string, cookie?: string): Promise<CandidateDetail> {
  const candidateId = parseId(id, "candidate");
  return parseCandidateDetail(await read(`/candidates/${candidateId}`, cookie));
}

export async function updateCandidate(
  id: string,
  input: UpdateCandidate,
  expectedVersion: number,
): Promise<CandidateSummary> {
  const candidateId = parseId(id, "candidate");
  const command = parseInput(
    updateCandidateRequestSchema,
    { ...input, expectedVersion },
    "Enter a valid candidate update.",
  );
  return parseResource(
    candidateSummarySchema,
    await mutate(`/candidates/${candidateId}`, "PATCH", command),
    "candidate",
  );
}

export async function archiveCandidate(
  id: string,
  reason: string,
  expectedVersion: number,
): Promise<CandidateSummary> {
  const candidateId = parseId(id, "candidate");
  const command = parseInput(
    archiveCandidateRequestSchema,
    { reason, expectedVersion },
    "Enter a valid archive reason.",
  );
  return parseResource(
    candidateSummarySchema,
    await mutate(`/candidates/${candidateId}/archive`, "POST", command),
    "candidate",
  );
}

export async function restoreCandidate(id: string, expectedVersion: number): Promise<CandidateSummary> {
  const candidateId = parseId(id, "candidate");
  const command = parseInput(
    restoreCandidateRequestSchema,
    { expectedVersion },
    "The candidate version is invalid.",
  );
  return parseResource(
    candidateSummarySchema,
    await mutate(`/candidates/${candidateId}/restore`, "POST", command),
    "candidate",
  );
}

export async function listProfiles(
  input: ProfileListInput = {},
  cookie?: string,
): Promise<Page<ProfileSummary>> {
  const query = parseInput(profileListQuerySchema, input, "Enter valid profile filters.");
  const data = await read(`/profiles?${queryString(query)}`, cookie);
  return parsePage(data, profileSummarySchema, "profile list");
}

export async function createProfile(input: CreateProfile): Promise<ProfileSummary> {
  const command = parseInput(createProfileSchema, input, "Enter valid profile details.");
  return parseResource(profileSummarySchema, await mutate("/profiles", "POST", command), "profile");
}

export async function getProfile(id: string, cookie?: string): Promise<ProfileDetail> {
  const profileId = parseId(id, "profile");
  return parseProfileDetail(await read(`/profiles/${profileId}`, cookie));
}

export async function updateProfile(
  id: string,
  input: UpdateProfile,
  expectedVersion: number,
): Promise<ProfileSummary> {
  const profileId = parseId(id, "profile");
  const command = parseInput(
    updateProfileRequestSchema,
    { ...input, expectedVersion },
    "Enter a valid profile update.",
  );
  return parseResource(
    profileSummarySchema,
    await mutate(`/profiles/${profileId}`, "PATCH", command),
    "profile",
  );
}

async function transitionProfile(id: string, action: "activate" | "pause" | "restore", expectedVersion: number) {
  const profileId = parseId(id, "profile");
  const command = parseInput(
    profileStatusRequestSchema,
    { expectedVersion },
    "The profile version is invalid.",
  );
  return parseResource(
    profileSummarySchema,
    await mutate(`/profiles/${profileId}/${action}`, "POST", command),
    "profile",
  );
}

export function activateProfile(id: string, expectedVersion: number): Promise<ProfileSummary> {
  return transitionProfile(id, "activate", expectedVersion);
}

export function pauseProfile(id: string, expectedVersion: number): Promise<ProfileSummary> {
  return transitionProfile(id, "pause", expectedVersion);
}

export async function archiveProfile(
  id: string,
  reason: string,
  expectedVersion: number,
): Promise<ProfileSummary> {
  const profileId = parseId(id, "profile");
  const command = parseInput(
    archiveProfileRequestSchema,
    { reason, expectedVersion },
    "Enter a valid archive reason.",
  );
  return parseResource(
    profileSummarySchema,
    await mutate(`/profiles/${profileId}/archive`, "POST", command),
    "profile",
  );
}

export function restoreProfile(id: string, expectedVersion: number): Promise<ProfileSummary> {
  return transitionProfile(id, "restore", expectedVersion);
}

async function listAssignments(path: string, profileId: string, cookie?: string): Promise<Assignment[]> {
  const id = parseId(profileId, "profile");
  return parseResource(assignmentSchema.array(), await read(`/profiles/${id}/${path}`, cookie), "assignment list");
}

async function addAssignment(path: string, profileId: string, userId: string): Promise<Assignment> {
  const id = parseId(profileId, "profile");
  const command = parseInput(
    assignmentUserRequestSchema,
    { userId },
    "Select a valid active user.",
  );
  return parseResource(
    assignmentSchema,
    await mutate(`/profiles/${id}/${path}`, "POST", command),
    "assignment",
  );
}

async function endAssignment(
  path: string,
  profileId: string,
  assignmentId: string,
  reason: string,
): Promise<void> {
  const id = parseId(profileId, "profile");
  const assignedId = parseId(assignmentId, "assignment");
  const command = parseInput(endAssignmentRequestSchema, { reason }, "Enter a valid reason.");
  const data = await mutate(`/profiles/${id}/${path}/${assignedId}`, "DELETE", command);
  if (data !== null) throw new ApiClientError("The API returned an invalid assignment result.", "INVALID_RESPONSE");
}

export function listBdAssignments(profileId: string, cookie?: string): Promise<Assignment[]> {
  return listAssignments("bd-assignments", profileId, cookie);
}

export function assignBd(profileId: string, userId: string): Promise<Assignment> {
  return addAssignment("bd-assignments", profileId, userId);
}

export function endBdAssignment(profileId: string, assignmentId: string, reason: string): Promise<void> {
  return endAssignment("bd-assignments", profileId, assignmentId, reason);
}

export function listCloserEligibility(profileId: string, cookie?: string): Promise<Assignment[]> {
  return listAssignments("closer-eligibility", profileId, cookie);
}

export function setCloserEligibility(profileId: string, userId: string): Promise<Assignment> {
  return addAssignment("closer-eligibility", profileId, userId);
}

export function endCloserEligibility(profileId: string, assignmentId: string, reason: string): Promise<void> {
  return endAssignment("closer-eligibility", profileId, assignmentId, reason);
}

export async function getPerformanceRules(cookie?: string): Promise<PerformanceRuleSet | null> {
  const data = await read("/performance/rules", cookie);
  if (data === null) return null;
  return parseResource(performanceRuleSchema, data, "performance rules");
}

export async function getPerformanceRuleHistory(cookie?: string): Promise<PerformanceRuleSet[]> {
  return parseResource(
    performanceRuleSchema.array(),
    await read("/performance/rules/history", cookie),
    "performance rule history",
  );
}

export async function previewPerformanceRules(input: PerformanceRuleInput): Promise<PerformanceRulePreview> {
  const command = parseInput(performanceRuleInputSchema, input, "Enter valid performance rule values.");
  return parseResource(
    performanceRulePreviewSchema,
    await mutate("/performance/rules/preview", "POST", command),
    "performance rule impact preview",
  );
}

export async function updatePerformanceRules(input: PerformanceRuleMutation): Promise<PerformanceRuleSet> {
  const command = parseInput(performanceRuleMutationSchema, input, "Enter valid performance rule values.");
  return parseResource(performanceRuleSchema, await mutate("/performance/rules", "PATCH", command), "performance rules");
}

export async function listBdTargetSchedules(input: { bdId?: string } = {}, cookie?: string): Promise<BdTargetSchedule[]> {
  const bdId = input.bdId === undefined ? undefined : parseUserId(input.bdId);
  const data = await read(`/performance/admin/targets?${queryString({ bdId })}`, cookie);
  return parseResource(bdTargetScheduleSchema.array(), data, "BD target schedules");
}

export async function createBdTargetSchedule(input: CreateBdTargetSchedule): Promise<BdTargetSchedule> {
  const command = parseInput(bdTargetScheduleInputSchema, input, "Enter a valid BD target.");
  return parseResource(bdTargetScheduleSchema, await mutate("/performance/admin/targets", "POST", command), "BD target schedule");
}

export async function updateBdTargetSchedule(
  scheduleId: string,
  input: Pick<BdTargetSchedule, "bdId" | "dailyTarget" | "effectiveFrom"> & {
    effectiveTo?: string;
    auditMetadata?: Record<string, unknown>;
    expectedVersion: number;
  },
): Promise<BdTargetSchedule> {
  const id = parseId(scheduleId, "BD target schedule");
  const command = parseInput(updateBdTargetScheduleInputSchema, input, "Enter a valid BD target.");
  return parseResource(bdTargetScheduleSchema, await mutate(`/performance/admin/targets/${id}`, "PATCH", command), "BD target schedule");
}

export async function listPerformanceHolidays(cookie?: string): Promise<PerformanceHoliday[]> {
  return parseResource(performanceHolidaySchema.array(), await read("/performance/admin/holidays", cookie), "performance holidays");
}

export async function createPerformanceHoliday(input: CreatePerformanceHoliday): Promise<PerformanceHoliday> {
  const command = parseInput(performanceHolidayInputSchema, input, "Enter a valid holiday.");
  return parseResource(performanceHolidaySchema, await mutate("/performance/admin/holidays", "POST", command), "performance holiday");
}

export async function updatePerformanceHoliday(
  holidayId: string,
  input: Pick<PerformanceHoliday, "holidayDate" | "name"> & { auditMetadata?: Record<string, unknown>; expectedVersion: number },
): Promise<PerformanceHoliday> {
  const id = parseId(holidayId, "holiday");
  const command = parseInput(updatePerformanceHolidayInputSchema, input, "Enter a valid holiday.");
  return parseResource(
    performanceHolidaySchema,
    await mutate(`/performance/admin/holidays/${id}`, "PATCH", command),
    "performance holiday",
  );
}

export async function deletePerformanceHoliday(holidayId: string, expectedVersion: number): Promise<void> {
  const id = parseId(holidayId, "holiday");
  const command = parseInput(performanceVersionInputSchema, { expectedVersion }, "The holiday version is invalid.");
  const data = await mutate(`/performance/admin/holidays/${id}`, "DELETE", command);
  if (data !== null) throw new ApiClientError("The API returned an invalid holiday deletion result.", "INVALID_RESPONSE");
}

export async function listPerformanceApprovedLeaves(input: { bdId?: string } = {}, cookie?: string): Promise<PerformanceApprovedLeave[]> {
  const bdId = input.bdId === undefined ? undefined : parseUserId(input.bdId);
  return parseResource(
    performanceApprovedLeaveSchema.array(),
    await read(`/performance/admin/leaves?${queryString({ bdId })}`, cookie),
    "approved leave",
  );
}

export async function createPerformanceApprovedLeave(input: CreatePerformanceApprovedLeave): Promise<PerformanceApprovedLeave> {
  const command = parseInput(performanceApprovedLeaveInputSchema, input, "Enter a valid approved leave period.");
  return parseResource(
    performanceApprovedLeaveSchema,
    await mutate("/performance/admin/leaves", "POST", command),
    "approved leave",
  );
}

export async function updatePerformanceApprovedLeave(
  leaveId: string,
  input: Pick<PerformanceApprovedLeave, "bdId" | "startsAt" | "endsAt" | "reason" | "availableStartHour" | "availableEndHour"> & { expectedVersion: number },
): Promise<PerformanceApprovedLeave> {
  const id = parseId(leaveId, "approved leave");
  const command = parseInput(updatePerformanceApprovedLeaveInputSchema, input, "Enter a valid approved leave period.");
  return parseResource(
    performanceApprovedLeaveSchema,
    await mutate(`/performance/admin/leaves/${id}`, "PATCH", command),
    "approved leave",
  );
}

export async function deletePerformanceApprovedLeave(leaveId: string, expectedVersion: number): Promise<void> {
  const id = parseId(leaveId, "approved leave");
  const command = parseInput(performanceVersionInputSchema, { expectedVersion }, "The approved leave version is invalid.");
  const data = await mutate(`/performance/admin/leaves/${id}`, "DELETE", command);
  if (data !== null) throw new ApiClientError("The API returned an invalid approved leave deletion result.", "INVALID_RESPONSE");
}

export async function getDuplicateReviews(cookie?: string): Promise<DuplicateReviewWithLead[]> {
  return parseResource(
    duplicateReviewWithLeadSchema.array(),
    await read("/performance/duplicate-reviews", cookie),
    "duplicate review queue",
  );
}

export async function reviewDuplicateOverride(
  reviewId: string,
  input: { status: "APPROVED" | "REJECTED"; reviewReason: string; expectedVersion: number },
): Promise<DuplicateReviewWithLead> {
  const id = parseId(reviewId, "duplicate review");
  const command = parseInput(updateDuplicateReviewInputSchema, input, "Enter a duplicate-review decision and reason.");
  return parseResource(
    duplicateReviewWithLeadSchema,
    await mutate(`/performance/duplicate-reviews/${id}`, "POST", command),
    "duplicate review",
  );
}
