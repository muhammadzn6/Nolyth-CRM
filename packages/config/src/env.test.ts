import { loadServerEnv, loadWebEnv } from "./env";

const serverSource = {
  DATABASE_URL: "postgresql://orbit:orbit@localhost:5432/orbit",
  REDIS_URL: "redis://localhost:6379",
  SESSION_SECRET: "a-session-secret-with-enough-entropy",
  S3_ENDPOINT: "http://localhost:9000",
  S3_BUCKET: "orbit-local",
  S3_ACCESS_KEY: "orbit",
  S3_SECRET_KEY: "orbit-secret",
  APP_BASE_URL: "http://localhost:3000",
};

describe("loadServerEnv", () => {
  it("rejects missing required variables with their names", () => {
    expect(() => loadServerEnv({})).toThrow(/DATABASE_URL/);
  });

  it("rejects invalid URLs", () => {
    expect(() =>
      loadServerEnv({ ...serverSource, REDIS_URL: "not-a-url" }),
    ).toThrow(/REDIS_URL/);
  });

  it("rejects database URLs that are not PostgreSQL URLs", () => {
    expect(() =>
      loadServerEnv({ ...serverSource, DATABASE_URL: "https://localhost/orbit" }),
    ).toThrow(/DATABASE_URL/);
  });

  it("parses the complete server configuration", () => {
    expect(loadServerEnv(serverSource)).toEqual({
      databaseUrl: serverSource.DATABASE_URL,
      redisUrl: serverSource.REDIS_URL,
      sessionSecret: serverSource.SESSION_SECRET,
      s3Endpoint: serverSource.S3_ENDPOINT,
      s3Bucket: serverSource.S3_BUCKET,
      s3AccessKey: serverSource.S3_ACCESS_KEY,
      s3SecretKey: serverSource.S3_SECRET_KEY,
      appBaseUrl: serverSource.APP_BASE_URL,
      googleCalendar: null,
    });
  });

  it("keeps Google Calendar safely disabled when all OAuth settings are absent", () => {
    expect(loadServerEnv(serverSource).googleCalendar).toBeNull();
  });

  it("rejects a partial Google Calendar configuration", () => {
    expect(() =>
      loadServerEnv({ ...serverSource, GOOGLE_CLIENT_ID: "google-client-id" }),
    ).toThrow(/GOOGLE_CLIENT_SECRET/);
  });
});

describe("loadWebEnv", () => {
  it("requires the browser-safe API base URL", () => {
    expect(() =>
      loadWebEnv({ NEXT_PUBLIC_APP_BASE_URL: "http://localhost:3000" }),
    ).toThrow(/NEXT_PUBLIC_API_BASE_URL/);
  });

  it("rejects an invalid browser-safe API base URL", () => {
    expect(() =>
      loadWebEnv({
        NEXT_PUBLIC_APP_BASE_URL: "http://localhost:3000",
        NEXT_PUBLIC_API_BASE_URL: "not-a-url",
      }),
    ).toThrow(/NEXT_PUBLIC_API_BASE_URL/);
  });

  it("parses browser-safe public values without reading server secrets", () => {
    expect(
      loadWebEnv({
        NEXT_PUBLIC_APP_BASE_URL: "http://localhost:3000",
        NEXT_PUBLIC_API_BASE_URL: "http://localhost:3001/api/v1",
        SESSION_SECRET: "must-not-be-exposed",
        DATABASE_URL: serverSource.DATABASE_URL,
      }),
    ).toEqual({
      appBaseUrl: "http://localhost:3000",
      apiBaseUrl: "http://localhost:3001/api/v1",
    });
  });
});
