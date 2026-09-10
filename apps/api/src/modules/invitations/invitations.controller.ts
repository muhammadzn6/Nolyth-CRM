import { Body, Controller, Inject, Post, Req, Res } from "@nestjs/common";
import {
  InvitationService,
  ACCESS_TOKEN_COOKIE_NAME,
  ACCESS_TOKEN_DURATION_MS,
  SESSION_COOKIE_NAME,
  SessionService,
  ValidationError,
  type SessionRequest,
} from "@orbit/backend";
import { acceptInvitationSchema } from "@orbit/contracts";

import {
  APP_BASE_URL_TOKEN,
  assertTrustedOrigin,
  sessionCookieOptions,
} from "../identity/identity.controller";

type CookieResponse = {
  cookie(name: string, value: string, options: Record<string, unknown>): void;
};

type OriginRequest = SessionRequest & {
  headers: { origin?: string | string[] };
};

function parseAcceptance(input: unknown) {
  const parsed = acceptInvitationSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("The request payload is invalid", parsed.error.issues);
  }

  return parsed.data;
}

@Controller("api/v1/auth/invitations")
export class InvitationsController {
  constructor(
    @Inject(InvitationService) private readonly invitations: InvitationService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(APP_BASE_URL_TOKEN) private readonly appBaseUrl: string,
  ) {}

  @Post("accept")
  async accept(
    @Body() input: unknown,
    @Req() request: OriginRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    assertTrustedOrigin(request.headers.origin, this.appBaseUrl);
    const parsed = parseAcceptance(input);
    const user = await this.invitations.accept(parsed.token, parsed.password);
    const session = await this.sessions.create(user.id);

    response.cookie(SESSION_COOKIE_NAME, session.sessionToken, {
      ...sessionCookieOptions(this.appBaseUrl),
      expires: session.expiresAt,
    });
    if (session.accessToken) {
      response.cookie(ACCESS_TOKEN_COOKIE_NAME, session.accessToken, {
        ...sessionCookieOptions(this.appBaseUrl),
        expires: new Date(Date.now() + ACCESS_TOKEN_DURATION_MS),
      });
    }

    return user;
  }
}
