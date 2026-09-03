import { describe, expect, it } from "vitest";

import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  SchedulingConflictError,
  StaleVersionError,
  ValidationError,
} from "./app-error";

describe("application errors", () => {
  it("exposes the standard status and code for each error", () => {
    expect(new AuthenticationError()).toMatchObject({ statusCode: 401, code: "UNAUTHENTICATED" });
    expect(new AuthorizationError()).toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
    expect(new ValidationError()).toMatchObject({ statusCode: 422, code: "VALIDATION_ERROR" });
    expect(new NotFoundError()).toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
    expect(new ConflictError()).toMatchObject({ statusCode: 409, code: "CONFLICT" });
    expect(new SchedulingConflictError()).toMatchObject({ statusCode: 409, code: "SCHEDULING_CONFLICT" });
  });

  it("includes expected and actual versions in stale-version details", () => {
    const error = new StaleVersionError(3, 4);

    expect(error.toJSON()).toEqual({
      code: "STALE_VERSION",
      message: "The resource has changed since it was read",
      details: { expectedVersion: 3, actualVersion: 4 },
    });
  });
});
