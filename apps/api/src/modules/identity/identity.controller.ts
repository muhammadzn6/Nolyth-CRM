import { Body, Controller, Get, Inject, Optional, Post, Req, Res, UseFilters, UseGuards } from "@nestjs/common";
import {
  AuthorizationError,
  ACCESS_TOKEN_COOKIE_NAME,
  ACCESS_TOKEN_DURATION_MS,
  IdentityService,
  PasswordResetService,
  ValidationError,
  type SessionRequest,
} from "@orbit/backend";
import { changePasswordRequestSchema, loginRequestSchema, passwordResetCompleteSchema, passwordResetRequestSchema } from "@orbit/contracts";

import { IdentityGuard, type AuthenticatedRequest } from "./identity.guard";
import { AppErrorFilter } from "./app-error.filter";

type CookieResponse = {
  cookie(name: string, value: string, options: Record<string, unknown>): void;
  clearCookie(name: string, options: Record<string, unknown>): void;
};

type OriginRequest = SessionRequest & {
  headers: { origin?: string | string[] };
};

export const APP_BASE_URL_TOKEN = Symbol("APP_BASE_URL");

export function assertTrustedOrigin(origin: string | string[] | undefined, appBaseUrl: string): void {
  if (typeof origin !== "string") {
    throw new AuthorizationError("Request origin is not allowed");
  }

  try {
    const requestUrl = new URL(origin);
    const appUrl = new URL(appBaseUrl);
    const requestIsOriginOnly =
      !requestUrl.username &&
      !requestUrl.password &&
      requestUrl.pathname === "/" &&
      !requestUrl.search &&
      !requestUrl.hash;
    const protocolsAreSafe =
      (requestUrl.protocol === "http:" || requestUrl.protocol === "https:") &&
      (appUrl.protocol === "http:" || appUrl.protocol === "https:");

    if (!requestIsOriginOnly || !protocolsAreSafe || requestUrl.origin !== appUrl.origin) {
      throw new Error("Origin mismatch");
    }
  } catch {
    throw new AuthorizationError("Request origin is not allowed");
  }
}

export function sessionCookieOptions(appBaseUrl: string) {
  return {
    httpOnly: true,
  // Local Orbit runs over HTTP; production must use HTTPS for Secure cookies.
  secure: new URL(appBaseUrl).protocol === "https:",
  sameSite: "lax" as const,
    path: "/",
  };
}

@Controller("api/v1/auth")
@UseFilters(AppErrorFilter)
export class IdentityController {
  constructor(
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(APP_BASE_URL_TOKEN) private readonly appBaseUrl: string,
    @Optional() @Inject(PasswordResetService) private readonly passwordReset?: PasswordResetService,
  ) {}

  @Post("login")
  async login(
    @Body() input: unknown,
    @Req() request: OriginRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    assertTrustedOrigin(request.headers.origin, this.appBaseUrl);
    const parsed = loginRequestSchema.safeParse(input);

    if (!parsed.success) {
      throw new ValidationError("The request payload is invalid", parsed.error.issues);
    }

    const session = await this.identity.login(parsed.data, request);

    response.cookie("orbit_session", session.sessionToken, {
      ...sessionCookieOptions(this.appBaseUrl),
      expires: session.expiresAt,
    });
    if (session.accessToken) {
      response.cookie(ACCESS_TOKEN_COOKIE_NAME, session.accessToken, {
        ...sessionCookieOptions(this.appBaseUrl),
        expires: new Date(Date.now() + ACCESS_TOKEN_DURATION_MS),
      });
    }

    return session.user;
  }

  @Post("logout")
  async logout(
    @Req() request: OriginRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    assertTrustedOrigin(request.headers.origin, this.appBaseUrl);
    await this.identity.logout(request);
    response.clearCookie("orbit_session", sessionCookieOptions(this.appBaseUrl));
    response.clearCookie(ACCESS_TOKEN_COOKIE_NAME, sessionCookieOptions(this.appBaseUrl));
  }

  @Post("refresh")
  async refresh(
    @Req() request: OriginRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    assertTrustedOrigin(request.headers.origin, this.appBaseUrl);
    const accessToken = await this.identity.refreshAccessToken(request);
    response.cookie(ACCESS_TOKEN_COOKIE_NAME, accessToken.accessToken, {
      ...sessionCookieOptions(this.appBaseUrl),
      expires: accessToken.expiresAt,
    });
    return { accepted: true };
  }

  @Get("me")
  @UseGuards(IdentityGuard)
  me(@Req() request: AuthenticatedRequest) {
    return request.actor;
  }

  @Post("change-password")
  @UseGuards(IdentityGuard)
  async changePassword(@Body() input: unknown, @Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: CookieResponse) {
    const origin = (request.headers as { origin?: string | string[] } | undefined)?.origin;
    assertTrustedOrigin(origin, this.appBaseUrl);
    const parsed = changePasswordRequestSchema.safeParse(input);

    if (!parsed.success) {
      throw new ValidationError("Use a new password with at least 12 characters", parsed.error.issues);
    }

    if (!request.actor) throw new AuthorizationError();
    await this.identity.changePassword(request.actor, parsed.data);
    response.clearCookie("orbit_session", sessionCookieOptions(this.appBaseUrl));
    response.clearCookie(ACCESS_TOKEN_COOKIE_NAME, sessionCookieOptions(this.appBaseUrl));
  }

  @Post("password-reset/request")
  async requestReset(@Body() input: unknown, @Req() request: OriginRequest) {
    assertTrustedOrigin(request.headers.origin, this.appBaseUrl);
    const parsed = passwordResetRequestSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("The request payload is invalid", parsed.error.issues);
    if (!this.passwordReset) throw new AuthorizationError();
    return this.passwordReset.request(parsed.data.email);
  }

  @Post("password-reset/complete")
  async completeReset(@Body() input: unknown, @Req() request: OriginRequest) {
    assertTrustedOrigin(request.headers.origin, this.appBaseUrl);
    const parsed = passwordResetCompleteSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("The reset token or password is invalid", parsed.error.issues);
    if (!this.passwordReset) throw new AuthorizationError();
    await this.passwordReset.complete(parsed.data);
    return { accepted: true };
  }
}
