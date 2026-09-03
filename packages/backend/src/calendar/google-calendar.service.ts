import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import type { GoogleCalendarEnv } from "@orbit/config";
import type { CalendarConnection } from "@orbit/contracts";

import { AuthorizationError, NotFoundError, ValidationError } from "../errors/app-error";
import type { Actor } from "../identity/session.service";

const GOOGLE_PROVIDER = "GOOGLE" as const;
const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
];

type ConnectionStatus = "CONNECTED" | "EXPIRED" | "SYNCING";

export type GoogleCalendarConnectionRecord = {
  id: string;
  userId: string;
  companyId: string | null;
  profileId: string | null;
  provider: typeof GOOGLE_PROVIDER;
  email: string;
  calendarId: string;
  calendarName: string;
  encryptedRefreshToken: string;
  scopes: string[];
  lastSyncedAt: Date | null;
  status: ConnectionStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type GoogleCalendarDatabase = {
  user?: {
    findFirst(args: { where: { role: "ADMIN" }; select: { id: true } }): Promise<{ id: string } | null>;
  };
  profile?: {
    findUnique(args: { where: { id: string }; select?: { id: true } }): Promise<{ id: string } | null>;
  };
  googleCalendarConnection: {
    findUnique(args: {
      where: { userId_provider: { userId: string; provider: typeof GOOGLE_PROVIDER } };
    }): Promise<GoogleCalendarConnectionRecord | null>;
    findFirst(args: { where: { companyId?: string; profileId?: string; provider: typeof GOOGLE_PROVIDER } }): Promise<GoogleCalendarConnectionRecord | null>;
    create(args: { data: Omit<GoogleCalendarConnectionRecord, "id" | "createdAt" | "updatedAt"> }): Promise<GoogleCalendarConnectionRecord>;
    update(args: { where: { id: string }; data: Partial<GoogleCalendarConnectionRecord> }): Promise<GoogleCalendarConnectionRecord>;
    delete(args: { where: { id: string } }): Promise<unknown>;
  };
  interviewRound?: {
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  };
  activityEvent?: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
};

export type GoogleOAuthProvider = {
  authorizationUrl(input: {
    clientId: string;
    redirectUri: string;
    state: string;
    scopes: string[];
  }): string;
  exchangeCode(input: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    code: string;
  }): Promise<{ email: string; refreshToken: string | null; scopes: string[] }>;
};

export type GoogleCalendarEvent = {
  id: string;
  summary: string;
  description: string;
  location: string | null;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
};

type GoogleCalendarRequest = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  calendarId: string;
};

export type GoogleCalendarEventClient = {
  checkBusy(input: GoogleCalendarRequest & { startsAt: Date; endsAt: Date }): Promise<boolean>;
  listEvents?(input: GoogleCalendarRequest & { from: Date; to: Date }): Promise<GoogleCalendarEvent[]>;
  createEvent(input: GoogleCalendarRequest & { event: GoogleCalendarEvent }): Promise<{ id: string }>;
  updateEvent(input: GoogleCalendarRequest & { eventId: string; event: GoogleCalendarEvent }): Promise<void>;
  cancelEvent(input: GoogleCalendarRequest & { eventId: string }): Promise<void>;
};

export type GoogleCalendarInterview = {
  id: string;
  leadId: string;
  profileId: string | null;
  closerId: string;
  companyId: string;
  status: "SCHEDULED" | "CANCELLED";
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  candidateName: string;
  companyName: string;
  jobTitle: string;
  meetingLink: string | null;
  preparationNotes: string | null;
  googleEventId: string | null;
};

export class GoogleCalendarHttpClient implements GoogleCalendarEventClient {
  private async accessToken(input: GoogleCalendarRequest): Promise<string> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: input.clientId, client_secret: input.clientSecret, refresh_token: input.refreshToken, grant_type: "refresh_token" }),
    });
    const body = await response.json() as { access_token?: unknown };
    if (!response.ok || typeof body.access_token !== "string") throw new ValidationError("Google Calendar access token refresh failed");
    return body.access_token;
  }

  private async request(input: GoogleCalendarRequest, path: string, init: RequestInit): Promise<Response> {
    const accessToken = await this.accessToken(input);
    return fetch(`https://www.googleapis.com/calendar/v3${path}`, { ...init, headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json", ...init.headers } });
  }

  async checkBusy(input: GoogleCalendarRequest & { startsAt: Date; endsAt: Date }): Promise<boolean> {
    const response = await this.request(input, "/freeBusy", { method: "POST", body: JSON.stringify({ timeMin: input.startsAt.toISOString(), timeMax: input.endsAt.toISOString(), items: [{ id: input.calendarId }] }) });
    const body = await response.json() as { calendars?: Record<string, { busy?: unknown[] }> };
    if (!response.ok || !body.calendars?.[input.calendarId]) throw new ValidationError("Google Calendar free/busy query failed");
    return (body.calendars[input.calendarId].busy?.length ?? 0) > 0;
  }

  async listEvents(input: GoogleCalendarRequest & { from: Date; to: Date }): Promise<GoogleCalendarEvent[]> {
    const params = new URLSearchParams({
      timeMin: input.from.toISOString(),
      timeMax: input.to.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "50",
    });
    const response = await this.request(input, `/calendars/${encodeURIComponent(input.calendarId)}/events?${params}`, { method: "GET" });
    const body = await response.json() as { items?: unknown };
    if (!response.ok || !Array.isArray(body.items)) throw new ValidationError("Google Calendar event listing failed");
    return body.items.filter((item): item is GoogleCalendarEvent => {
      if (!item || typeof item !== "object") return false;
      const event = item as Partial<GoogleCalendarEvent>;
      return typeof event.id === "string" && typeof event.summary === "string" && typeof event.start?.dateTime === "string" && typeof event.end?.dateTime === "string";
    });
  }

  async createEvent(input: GoogleCalendarRequest & { event: GoogleCalendarEvent }): Promise<{ id: string }> {
    const response = await this.request(input, `/calendars/${encodeURIComponent(input.calendarId)}/events`, { method: "POST", body: JSON.stringify(input.event) });
    if (response.status === 409) return { id: input.event.id };
    const body = await response.json() as { id?: unknown };
    if (!response.ok || typeof body.id !== "string") throw new ValidationError("Google Calendar event creation failed");
    return { id: body.id };
  }

  async updateEvent(input: GoogleCalendarRequest & { eventId: string; event: GoogleCalendarEvent }): Promise<void> {
    const response = await this.request(input, `/calendars/${encodeURIComponent(input.calendarId)}/events/${encodeURIComponent(input.eventId)}`, { method: "PUT", body: JSON.stringify(input.event) });
    if (!response.ok) throw new ValidationError("Google Calendar event update failed");
  }

  async cancelEvent(input: GoogleCalendarRequest & { eventId: string }): Promise<void> {
    const response = await this.request(input, `/calendars/${encodeURIComponent(input.calendarId)}/events/${encodeURIComponent(input.eventId)}`, { method: "DELETE" });
    if (!response.ok && response.status !== 404) throw new ValidationError("Google Calendar event cancellation failed");
  }
}

export class GoogleOAuthHttpProvider implements GoogleOAuthProvider {
  authorizationUrl(input: { clientId: string; redirectUri: string; state: string; scopes: string[] }): string {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", input.clientId);
    url.searchParams.set("redirect_uri", input.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", input.scopes.join(" "));
    url.searchParams.set("state", input.state);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent select_account");
    return url.toString();
  }

  async exchangeCode(input: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    code: string;
  }): Promise<{ email: string; refreshToken: string | null; scopes: string[] }> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: input.code,
        client_id: input.clientId,
        client_secret: input.clientSecret,
        redirect_uri: input.redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const token = await response.json() as {
      access_token?: unknown;
      refresh_token?: unknown;
      scope?: unknown;
    };

    if (!response.ok || typeof token.access_token !== "string") {
      throw new ValidationError("Google authorization code exchange failed");
    }

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: `Bearer ${token.access_token}` },
    });
    const profile = await profileResponse.json() as { email?: unknown };

    if (!profileResponse.ok || typeof profile.email !== "string") {
      throw new ValidationError("Google account email could not be verified");
    }

    return {
      email: profile.email,
      refreshToken: typeof token.refresh_token === "string" ? token.refresh_token : null,
      scopes: typeof token.scope === "string" ? token.scope.split(" ").filter(Boolean) : GOOGLE_SCOPES,
    };
  }
}

class RefreshTokenCipher {
  private readonly key: Buffer;

  constructor(encodedKey: string) {
    this.key = Buffer.from(encodedKey, "base64");
    if (this.key.length !== 32) {
      throw new Error("Google token encryption key must be 32 bytes");
    }
  }

  encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
  }

  decrypt(value: string): string {
    const [iv, tag, encrypted, ...rest] = value.split(".");
    if (!iv || !tag || !encrypted || rest.length) {
      throw new ValidationError("Stored Google token could not be decrypted");
    }
    try {
      const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(iv, "base64url"));
      decipher.setAuthTag(Buffer.from(tag, "base64url"));
      return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
    } catch {
      throw new ValidationError("Stored Google token could not be decrypted");
    }
  }
}

function assertAdmin(actor: Actor) {
  if (!actor.isActive || actor.role !== "ADMIN") {
    throw new AuthorizationError();
  }
}

function status(connection: GoogleCalendarConnectionRecord | null): CalendarConnection {
  if (!connection) {
    return { connected: false, email: null, calendarName: null, lastSyncedAt: null, status: "DISCONNECTED" };
  }
  return {
    connected: connection.status === "CONNECTED" || connection.status === "SYNCING",
    email: connection.email,
    calendarName: connection.calendarName,
    lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
    status: connection.status,
  };
}

export class GoogleCalendarService {
  private readonly cipher: RefreshTokenCipher | null;

  constructor(
    private readonly database: GoogleCalendarDatabase,
    private readonly oauth: GoogleOAuthProvider,
    private readonly config: GoogleCalendarEnv | null,
    private readonly calendarClient: GoogleCalendarEventClient = new GoogleCalendarHttpClient(),
  ) {
    this.cipher = config ? new RefreshTokenCipher(config.tokenEncryptionKey) : null;
  }

  private configured(): GoogleCalendarEnv {
    if (!this.config || !this.cipher) {
      throw new ValidationError("Google Calendar OAuth is not configured");
    }
    return this.config;
  }

  connect(actor: Actor, state: string, _companyId: string): { authorizationUrl: string } {
    assertAdmin(actor);
    const config = this.configured();
    return { authorizationUrl: this.oauth.authorizationUrl({ ...config, state, scopes: GOOGLE_SCOPES }) };
  }

  connectForProfile(actor: Actor, state: string, _profileId: string): { authorizationUrl: string } {
    assertAdmin(actor);
    const config = this.configured();
    return { authorizationUrl: this.oauth.authorizationUrl({ ...config, state, scopes: GOOGLE_SCOPES }) };
  }

  async complete(actor: Actor, code: string, companyId: string): Promise<void> {
    return this.completeOwner(actor, code, { companyId, profileId: null });
  }

  async completeForProfile(actor: Actor, code: string, profileId: string): Promise<void> {
    return this.completeOwner(actor, code, { companyId: null, profileId });
  }

  private async completeOwner(actor: Actor, code: string, owner: { companyId: string | null; profileId: string | null }): Promise<void> {
    assertAdmin(actor);
    if (owner.profileId && this.database.profile) {
      const profile = await this.database.profile.findUnique({ where: { id: owner.profileId }, select: { id: true } });
      if (!profile) throw new NotFoundError("The candidate profile was not found");
    }
    const config = this.configured();
    const tokens = await this.oauth.exchangeCode({ ...config, code });
    if (!tokens.refreshToken) {
      throw new ValidationError("Google did not return a refresh token");
    }

    const data = {
        userId: actor.id,
        companyId: owner.companyId,
        profileId: owner.profileId,
        provider: GOOGLE_PROVIDER,
        email: tokens.email,
        calendarId: "primary",
        calendarName: "Primary",
        encryptedRefreshToken: this.cipher!.encrypt(tokens.refreshToken),
        scopes: tokens.scopes,
        lastSyncedAt: null,
        status: "CONNECTED" as const,
      };
    const existing = await this.database.googleCalendarConnection.findFirst({ where: { ...(owner.profileId ? { profileId: owner.profileId } : { companyId: owner.companyId! }), provider: GOOGLE_PROVIDER } });
    if (existing) await this.database.googleCalendarConnection.update({ where: { id: existing.id }, data });
    else await this.database.googleCalendarConnection.create({ data });
  }

  async status(actor: Actor, companyId: string): Promise<CalendarConnection> {
    if (!actor.isActive) throw new AuthorizationError();
    return status(await this.connection(companyId));
  }

  async statusForProfile(actor: Actor, profileId: string): Promise<CalendarConnection> {
    if (!actor.isActive) throw new AuthorizationError();
    return status(await this.connectionForProfile(profileId));
  }

  async disconnectForProfile(actor: Actor, profileId: string): Promise<void> {
    assertAdmin(actor);
    const existing = await this.connectionForProfile(profileId);
    if (existing) await this.database.googleCalendarConnection.delete({ where: { id: existing.id } });
  }

  async disconnect(actor: Actor, companyId: string): Promise<void> {
    assertAdmin(actor);
    const existing = await this.connection(companyId);
    if (existing) {
      await this.database.googleCalendarConnection.delete({
        where: { id: existing.id },
      });
    }
  }

  async isConnected(companyId: string): Promise<boolean> {
    const connection = await this.connection(companyId);
    return connection?.status === "CONNECTED" || connection?.status === "SYNCING";
  }

  async isConnectedForProfile(profileId: string): Promise<boolean> {
    const connection = await this.connectionForProfile(profileId);
    return connection?.status === "CONNECTED" || connection?.status === "SYNCING";
  }

  async checkGoogleBusyFree(companyId: string, startsAt: Date, endsAt: Date): Promise<{ busy: boolean }> {
    return this.checkBusyWithConnection(await this.connection(companyId), startsAt, endsAt);
  }

  async checkGoogleBusyFreeForProfile(profileId: string, startsAt: Date, endsAt: Date): Promise<{ busy: boolean }> {
    return this.checkBusyWithConnection(await this.connectionForProfile(profileId), startsAt, endsAt);
  }

  private async checkBusyWithConnection(connection: GoogleCalendarConnectionRecord | null, startsAt: Date, endsAt: Date): Promise<{ busy: boolean }> {
    if (!connection || (connection.status !== "CONNECTED" && connection.status !== "SYNCING")) {
      return { busy: false };
    }
    const config = this.configured();
    return {
      busy: await this.calendarClient.checkBusy({
        ...config,
        refreshToken: this.decryptRefreshToken(connection.encryptedRefreshToken),
        calendarId: connection.calendarId,
        startsAt,
        endsAt,
      }),
    };
  }

  async listUpcomingEvents(actor: Actor, companyId: string, from: Date, to: Date): Promise<GoogleCalendarEvent[]> {
    if (!actor.isActive) throw new AuthorizationError();
    const connection = await this.connection(companyId);
    if (!connection || (connection.status !== "CONNECTED" && connection.status !== "SYNCING")) return [];
    const config = this.configured();
    return this.calendarClient.listEvents?.({
      ...config,
      refreshToken: this.decryptRefreshToken(connection.encryptedRefreshToken),
      calendarId: connection.calendarId,
      from,
      to,
    }) ?? [];
  }

  async listUpcomingEventsForProfile(actor: Actor, profileId: string, from: Date, to: Date): Promise<GoogleCalendarEvent[]> {
    if (!actor.isActive) throw new AuthorizationError();
    const connection = await this.connectionForProfile(profileId);
    if (!connection || (connection.status !== "CONNECTED" && connection.status !== "SYNCING")) return [];
    const config = this.configured();
    return this.calendarClient.listEvents?.({
      ...config,
      refreshToken: this.decryptRefreshToken(connection.encryptedRefreshToken),
      calendarId: connection.calendarId,
      from,
      to,
    }) ?? [];
  }

  async syncInterviewToGoogle(actor: Pick<Actor, "id">, interview: GoogleCalendarInterview): Promise<{ externalEventId: string }> {
    const connection = await this.connectionForInterview(interview);
    if (!connection || (connection.status !== "CONNECTED" && connection.status !== "SYNCING")) {
      throw new ValidationError("Google Calendar is not connected");
    }
    const config = this.configured();
    const request = { ...config, refreshToken: this.decryptRefreshToken(connection.encryptedRefreshToken), calendarId: connection.calendarId };

    try {
      if (interview.status === "CANCELLED") {
        if (interview.googleEventId) {
          await this.calendarClient.cancelEvent({ ...request, eventId: interview.googleEventId });
          await this.recordSync(interview, "CANCELLED", interview.googleEventId);
        }
        return { externalEventId: interview.googleEventId ?? "" };
      }

      const event = this.event(interview);
      const externalEventId = interview.googleEventId
        ? await this.updateEvent(request, interview.googleEventId, event)
        : await this.createEvent(request, event);
      await this.recordSync(interview, "SYNCED", externalEventId);
      return { externalEventId };
    } catch (error) {
      await this.recordFailure(interview, error);
      throw error;
    }
  }

  decryptRefreshToken(encryptedRefreshToken: string): string {
    if (!this.cipher) {
      throw new ValidationError("Google Calendar OAuth is not configured");
    }
    return this.cipher.decrypt(encryptedRefreshToken);
  }

  private async connection(userId: string) {
    return this.database.googleCalendarConnection.findFirst({
      where: { companyId: userId, provider: GOOGLE_PROVIDER },
    });
  }

  private async connectionForProfile(profileId: string) {
    return this.database.googleCalendarConnection.findFirst({ where: { profileId, provider: GOOGLE_PROVIDER } });
  }

  private async connectionForInterview(interview: GoogleCalendarInterview) {
    if (interview.profileId) {
      const profileConnection = await this.connectionForProfile(interview.profileId);
      if (profileConnection) return profileConnection;
    }
    return this.connection(interview.companyId);
  }


  private event(interview: GoogleCalendarInterview): GoogleCalendarEvent {
    const preparation = interview.preparationNotes ? `\n\nPreparation\n${interview.preparationNotes}` : "";
    const meeting = interview.meetingLink ? `\nMeeting link: ${interview.meetingLink}` : "";
    return {
      id: `orbit${interview.id.replaceAll("-", "")}`,
      summary: `${interview.candidateName} · ${interview.companyName} — ${interview.jobTitle}`,
      description: `Candidate: ${interview.candidateName}\nCompany: ${interview.companyName}\nRole: ${interview.jobTitle}${meeting}${preparation}`,
      location: interview.meetingLink,
      start: { dateTime: interview.startsAt.toISOString(), timeZone: interview.timezone },
      end: { dateTime: interview.endsAt.toISOString(), timeZone: interview.timezone },
    };
  }

  private async createEvent(request: GoogleCalendarRequest, event: GoogleCalendarEvent): Promise<string> {
    return (await this.calendarClient.createEvent({ ...request, event })).id;
  }

  private async updateEvent(request: GoogleCalendarRequest, eventId: string, event: GoogleCalendarEvent): Promise<string> {
    await this.calendarClient.updateEvent({ ...request, eventId, event });
    return eventId;
  }

  private async recordSync(interview: GoogleCalendarInterview, status: "SYNCED" | "CANCELLED", externalEventId: string): Promise<void> {
    const occurredAt = new Date();
    await this.database.interviewRound?.update({ where: { id: interview.id }, data: { googleEventId: externalEventId, googleSyncStatus: status, googleLastSyncedAt: occurredAt } });
    await this.database.activityEvent?.create({
      data: {
        action: status === "CANCELLED" ? "GOOGLE_CALENDAR_EVENT_CANCELLED" : "GOOGLE_CALENDAR_EVENT_SYNCED",
        actorId: interview.closerId,
        actorNameSnapshot: null,
        actorRoleSnapshot: "CLOSER",
        entityType: "interview_round",
        entityId: interview.id,
        profileId: interview.profileId,
        leadId: interview.leadId,
        metadata: { externalEventId },
        oldSnapshot: null,
        newSnapshot: { googleSyncStatus: status },
        requestId: null,
      },
    });
  }

  private async recordFailure(interview: GoogleCalendarInterview, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : "Google Calendar synchronization failed";
    try {
      await this.database.interviewRound?.update({ where: { id: interview.id }, data: { googleSyncStatus: "FAILED", googleLastSyncedAt: new Date() } });
      await this.database.activityEvent?.create({
        data: {
          action: "GOOGLE_CALENDAR_SYNC_FAILED",
          actorId: interview.closerId,
          actorNameSnapshot: null,
          actorRoleSnapshot: "CLOSER",
          entityType: "interview_round",
          entityId: interview.id,
          profileId: interview.profileId,
          leadId: interview.leadId,
          metadata: { error: message },
          oldSnapshot: null,
          newSnapshot: { googleSyncStatus: "FAILED" },
          requestId: null,
        },
      });
    } catch {
      // Preserve the original Google failure for the retry path.
    }
  }
}
