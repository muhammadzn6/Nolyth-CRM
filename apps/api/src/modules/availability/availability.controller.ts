import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Put, Req, UseGuards } from "@nestjs/common";
import { AuthenticationError, AvailabilityService, ValidationError } from "@orbit/backend";
import { availabilityExceptionInputSchema, availabilityRuleInputSchema, uuidSchema } from "@orbit/contracts";
import { IdentityGuard, type AuthenticatedRequest } from "../identity/identity.guard";
type Schema<T> = { safeParse(value: unknown): { success: true; data: T } | { success: false; error: { issues: unknown } } };
function parse<T>(schema: Schema<T>, value: unknown): T { const result = schema.safeParse(value); if (!result.success) throw new ValidationError("The request payload is invalid", result.error.issues); return result.data; }
@Controller()
@UseGuards(IdentityGuard)
export class AvailabilityController {
  constructor(@Inject(AvailabilityService) private readonly availability: AvailabilityService) {}
  @Get("closers/:closerId/availability") list(@Param("closerId") id: string, @Req() request: AuthenticatedRequest) { return this.availability.list(this.actor(request), parse(uuidSchema, id)); }
  @Put("me/availability/rules") rules(@Body() input: unknown, @Req() request: AuthenticatedRequest) { return this.availability.replaceRules(this.actor(request), this.actor(request).id, parse(availabilityRuleInputSchema.array(), input)); }
  @Post("me/availability/exceptions") add(@Body() input: unknown, @Req() request: AuthenticatedRequest) { return this.availability.addException(this.actor(request), parse(availabilityExceptionInputSchema, input)); }
  @Patch("me/availability/exceptions/:exceptionId") update(@Param("exceptionId") id: string, @Body() input: unknown, @Req() request: AuthenticatedRequest) { return this.availability.updateException(this.actor(request), parse(uuidSchema, id), parse(availabilityExceptionInputSchema, input)); }
  @Delete("me/availability/exceptions/:exceptionId") remove(@Param("exceptionId") id: string, @Req() request: AuthenticatedRequest) { return this.availability.removeException(this.actor(request), parse(uuidSchema, id)); }
  private actor(request: AuthenticatedRequest) { if (!request.actor) throw new AuthenticationError(); return request.actor; }
}
