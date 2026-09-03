import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  AuthenticationError,
  CandidatesService,
  ValidationError,
} from "@orbit/backend";
import {
  archiveCandidateRequestSchema,
  archiveProfileRequestSchema,
  assignmentUserRequestSchema,
  candidateListQuerySchema,
  createCandidateSchema,
  createProfileSchema,
  endAssignmentRequestSchema,
  profileListQuerySchema,
  profileStatusRequestSchema,
  restoreCandidateRequestSchema,
  updateCandidateRequestSchema,
  updateProfileRequestSchema,
  uuidSchema,
} from "@orbit/contracts";

import { APP_BASE_URL_TOKEN, assertTrustedOrigin } from "../identity/identity.controller";
import { IdentityGuard, type AuthenticatedRequest } from "../identity/identity.guard";

type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: { issues: unknown } };

type Schema<T> = { safeParse(value: unknown): ParseResult<T> };

type AuthenticatedOriginRequest = AuthenticatedRequest & {
  headers: { origin?: string | string[] };
};

function parse<T>(schema: Schema<T>, value: unknown): T {
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    throw new ValidationError("The request payload is invalid", parsed.error.issues);
  }

  return parsed.data;
}

@Controller()
@UseGuards(IdentityGuard)
export class CandidatesController {
  constructor(
    @Inject(CandidatesService) private readonly candidates: CandidatesService,
    @Inject(APP_BASE_URL_TOKEN) private readonly appBaseUrl: string,
  ) {}

  @Get("candidates")
  listCandidates(@Query() query: unknown, @Req() request: AuthenticatedRequest) {
    return this.candidates.listCandidates(this.actor(request), parse(candidateListQuerySchema, query));
  }

  @Post("candidates")
  createCandidate(@Body() input: unknown, @Req() request: AuthenticatedOriginRequest) {
    const actor = this.mutationActor(request);
    return this.candidates.createCandidate(actor, parse(createCandidateSchema, input));
  }

  @Get("candidates/:candidateId")
  getCandidate(@Param("candidateId") candidateId: string, @Req() request: AuthenticatedRequest) {
    return this.candidates.getCandidate(this.actor(request), parse(uuidSchema, candidateId));
  }

  @Patch("candidates/:candidateId")
  updateCandidate(
    @Param("candidateId") candidateId: string,
    @Body() input: unknown,
    @Req() request: AuthenticatedOriginRequest,
  ) {
    const actor = this.mutationActor(request);
    const { expectedVersion, ...update } = parse(updateCandidateRequestSchema, input);
    return this.candidates.updateCandidate(
      actor,
      parse(uuidSchema, candidateId),
      update,
      expectedVersion,
    );
  }

  @Post("candidates/:candidateId/archive")
  archiveCandidate(
    @Param("candidateId") candidateId: string,
    @Body() input: unknown,
    @Req() request: AuthenticatedOriginRequest,
  ) {
    const actor = this.mutationActor(request);
    const command = parse(archiveCandidateRequestSchema, input);
    return this.candidates.archiveCandidate(
      actor,
      parse(uuidSchema, candidateId),
      command.reason,
      command.expectedVersion,
    );
  }

  @Post("candidates/:candidateId/restore")
  restoreCandidate(
    @Param("candidateId") candidateId: string,
    @Body() input: unknown,
    @Req() request: AuthenticatedOriginRequest,
  ) {
    const actor = this.mutationActor(request);
    const command = parse(restoreCandidateRequestSchema, input);
    return this.candidates.restoreCandidate(
      actor,
      parse(uuidSchema, candidateId),
      command.expectedVersion,
    );
  }

  @Get("profiles")
  listProfiles(@Query() query: unknown, @Req() request: AuthenticatedRequest) {
    return this.candidates.listProfiles(this.actor(request), parse(profileListQuerySchema, query));
  }

  @Post("profiles")
  createProfile(@Body() input: unknown, @Req() request: AuthenticatedOriginRequest) {
    const actor = this.mutationActor(request);
    return this.candidates.createProfile(actor, parse(createProfileSchema, input));
  }

  @Get("profiles/:profileId")
  getProfile(@Param("profileId") profileId: string, @Req() request: AuthenticatedRequest) {
    return this.candidates.getProfile(this.actor(request), parse(uuidSchema, profileId));
  }

  @Patch("profiles/:profileId")
  updateProfile(
    @Param("profileId") profileId: string,
    @Body() input: unknown,
    @Req() request: AuthenticatedOriginRequest,
  ) {
    const actor = this.mutationActor(request);
    const { expectedVersion, ...update } = parse(updateProfileRequestSchema, input);
    return this.candidates.updateProfile(
      actor,
      parse(uuidSchema, profileId),
      update,
      expectedVersion,
    );
  }

  @Post("profiles/:profileId/activate")
  activateProfile(
    @Param("profileId") profileId: string,
    @Body() input: unknown,
    @Req() request: AuthenticatedOriginRequest,
  ) {
    return this.transitionProfile(profileId, "ACTIVE", input, request);
  }

  @Post("profiles/:profileId/pause")
  pauseProfile(
    @Param("profileId") profileId: string,
    @Body() input: unknown,
    @Req() request: AuthenticatedOriginRequest,
  ) {
    return this.transitionProfile(profileId, "PAUSED", input, request);
  }

  @Post("profiles/:profileId/archive")
  archiveProfile(
    @Param("profileId") profileId: string,
    @Body() input: unknown,
    @Req() request: AuthenticatedOriginRequest,
  ) {
    const actor = this.mutationActor(request);
    const command = parse(archiveProfileRequestSchema, input);
    return this.candidates.transitionProfile(
      actor,
      parse(uuidSchema, profileId),
      "ARCHIVED",
      command.reason,
      command.expectedVersion,
    );
  }

  @Post("profiles/:profileId/restore")
  restoreProfile(
    @Param("profileId") profileId: string,
    @Body() input: unknown,
    @Req() request: AuthenticatedOriginRequest,
  ) {
    return this.transitionProfile(profileId, "DRAFT", input, request);
  }

  @Get("profiles/:profileId/bd-assignments")
  listBdAssignments(
    @Param("profileId") profileId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.candidates.listBdAssignments(
      this.actor(request),
      parse(uuidSchema, profileId),
    );
  }

  @Post("profiles/:profileId/bd-assignments")
  assignBd(
    @Param("profileId") profileId: string,
    @Body() input: unknown,
    @Req() request: AuthenticatedOriginRequest,
  ) {
    const actor = this.mutationActor(request);
    const command = parse(assignmentUserRequestSchema, input);
    return this.candidates.assignBd(actor, parse(uuidSchema, profileId), command.userId);
  }

  @Delete("profiles/:profileId/bd-assignments/:assignmentId")
  endBdAssignment(
    @Param("profileId") profileId: string,
    @Param("assignmentId") assignmentId: string,
    @Body() input: unknown,
    @Req() request: AuthenticatedOriginRequest,
  ) {
    const actor = this.mutationActor(request);
    const command = parse(endAssignmentRequestSchema, input);
    return this.candidates.endBdAssignment(
      actor,
      parse(uuidSchema, profileId),
      parse(uuidSchema, assignmentId),
      command.reason,
    );
  }

  @Get("profiles/:profileId/closer-eligibility")
  listCloserEligibility(
    @Param("profileId") profileId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.candidates.listCloserEligibility(
      this.actor(request),
      parse(uuidSchema, profileId),
    );
  }

  @Post("profiles/:profileId/closer-eligibility")
  setCloserEligibility(
    @Param("profileId") profileId: string,
    @Body() input: unknown,
    @Req() request: AuthenticatedOriginRequest,
  ) {
    const actor = this.mutationActor(request);
    const command = parse(assignmentUserRequestSchema, input);
    return this.candidates.setCloserEligibility(
      actor,
      parse(uuidSchema, profileId),
      command.userId,
    );
  }

  @Delete("profiles/:profileId/closer-eligibility/:assignmentId")
  endCloserEligibility(
    @Param("profileId") profileId: string,
    @Param("assignmentId") assignmentId: string,
    @Body() input: unknown,
    @Req() request: AuthenticatedOriginRequest,
  ) {
    const actor = this.mutationActor(request);
    const command = parse(endAssignmentRequestSchema, input);
    return this.candidates.endCloserEligibility(
      actor,
      parse(uuidSchema, profileId),
      parse(uuidSchema, assignmentId),
      command.reason,
    );
  }

  private transitionProfile(
    profileId: string,
    status: "ACTIVE" | "PAUSED" | "DRAFT",
    input: unknown,
    request: AuthenticatedOriginRequest,
  ) {
    const actor = this.mutationActor(request);
    const command = parse(profileStatusRequestSchema, input);
    return this.candidates.transitionProfile(
      actor,
      parse(uuidSchema, profileId),
      status,
      null,
      command.expectedVersion,
    );
  }

  private actor(request: AuthenticatedRequest) {
    if (!request.actor) {
      throw new AuthenticationError();
    }

    return request.actor;
  }

  private mutationActor(request: AuthenticatedOriginRequest) {
    const actor = this.actor(request);
    assertTrustedOrigin(request.headers.origin, this.appBaseUrl);
    return actor;
  }
}
