import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { AuthenticationError } from "../errors/app-error";

export const ACCESS_TOKEN_COOKIE_NAME = "orbit_access";
export const ACCESS_TOKEN_DURATION_MS = 1000 * 60 * 15;

type JwtHeader = { alg: "HS256"; typ: "JWT" };

export type AccessTokenClaims = {
  sub: string;
  sid: string;
  jti: string;
  iat: number;
  exp: number;
  iss: "orbit-api";
  aud: "orbit-web";
};

export class JwtAccessTokenService {
  private readonly signingKey: Buffer;
  private readonly durationMs: number;

  constructor(sessionSecret: string, options: { durationMs?: number; now?: () => number } = {}) {
    this.signingKey = createHmac("sha256", sessionSecret).update("orbit-access-jwt-v1").digest();
    this.durationMs = options.durationMs ?? ACCESS_TOKEN_DURATION_MS;
    this.now = options.now ?? (() => Date.now());
  }

  private readonly now: () => number;

  create(input: { userId: string; sessionId: string }): string {
    const iat = Math.floor(this.now() / 1000);
    const payload: AccessTokenClaims = {
      sub: input.userId,
      sid: input.sessionId,
      jti: randomBytes(16).toString("base64url"),
      iat,
      exp: Math.floor((this.now() + this.durationMs) / 1000),
      iss: "orbit-api",
      aud: "orbit-web",
    };
    const header: JwtHeader = { alg: "HS256", typ: "JWT" };
    const encodedHeader = encodeJson(header);
    const encodedPayload = encodeJson(payload);
    const unsigned = `${encodedHeader}.${encodedPayload}`;
    const signature = createHmac("sha256", this.signingKey).update(unsigned).digest("base64url");

    return `${unsigned}.${signature}`;
  }

  verify(token: string): AccessTokenClaims {
    const [encodedHeader, encodedPayload, encodedSignature, ...rest] = token.split(".");

    if (!encodedHeader || !encodedPayload || !encodedSignature || rest.length) {
      throw new AuthenticationError();
    }

    const expectedSignature = createHmac("sha256", this.signingKey)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest("base64url");

    if (
      encodedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(Buffer.from(encodedSignature), Buffer.from(expectedSignature))
    ) {
      throw new AuthenticationError();
    }

    try {
      const header = decodeJson(encodedHeader) as Partial<JwtHeader>;
      const payload = decodeJson(encodedPayload) as Partial<AccessTokenClaims>;
      const now = Math.floor(this.now() / 1000);

      if (
        header.alg !== "HS256" ||
        header.typ !== "JWT" ||
        typeof payload.sub !== "string" ||
        typeof payload.sid !== "string" ||
        typeof payload.jti !== "string" ||
        typeof payload.iat !== "number" ||
        typeof payload.exp !== "number" ||
        payload.iss !== "orbit-api" ||
        payload.aud !== "orbit-web" ||
        payload.exp <= now ||
        payload.iat > now + 60
      ) {
        throw new AuthenticationError();
      }

      return payload as AccessTokenClaims;
    } catch (error) {
      if (error instanceof AuthenticationError) throw error;
      throw new AuthenticationError();
    }
  }
}

function encodeJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeJson(value: string): unknown {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}
