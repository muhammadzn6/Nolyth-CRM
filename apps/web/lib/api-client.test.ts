import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as apiClient from "./api-client";

import {
  acceptInvitation,
  ApiClientError,
  changePassword,
  createUser,
  getCurrentActor,
  listUsers,
  login,
  logout,
  requestPasswordReset,
  completePasswordReset,
  revokeUserSessions,
  updateUser,
} from "./api-client";

const actor = {
  id: "3a28ef58-ecbd-4bc8-970f-b641918ff368",
  displayName: "Maya Chen",
  email: "maya@orbit.example",
  role: "ADMIN" as const,
  isActive: true,
};

const candidate = {
  id: "20000000-0000-4000-8000-000000000001",
  linkedUserId: null,
  firstName: "Ada",
  lastName: "Lovelace",
  preferredName: null,
  email: "ada@orbit.example",
  phone: null,
  timezone: "Europe/London",
  location: "London",
  status: "ACTIVE" as const,
  archivedAt: null,
  archiveReason: null,
  createdAt: "2026-09-02T08:00:00.000Z",
  updatedAt: "2026-09-02T08:00:00.000Z",
  version: 1,
};

const profile = {
  id: "30000000-0000-4000-8000-000000000001",
  candidateId: candidate.id,
  name: "Platform engineering",
  description: "Senior backend and platform roles",
  status: "DRAFT" as const,
  defaultCurrency: "USD",
  targetCompensation: "150000",
  compensationPeriod: "YEARLY" as const,
  targetRoles: ["Staff Engineer"],
  preferredLocations: ["Remote"],
  workplacePreferences: ["Remote"],
  jobTypePreferences: ["Full-time"],
  contractPreferences: [],
  archivedAt: null,
  archiveReason: null,
  createdAt: "2026-09-02T08:30:00.000Z",
  updatedAt: "2026-09-02T08:30:00.000Z",
  version: 1,
};

const assignment = {
  id: "40000000-0000-4000-8000-000000000001",
  profileId: profile.id,
  userId: "00000000-0000-4000-8000-000000000003",
  assignedById: actor.id,
  assignedAt: "2026-09-02T09:00:00.000Z",
  endedAt: null,
  endedReason: null,
};

const closerDashboard = {
  timezone: "Asia/Karachi",
  assignedApplications: [{
    id: "60000000-0000-4000-8000-000000000001",
    profileId: profile.id,
    candidateName: "Ada Lovelace",
    profileName: "Platform Engineering",
    jobTitle: "Staff Platform Engineer",
    companyName: "Northstar Labs",
    status: "INTERVIEWING",
    nextInterviewAt: "2026-09-03T09:30:00.000Z",
  }],
  nextMeeting: {
    id: "50000000-0000-4000-8000-000000000001",
    leadId: "60000000-0000-4000-8000-000000000001",
    roundNumber: 2,
    roundType: "TECHNICAL" as const,
    status: "SCHEDULED" as const,
    closerId: "00000000-0000-4000-8000-000000000003",
    creatorId: actor.id,
    startsAt: "2026-09-03T09:30:00.000Z",
    endsAt: "2026-09-03T10:15:00.000Z",
    timezone: "Asia/Karachi",
    originalDatetimeText: "Today at 2:30 PM",
    interviewer: "Jordan Patel",
    meetingLink: "https://meet.example.com/orbit-1",
    location: null,
    preparationNotes: "Review system design experience.",
    closerNotes: null,
    officialFeedback: null,
    officialResult: null,
    attendance: null,
    googleSyncStatus: null,
    version: 1,
    createdAt: "2026-09-02T08:00:00.000Z",
    updatedAt: "2026-09-02T08:00:00.000Z",
    candidateName: "Ada Lovelace",
    profileName: "Platform Engineering",
    jobTitle: "Staff Platform Engineer",
    companyName: "Northstar Labs",
  },
  todayMeetings: [],
  externalMeetings: [],
  needsFeedback: [],
  openTasks: [],
  conflicts: [],
  notifications: [],
  recentActivity: [],
  calendarConnection: {
    connected: false,
    email: null,
    calendarName: null,
    lastSyncedAt: null,
    status: "DISCONNECTED" as const,
  },
};

function success(data: unknown, requestId = "req_candidates") {
  return Response.json({ success: true, data, meta: { requestId } });
}

describe("API client boundary", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_APP_BASE_URL", "https://orbit.example");
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.orbit.example/api/v1");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("parses the session actor from the shared contract envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          success: true,
          data: actor,
          meta: { requestId: "req_actor" },
        }),
      ),
    );

    await expect(getCurrentActor("orbit_session=token")).resolves.toEqual(actor);
  });

  it("sends a password change through the authenticated auth endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(success(null));
    vi.stubGlobal("fetch", fetchMock);

    await changePassword({ currentPassword: "old-password", newPassword: "a-new-password-123" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.orbit.example/api/v1/auth/change-password",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("sends password reset requests to the configured auth base path once", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(success({ accepted: true, token: "reset-token" }))
      .mockResolvedValueOnce(success(null));
    vi.stubGlobal("fetch", fetchMock);

    await requestPasswordReset("maya@orbit.example");
    await completePasswordReset("reset-token", "a-new-password-123");

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.orbit.example/api/v1/auth/password-reset/request",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://api.orbit.example/api/v1/auth/password-reset/complete",
    );
  });

  it("loads and validates the closer dashboard with the request cookie", async () => {
    const fetchMock = vi.fn().mockResolvedValue(success(closerDashboard, "req_closer_dashboard"));
    vi.stubGlobal("fetch", fetchMock);
    const getCloserDashboard = (
      apiClient as unknown as { getCloserDashboard: (cookie?: string) => Promise<unknown> }
    ).getCloserDashboard;

    await expect(getCloserDashboard("orbit_session=token")).resolves.toEqual(closerDashboard);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.orbit.example/api/v1/closer-dashboard",
      expect.objectContaining({
        cache: "no-store",
        credentials: "include",
        headers: { cookie: "orbit_session=token" },
      }),
    );
  });

  it("returns null when the API reports an unauthenticated session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            success: false,
            error: { code: "UNAUTHENTICATED", message: "Login required" },
            meta: { requestId: "req_auth" },
          },
          { status: 401 },
        ),
      ),
    );

    await expect(getCurrentActor()).resolves.toBeNull();
  });

  it("validates login input before making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(login({ email: "invalid", password: "" })).rejects.toBeInstanceOf(
      ApiClientError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects missing API configuration instead of calling localhost", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCurrentActor()).rejects.toThrow(/NEXT_PUBLIC_API_BASE_URL/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("revokes the current session through the logout endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        success: true,
        data: null,
        meta: { requestId: "req_logout" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await logout();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.orbit.example/api/v1/auth/logout",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("lists users through the typed users contract", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        success: true,
        data: [
          {
            id: "00000000-0000-4000-8000-000000000003",
            displayName: "Managed User",
            email: "managed@orbit.example",
            role: "BD",
            isActive: true,
            timezone: "UTC",
            lastLoginAt: null,
          },
        ],
        meta: { requestId: "req_users" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listUsers("orbit_session=token")).resolves.toEqual([
      {
        id: "00000000-0000-4000-8000-000000000003",
        displayName: "Managed User",
        email: "managed@orbit.example",
        role: "BD",
        isActive: true,
        timezone: "UTC",
        lastLoginAt: null,
      },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.orbit.example/api/v1/users",
      expect.objectContaining({
        cache: "no-store",
        credentials: "include",
        headers: { cookie: "orbit_session=token" },
      }),
    );
  });

  it("sends a trusted Origin on admin user mutations", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        success: true,
        data: {
          user: {
            id: "00000000-0000-4000-8000-000000000004",
            displayName: "New User",
            email: "new@orbit.example",
            role: "CLOSER",
            isActive: true,
            timezone: "Asia/Karachi",
            lastLoginAt: null,
          },
          invitationToken: "opaque-token",
        },
        meta: { requestId: "req_create" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await createUser({
      displayName: "New User",
      email: "NEW@ORBIT.EXAMPLE",
      role: "CLOSER",
      timezone: "Asia/Karachi",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.orbit.example/api/v1/users",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          origin: "https://orbit.example",
        },
        body: JSON.stringify({
          displayName: "New User",
          email: "new@orbit.example",
          role: "CLOSER",
          timezone: "Asia/Karachi",
        }),
      }),
    );
  });

  it("updates users and revokes sessions with trusted Origin headers", async () => {
    const updatedUser = {
      id: "00000000-0000-4000-8000-000000000003",
      displayName: "Renamed User",
      email: "managed@orbit.example",
      role: "ADMIN" as const,
      isActive: false,
      timezone: "UTC",
      lastLoginAt: "2026-09-02T07:00:00.000Z",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          data: updatedUser,
          meta: { requestId: "req_update" },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          data: null,
          meta: { requestId: "req_revoke" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      updateUser(updatedUser.id, {
        displayName: "Renamed User",
        role: "ADMIN",
        timezone: "UTC",
        isActive: false,
      }),
    ).resolves.toEqual(updatedUser);
    await expect(revokeUserSessions(updatedUser.id)).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `https://api.orbit.example/api/v1/users/${updatedUser.id}`,
      expect.objectContaining({
        method: "PATCH",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          origin: "https://orbit.example",
        },
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `https://api.orbit.example/api/v1/users/${updatedUser.id}/revoke-sessions`,
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: { origin: "https://orbit.example" },
      }),
    );
  });

  it("rejects malformed successful revoke-session envelopes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          ok: true,
          data: null,
          meta: { requestId: "req_revoke" },
        }),
      ),
    );

    await expect(revokeUserSessions("00000000-0000-4000-8000-000000000003")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      status: 200,
    });
  });

  it("accepts invitations with a password only through the invitation endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        success: true,
        data: actor,
        meta: { requestId: "req_accept" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      acceptInvitation({
        token: "opaque-token",
        password: "correct horse battery staple",
      }),
    ).resolves.toEqual(actor);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.orbit.example/api/v1/auth/invitations/accept",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          origin: "https://orbit.example",
        },
        body: JSON.stringify({
          token: "opaque-token",
          password: "correct horse battery staple",
        }),
      }),
    );
  });

  it("validates candidate list queries and parses the paginated response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(success({ items: [candidate], nextCursor: null }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      apiClient.listCandidates(
        { search: "  Ada  ", status: "ACTIVE", limit: 10 },
        "orbit_session=token",
      ),
    ).resolves.toEqual({ items: [candidate], nextCursor: null });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.orbit.example/api/v1/candidates?search=Ada&status=ACTIVE&limit=10",
      expect.objectContaining({
        cache: "no-store",
        credentials: "include",
        headers: { cookie: "orbit_session=token" },
      }),
    );

    await expect(apiClient.listCandidates({ limit: 0 })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("normalizes candidate creation input and rejects malformed candidate responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(success(candidate))
      .mockResolvedValueOnce(success({ ...candidate, version: 0 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      apiClient.createCandidate({
        firstName: "  Ada ",
        lastName: " Lovelace  ",
        email: "ADA@ORBIT.EXAMPLE",
        timezone: "Europe/London",
      }),
    ).resolves.toEqual(candidate);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.orbit.example/api/v1/candidates",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://orbit.example",
        },
        body: JSON.stringify({
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@orbit.example",
          timezone: "Europe/London",
        }),
      }),
    );

    await expect(
      apiClient.createCandidate({ firstName: "Ada", lastName: "Lovelace", timezone: "UTC" }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("parses candidate and profile detail contracts", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(success({ ...candidate, profiles: [profile] }))
      .mockResolvedValueOnce(
        success({
          ...profile,
          candidate: {
            id: candidate.id,
            firstName: candidate.firstName,
            lastName: candidate.lastName,
            preferredName: candidate.preferredName,
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiClient.getCandidate(candidate.id)).resolves.toMatchObject({
      id: candidate.id,
      profiles: [profile],
    });
    await expect(apiClient.getProfile(profile.id)).resolves.toMatchObject({
      id: profile.id,
      candidate: { firstName: "Ada", lastName: "Lovelace" },
    });
  });

  it("preserves version-conflict errors from profile updates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            success: false,
            error: {
              code: "STALE_VERSION",
              message: "The record changed since it was loaded",
              details: { expectedVersion: 1, actualVersion: 2 },
            },
            meta: { requestId: "req_conflict" },
          },
          { status: 409 },
        ),
      ),
    );

    await expect(
      apiClient.updateProfile(profile.id, { name: "Platform roles" }, 1),
    ).rejects.toMatchObject({
      code: "STALE_VERSION",
      requestId: "req_conflict",
      status: 409,
    });
  });

  it("uses the assignment endpoints and validates assignment identifiers", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(success([assignment]))
      .mockResolvedValueOnce(success(assignment))
      .mockResolvedValueOnce(success(null))
      .mockResolvedValueOnce(success([assignment]))
      .mockResolvedValueOnce(success(assignment))
      .mockResolvedValueOnce(success(null));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiClient.listBdAssignments(profile.id)).resolves.toEqual([assignment]);
    await expect(apiClient.assignBd(profile.id, assignment.userId)).resolves.toEqual(assignment);
    await expect(
      apiClient.endBdAssignment(profile.id, assignment.id, "Coverage changed"),
    ).resolves.toBeUndefined();
    await expect(apiClient.listCloserEligibility(profile.id)).resolves.toEqual([assignment]);
    await expect(apiClient.setCloserEligibility(profile.id, assignment.userId)).resolves.toEqual(
      assignment,
    );
    await expect(
      apiClient.endCloserEligibility(profile.id, assignment.id, "Coverage changed"),
    ).resolves.toBeUndefined();

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `https://api.orbit.example/api/v1/profiles/${profile.id}/bd-assignments`,
      `https://api.orbit.example/api/v1/profiles/${profile.id}/bd-assignments`,
      `https://api.orbit.example/api/v1/profiles/${profile.id}/bd-assignments/${assignment.id}`,
      `https://api.orbit.example/api/v1/profiles/${profile.id}/closer-eligibility`,
      `https://api.orbit.example/api/v1/profiles/${profile.id}/closer-eligibility`,
      `https://api.orbit.example/api/v1/profiles/${profile.id}/closer-eligibility/${assignment.id}`,
    ]);

    await expect(apiClient.assignBd(profile.id, "not-a-user-id")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it("uses PUT when saving weekly availability rules", async () => {
    const rule = {
      id: "40000000-0000-4000-8000-000000000010",
      closerId: actor.id,
      dayOfWeek: 1,
      localStart: "09:00",
      localEnd: "17:00",
      timezone: "America/Chicago",
      effectiveFrom: null,
      effectiveTo: null,
    };
    const fetchMock = vi.fn().mockResolvedValue(success({ rules: [rule], exceptions: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiClient.replaceAvailabilityRules([{ dayOfWeek: 1, localStart: "09:00", localEnd: "17:00", timezone: "America/Chicago" }])).resolves.toEqual({ rules: [rule], exceptions: [] });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.orbit.example/api/v1/me/availability/rules",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("exposes the candidate and profile endpoint surface", () => {
    const endpointMethods = [
      "listCandidates",
      "createCandidate",
      "getCandidate",
      "updateCandidate",
      "archiveCandidate",
      "restoreCandidate",
      "listProfiles",
      "createProfile",
      "getProfile",
      "updateProfile",
      "activateProfile",
      "pauseProfile",
      "archiveProfile",
      "restoreProfile",
      "listBdAssignments",
      "assignBd",
      "endBdAssignment",
      "listCloserEligibility",
      "setCloserEligibility",
      "endCloserEligibility",
      "listLeadInterviewRounds",
    ] as const;

    for (const method of endpointMethods) {
      expect(apiClient[method], `${method} should be exported`).toBeTypeOf("function");
    }
  });
});
