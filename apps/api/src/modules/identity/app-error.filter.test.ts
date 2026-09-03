import type { ArgumentsHost } from "@nestjs/common";
import { AuthenticationError, AuthorizationError } from "@orbit/backend";
import { describe, expect, it } from "vitest";

import { AppErrorFilter } from "./app-error.filter";

function invokeFilter(error: AuthenticationError | AuthorizationError) {
  let statusCode: number | undefined;
  let body: unknown;
  const response = {
    status(code: number) {
      statusCode = code;

      return {
        json(value: unknown) {
          body = value;
        },
      };
    },
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as ArgumentsHost;

  new AppErrorFilter().catch(error, host);

  return { statusCode, body };
}

describe("AppErrorFilter", () => {
  it("returns the authentication status and generic login message", () => {
    expect(invokeFilter(new AuthenticationError("Invalid email or password"))).toEqual({
      statusCode: 401,
      body: { code: "UNAUTHENTICATED", message: "Invalid email or password" },
    });
  });

  it("returns the authorization status and error code", () => {
    expect(invokeFilter(new AuthorizationError())).toEqual({
      statusCode: 403,
      body: {
        code: "FORBIDDEN",
        message: "You do not have permission to perform this action",
      },
    });
  });
});
