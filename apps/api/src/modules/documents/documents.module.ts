import { Module } from "@nestjs/common";
import { AuthorizationService, DocumentsService, S3ObjectStorage, type LeadsDatabase, type ObjectStorage } from "@orbit/backend";
import { database } from "@orbit/database";
import { loadServerEnv } from "@orbit/config";
import { IdentityModule } from "../identity/identity.module";
import { DocumentsController } from "./documents.controller";
const documentsDatabase = database as unknown as LeadsDatabase;
const objectStorage: ObjectStorage = { createUploadIntent: (input) => new S3ObjectStorage(loadServerEnv()).createUploadIntent(input), createDownloadUrl: (storageKey) => new S3ObjectStorage(loadServerEnv()).createDownloadUrl(storageKey) };
@Module({ imports: [IdentityModule], controllers: [DocumentsController], providers: [{ provide: DocumentsService, inject: [AuthorizationService], useFactory: (authorization: AuthorizationService) => new DocumentsService(documentsDatabase, authorization, objectStorage) }], exports: [DocumentsService] })
export class DocumentsModule {}
