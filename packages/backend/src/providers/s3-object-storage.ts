import { randomUUID } from "node:crypto";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ServerEnv } from "@orbit/config";
import type { CreateUploadIntentInput, CreateUploadIntentResult, ObjectStorage } from "./storage.port";

const MAX_UPLOAD_BYTES = 25_000_000;
const allowedTypes = new Set(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/png", "image/jpeg"]);

export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;
  constructor(private readonly env: Pick<ServerEnv, "s3Endpoint" | "s3Bucket" | "s3AccessKey" | "s3SecretKey">, private readonly now = () => new Date()) {
    this.client = new S3Client({ endpoint: env.s3Endpoint, region: "us-east-1", forcePathStyle: true, credentials: { accessKeyId: env.s3AccessKey, secretAccessKey: env.s3SecretKey } });
  }
  async createUploadIntent(input: CreateUploadIntentInput): Promise<CreateUploadIntentResult> {
    if (!allowedTypes.has(input.contentType) || input.contentLength <= 0 || input.contentLength > MAX_UPLOAD_BYTES) throw new Error("Unsupported or oversized document upload");
    const storageKey = `profiles/${input.ownerUserId}/uploads/${randomUUID()}`;
    const expiresAt = new Date(this.now().getTime() + 10 * 60 * 1000);
    const uploadUrl = await getSignedUrl(this.client, new PutObjectCommand({ Bucket: this.env.s3Bucket, Key: storageKey, ContentType: input.contentType, ContentLength: input.contentLength }), { expiresIn: 600 });
    return { storageKey, uploadUrl, expiresAt };
  }
  async createDownloadUrl(storageKey: string): Promise<string> {
    if (!/^profiles\/[0-9a-f-]{36}\/uploads\/[0-9a-f-]{36}$/.test(storageKey)) throw new Error("Invalid document storage key");
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.env.s3Bucket, Key: storageKey }), { expiresIn: 300 });
  }
}
