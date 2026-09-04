import { Body, Controller, Get, Inject, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import {
  AuthenticationError,
  AuthorizationService,
  UserManagementService,
  ValidationError,
} from "@orbit/backend";
import {
  createUserSchema,
  updateUserSchema,
  uuidSchema,
  type CreateUser,
  type UpdateUser,
} from "@orbit/contracts";

import { APP_BASE_URL_TOKEN, assertTrustedOrigin } from "../identity/identity.controller";
import { IdentityGuard, type AuthenticatedRequest } from "../identity/identity.guard";

function validationError(issues: unknown): ValidationError {
  return new ValidationError("The request payload is invalid", issues);
}

function parseUserId(id: string): string {
  const parsed = uuidSchema.safeParse(id);

  if (!parsed.success) {
    throw validationError(parsed.error.issues);
  }

  return parsed.data;
}

function parseCreateUser(input: unknown): CreateUser {
  const parsed = createUserSchema.safeParse(input);

  if (!parsed.success) {
    throw validationError(parsed.error.issues);
  }

  return parsed.data;
}

function parseUpdateUser(input: unknown): UpdateUser {
  const parsed = updateUserSchema.safeParse(input);

  if (!parsed.success) {
    throw validationError(parsed.error.issues);
  }

  return parsed.data;
}

type AuthenticatedOriginRequest = AuthenticatedRequest & {
  headers: { origin?: string | string[] };
};

@Controller("users")
@UseGuards(IdentityGuard)
export class UsersController {
  constructor(
    @Inject(UserManagementService) private readonly users: UserManagementService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(APP_BASE_URL_TOKEN) private readonly appBaseUrl: string,
  ) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    const actor = this.requireUserListAccess(request);
    return this.users.list(actor);
  }

  @Post()
  async create(@Body() input: unknown, @Req() request: AuthenticatedOriginRequest) {
    const actor = this.requireAdmin(request);
    assertTrustedOrigin(request.headers.origin, this.appBaseUrl);
    return this.users.create(actor, parseCreateUser(input));
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() input: unknown,
    @Req() request: AuthenticatedOriginRequest,
  ) {
    const actor = this.requireAdmin(request);
    assertTrustedOrigin(request.headers.origin, this.appBaseUrl);
    return this.users.update(actor, parseUserId(id), parseUpdateUser(input));
  }

  @Post(":id/revoke-sessions")
  async revokeSessions(@Param("id") id: string, @Req() request: AuthenticatedOriginRequest) {
    const actor = this.requireAdmin(request);
    assertTrustedOrigin(request.headers.origin, this.appBaseUrl);
    await this.users.revokeSessions(actor, parseUserId(id));
  }

  @Post(":id/resend-invitation")
  async resendInvitation(@Param("id") id: string, @Req() request: AuthenticatedOriginRequest) {
    const actor = this.requireAdmin(request);
    assertTrustedOrigin(request.headers.origin, this.appBaseUrl);
    return this.users.resendInvitation(actor, parseUserId(id));
  }

  private requireAdmin(request: AuthenticatedRequest) {
    const actor = request.actor;

    if (!actor) {
      throw new AuthenticationError();
    }

    this.authorization.assertRole(actor, ["ADMIN"]);
    return actor;
  }

  private requireUserListAccess(request: AuthenticatedRequest) {
    const actor = request.actor;
    if (!actor) throw new AuthenticationError();
    this.authorization.assertRole(actor, ["ADMIN", "BD"]);
    return actor;
  }
}
