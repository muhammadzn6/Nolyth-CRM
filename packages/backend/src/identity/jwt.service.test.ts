import { describe, expect, it } from "vitest";

import { AuthenticationError, JwtAccessTokenService } from "@orbit/backend";

describe("JwtAccessTokenService", () => {
  it("creates a verifiable access token with an expiry and session binding", () => {
    const service = new JwtAccessTokenService("test-session-secret");

    const token = service.create({ userId: "user-1", sessionId: "session-1" });
    const claims = service.verify(token);

    expect(claims.sub).toBe("user-1");
    expect(claims.sid).toBe("session-1");
    expect(claims.exp).toBeGreaterThan(claims.iat);
    expect(claims.iss).toBe("orbit-api");
    expect(claims.aud).toBe("orbit-web");
  });

  it("rejects a token with a modified signature", () => {
    const service = new JwtAccessTokenService("test-session-secret");
    const token = service.create({ userId: "user-1", sessionId: "session-1" });
    const [header, payload] = token.split(".");

    expect(() => service.verify(`${header}.${payload}.invalid`)).toThrow(AuthenticationError);
  });

  it("rejects expired access tokens", () => {
    const service = new JwtAccessTokenService("test-session-secret", { durationMs: -1 });
    const token = service.create({ userId: "user-1", sessionId: "session-1" });

    expect(() => service.verify(token)).toThrow(AuthenticationError);
  });
});
