import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthenticationError, DocumentsService, ValidationError } from "@orbit/backend";
import { archiveDocumentSchema, attachDocumentUsageSchema, createDocumentSchema, createDocumentVersionSchema, documentUploadIntentSchema, uuidSchema } from "@orbit/contracts";
import { IdentityGuard, type AuthenticatedRequest } from "../identity/identity.guard";
type Schema<T> = { safeParse(value: unknown): { success: true; data: T } | { success: false; error: { issues: unknown } } };
function parse<T>(schema: Schema<T>, value: unknown): T { const result = schema.safeParse(value); if (!result.success) throw new ValidationError("The request payload is invalid", result.error.issues); return result.data; }
@Controller()
@UseGuards(IdentityGuard)
export class DocumentsController {
  constructor(@Inject(DocumentsService) private readonly documents: DocumentsService) {}
  @Get("profiles/:profileId/documents") list(@Param("profileId") id: string, @Req() request: AuthenticatedRequest) { return this.documents.list(this.actor(request), parse(uuidSchema, id)); }
  @Post("profiles/:profileId/documents") create(@Param("profileId") id: string, @Body() input: unknown, @Req() request: AuthenticatedRequest) { return this.documents.create(this.actor(request), parse(uuidSchema, id), parse(createDocumentSchema, input)); }
  @Post("profiles/:profileId/documents/upload-intent") uploadIntent(@Param("profileId") id: string, @Body() input: unknown, @Req() request: AuthenticatedRequest) { return this.documents.createUploadIntent(this.actor(request), parse(uuidSchema, id), parse(documentUploadIntentSchema, input)); }
  @Post("documents/:documentId/versions") version(@Param("documentId") id: string, @Body() input: unknown, @Req() request: AuthenticatedRequest) { return this.documents.addVersion(this.actor(request), parse(uuidSchema, id), parse(createDocumentVersionSchema, input)); }
  @Post("documents/:documentId/archive") archive(@Param("documentId") id: string, @Body() input: unknown, @Req() request: AuthenticatedRequest) { const value = parse(archiveDocumentSchema, input); return this.documents.archive(this.actor(request), parse(uuidSchema, id), value.reason); }
  @Get("documents/:documentId/versions/:versionId/download") download(@Param("documentId") documentId: string, @Param("versionId") versionId: string, @Req() request: AuthenticatedRequest) { return this.documents.createDownloadUrl(this.actor(request), parse(uuidSchema, documentId), parse(uuidSchema, versionId)); }
  @Post("leads/:leadId/document-usages") attach(@Param("leadId") id: string, @Body() input: unknown, @Req() request: AuthenticatedRequest) { const value = parse(attachDocumentUsageSchema, input); return this.documents.attachToLead(this.actor(request), parse(uuidSchema, id), value.documentVersionId, value.usageType); }
  private actor(request: AuthenticatedRequest) { if (!request.actor) throw new AuthenticationError(); return request.actor; }
}
