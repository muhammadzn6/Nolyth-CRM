export type CreateUploadIntentInput = {
  idempotencyKey: string;
  ownerUserId: string;
  filename: string;
  contentType: string;
  contentLength: number;
};

export type CreateUploadIntentResult = {
  storageKey: string;
  uploadUrl: string;
  expiresAt: Date;
};

export interface ObjectStorage {
  createUploadIntent(input: CreateUploadIntentInput): Promise<CreateUploadIntentResult>;
  createDownloadUrl(storageKey: string): Promise<string>;
}
