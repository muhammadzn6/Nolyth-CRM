import { z } from "zod";

export type ServerEnv = {
  databaseUrl: string;
  redisUrl: string;
  sessionSecret: string;
  s3Endpoint: string;
  s3Bucket: string;
  s3AccessKey: string;
  s3SecretKey: string;
  appBaseUrl: string;
  googleCalendar: GoogleCalendarEnv | null;
};

export type GoogleCalendarEnv = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenEncryptionKey: string;
};

export type WebEnv = { appBaseUrl: string; apiBaseUrl: string };

const serverSchema = z.object({
  DATABASE_URL: z
    .string()
    .trim()
    .url()
    .refine((value) => {
      const protocol = new URL(value).protocol;
      return protocol === "postgres:" || protocol === "postgresql:";
    }, "must use the postgres or postgresql scheme"),
  REDIS_URL: z.string().trim().url(),
  SESSION_SECRET: z.string().trim().min(1),
  S3_ENDPOINT: z.string().trim().url(),
  S3_BUCKET: z.string().trim().min(1),
  S3_ACCESS_KEY: z.string().trim().min(1),
  S3_SECRET_KEY: z.string().trim().min(1),
  APP_BASE_URL: z.string().trim().url(),
});

const webSchema = z.object({
  NEXT_PUBLIC_APP_BASE_URL: z.string().trim().url(),
  NEXT_PUBLIC_API_BASE_URL: z.string().trim().url(),
});

const googleCalendarSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().trim().min(1),
  GOOGLE_CLIENT_SECRET: z.string().trim().min(1),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().trim().url(),
  GOOGLE_TOKEN_ENCRYPTION_KEY: z.string().trim().refine((value) => {
    const decoded = Buffer.from(value, "base64");
    return decoded.length === 32 && decoded.toString("base64") === value;
  }, "must be a base64-encoded 32-byte key"),
});

type EnvSource = Record<string, string | undefined>;

function parse<T>(schema: z.ZodType<T>, source: EnvSource, label: string): T {
  const result = schema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new Error(`Invalid ${label} environment: ${details}`);
  }

  return result.data;
}

function loadGoogleCalendarEnv(source: EnvSource): GoogleCalendarEnv | null {
  const values = [
    source.GOOGLE_CLIENT_ID,
    source.GOOGLE_CLIENT_SECRET,
    source.GOOGLE_OAUTH_REDIRECT_URI,
    source.GOOGLE_TOKEN_ENCRYPTION_KEY,
  ];

  if (values.every((value) => !value?.trim())) {
    return null;
  }

  const parsed = parse(googleCalendarSchema, source, "Google Calendar");
  return {
    clientId: parsed.GOOGLE_CLIENT_ID,
    clientSecret: parsed.GOOGLE_CLIENT_SECRET,
    redirectUri: parsed.GOOGLE_OAUTH_REDIRECT_URI,
    tokenEncryptionKey: parsed.GOOGLE_TOKEN_ENCRYPTION_KEY,
  };
}

export function loadServerEnv(source: EnvSource = process.env): ServerEnv {
  const values = parse(serverSchema, source, "server");

  return {
    databaseUrl: values.DATABASE_URL,
    redisUrl: values.REDIS_URL,
    sessionSecret: values.SESSION_SECRET,
    s3Endpoint: values.S3_ENDPOINT,
    s3Bucket: values.S3_BUCKET,
    s3AccessKey: values.S3_ACCESS_KEY,
    s3SecretKey: values.S3_SECRET_KEY,
    appBaseUrl: values.APP_BASE_URL,
    googleCalendar: loadGoogleCalendarEnv(source),
  };
}

export function loadWebEnv(source: EnvSource = process.env): WebEnv {
  const values = parse(webSchema, source, "web");

  return {
    appBaseUrl: values.NEXT_PUBLIC_APP_BASE_URL,
    apiBaseUrl: values.NEXT_PUBLIC_API_BASE_URL,
  };
}
