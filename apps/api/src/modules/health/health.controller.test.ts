import "reflect-metadata";

import {
  Body,
  Controller,
  Get,
  type INestApplication,
  Post,
  Req,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { loginRequestSchema } from "@orbit/contracts";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

const trustedOrigin = "https://orbit.example.com";
const safeRequestId = "client-request-123";
const internalSecret = "postgres://admin:super-secret@database/orbit";

class ValidationProbePayload {
  static readonly schema = loginRequestSchema;

  email!: string;
  password!: string;
}

type ProbeRequest = {
  cookies?: Record<string, string>;
  requestId?: string;
};

@Controller()
class ProbeController {
  @Post("validation-probe")
  validate(@Body() input: ValidationProbePayload) {
    return input;
  }

  @Get("error-probe")
  fail(): never {
    throw new Error(`Unexpected database failure: ${internalSecret}`);
  }

  @Get("cookie-probe")
  cookies(@Req() requestValue: ProbeRequest) {
    return {
      cookies: requestValue.cookies,
      requestId: requestValue.requestId,
    };
  }
}

type HealthCheck = () => Promise<void>;

async function createApp(options: {
  postgresCheck?: HealthCheck;
  redisCheck?: HealthCheck;
} = {}): Promise<INestApplication> {
  const [{ configureApi }, health] = await Promise.all([
    import("../../main"),
    import("./health.module"),
  ]);
  const moduleBuilder = Test.createTestingModule({
    imports: [health.HealthModule],
    controllers: [ProbeController],
  })
    .overrideProvider(health.POSTGRES_HEALTH_CHECK)
    .useValue(options.postgresCheck ?? vi.fn().mockResolvedValue(undefined))
    .overrideProvider(health.REDIS_HEALTH_CHECK)
    .useValue(options.redisCheck ?? vi.fn().mockResolvedValue(undefined));
  const module = await moduleBuilder.compile();
  const app = module.createNestApplication();

  configureApi(app, { appBaseUrl: trustedOrigin });
  await app.init();

  return app;
}

describe("API bootstrap and health", () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("propagates a safe request ID and parses cookies", async () => {
    app = await createApp();

    const response = await request(app.getHttpServer())
      .get("/api/v1/cookie-probe")
      .set("Cookie", "orbit_session=session-token; theme=dark")
      .set("X-Request-Id", safeRequestId)
      .expect(200);

    expect(response.headers["x-request-id"]).toBe(safeRequestId);
    expect(response.body).toEqual({
      success: true,
      data: {
        cookies: { orbit_session: "session-token", theme: "dark" },
        requestId: safeRequestId,
      },
      meta: { requestId: safeRequestId },
    });
  });

  it("replaces an unsafe incoming request ID", async () => {
    app = await createApp();

    const response = await request(app.getHttpServer())
      .get("/api/v1/cookie-probe")
      .set("X-Request-Id", "../../secret value")
      .expect(200);

    expect(response.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(response.body.data.requestId).toBe(response.headers["x-request-id"]);
  });

  it("returns 400 INVALID_REQUEST for malformed JSON", async () => {
    app = await createApp();

    const response = await request(app.getHttpServer())
      .post("/api/v1/validation-probe")
      .set("Content-Type", "application/json")
      .send('{"email":')
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "INVALID_REQUEST",
        message: "The request is malformed",
      },
      meta: { requestId: expect.any(String) },
    });
    expect(response.headers["x-request-id"]).toBe(response.body.meta.requestId);
  });

  it("rejects unknown payload fields", async () => {
    app = await createApp();

    const response = await request(app.getHttpServer())
      .post("/api/v1/validation-probe")
      .send({
        email: "user@example.com",
        password: "correct-password",
        isAdmin: true,
      })
      .expect(422);

    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("redacts unexpected errors", async () => {
    app = await createApp();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await request(app.getHttpServer())
      .get("/api/v1/error-probe")
      .set("X-Request-Id", safeRequestId)
      .expect(500);
    const serializedBody = JSON.stringify(response.body);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred",
      },
      meta: { requestId: expect.any(String) },
    });
    expect(serializedBody).not.toContain(internalSecret);
    expect(serializedBody.toLowerCase()).not.toContain("stack");
    expect(errorSpy).toHaveBeenCalledWith(
      "[Orbit backend] unhandled exception",
      expect.objectContaining({ requestId: safeRequestId, method: "GET" }),
    );
    errorSpy.mockRestore();
  });

  it("reports process liveness with CORS and security headers", async () => {
    app = await createApp();

    const response = await request(app.getHttpServer())
      .get("/health/live")
      .set("Origin", trustedOrigin)
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: { status: "ok" },
      meta: { requestId: expect.any(String) },
    });
    expect(response.headers["access-control-allow-origin"]).toBe(trustedOrigin);
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
    expect(response.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=()");
  });

  it("does not allow an untrusted CORS origin", async () => {
    app = await createApp();

    const response = await request(app.getHttpServer())
      .get("/health/live")
      .set("Origin", "https://attacker.example.com")
      .expect(200);

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("reports readiness when PostgreSQL and Redis are available", async () => {
    app = await createApp();

    const response = await request(app.getHttpServer())
      .get("/health/ready")
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        status: "ready",
        dependencies: { postgres: "up", redis: "up" },
      },
      meta: { requestId: expect.any(String) },
    });
  });

  it("reports readiness failure when Redis is unavailable", async () => {
    const postgresCheck = vi.fn().mockResolvedValue(undefined);
    const redisCheck = vi.fn().mockRejectedValue(new Error("Redis connection refused"));
    app = await createApp({ postgresCheck, redisCheck });

    const response = await request(app.getHttpServer())
      .get("/health/ready")
      .expect(503);

    expect(postgresCheck).toHaveBeenCalledOnce();
    expect(redisCheck).toHaveBeenCalledOnce();
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "A required dependency is unavailable",
      },
      meta: { requestId: expect.any(String) },
    });
  });
});
