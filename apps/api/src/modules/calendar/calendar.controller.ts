import { Controller, Delete, Get, Inject, Query, Req, Res, UseGuards } from "@nestjs/common";
import {
  AuthenticationError,
  GoogleCalendarService,
  SessionService,
  ValidationError,
} from "@orbit/backend";
import {
  calendarConnectionSchema,
  googleCalendarBusyQuerySchema,
  googleCalendarBusySchema,
  googleCalendarCallbackQuerySchema,
  googleCalendarConnectSchema,
  uuidSchema,
} from "@orbit/contracts";

import { IdentityGuard, type AuthenticatedRequest } from "../identity/identity.guard";

export const CALENDAR_APP_BASE_URL_TOKEN = Symbol("CALENDAR_APP_BASE_URL");

type RedirectResponse = { redirect(url: string): void };

function callbackQuery(value: unknown) {
  const parsed = googleCalendarCallbackQuerySchema.safeParse(value);
  if (!parsed.success) {
    throw new ValidationError("The request payload is invalid", parsed.error.issues);
  }
  return parsed.data;
}

function busyQuery(value: unknown) {
  const parsed = googleCalendarBusyQuerySchema.safeParse(value);
  if (!parsed.success) {
    throw new ValidationError("The request payload is invalid", parsed.error.issues);
  }
  return parsed.data;
}

function ownerId(value: string | undefined) {
  if (!value) throw new ValidationError("Provide a calendar owner");
  return uuidSchema.parse(value);
}

@Controller("calendar/google")
@UseGuards(IdentityGuard)
export class CalendarController {
  constructor(
    @Inject(GoogleCalendarService) private readonly calendar: GoogleCalendarService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(CALENDAR_APP_BASE_URL_TOKEN) private readonly appBaseUrl: string,
  ) {}

  @Get("connect")
  connect(@Req() request: AuthenticatedRequest, @Query("companyId") companyId?: string, @Query("profileId") profileId?: string) {
    const actor = this.actor(request);
    if (profileId) {
      const id = uuidSchema.parse(profileId);
      const state = this.sessions.createOAuthState(actor, request, { profileId: id });
      return googleCalendarConnectSchema.parse(this.calendar.connectForProfile(actor, state, id));
    }
    const employerId = ownerId(companyId);
    const state = this.sessions.createOAuthState(actor, request, { companyId: employerId });
    return googleCalendarConnectSchema.parse(this.calendar.connect(actor, state, employerId));
  }

  @Get("callback")
  async callback(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Res() response: RedirectResponse) {
    const actor = this.actor(request);
    const input = callbackQuery(query);
    const context = this.sessions.requireOAuthState(actor, request, input.state);
    if (context.profileId) {
      await this.calendar.completeForProfile(actor, input.code, uuidSchema.parse(context.profileId));
      response.redirect(new URL("/profiles?calendar=connected", this.appBaseUrl).toString());
    } else {
      const employerId = ownerId(context.companyId);
      await this.calendar.complete(actor, input.code, employerId);
      response.redirect(new URL("/admin/client-calendars?calendar=connected", this.appBaseUrl).toString());
    }
  }

  @Get("status")
  async status(@Req() request: AuthenticatedRequest, @Query("companyId") companyId?: string, @Query("profileId") profileId?: string) {
    const actor = this.actor(request);
    return calendarConnectionSchema.parse(profileId
      ? await this.calendar.statusForProfile(actor, uuidSchema.parse(profileId))
      : await this.calendar.status(actor, ownerId(companyId)));
  }

  @Get("free-busy")
  async busy(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    const input = busyQuery(query);
    this.actor(request);
    return googleCalendarBusySchema.parse(await (input.profileId
      ? this.calendar.checkGoogleBusyFreeForProfile(input.profileId, new Date(input.startsAt), new Date(input.endsAt))
      : this.calendar.checkGoogleBusyFree(input.companyId!, new Date(input.startsAt), new Date(input.endsAt))));
  }

  @Delete()
  async disconnect(@Req() request: AuthenticatedRequest, @Query("companyId") companyId?: string, @Query("profileId") profileId?: string): Promise<void> {
    const actor = this.actor(request);
    if (profileId) await this.calendar.disconnectForProfile(actor, uuidSchema.parse(profileId));
    else await this.calendar.disconnect(actor, ownerId(companyId));
  }

  private actor(request: AuthenticatedRequest) {
    if (!request.actor) {
      throw new AuthenticationError();
    }
    return request.actor;
  }
}
