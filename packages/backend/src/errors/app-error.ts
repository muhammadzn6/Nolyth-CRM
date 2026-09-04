import { ERROR_CODES, type ErrorCode } from "./error-codes";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...(this.details === undefined ? {} : { details: this.details }),
    };
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, ERROR_CODES.UNAUTHENTICATED);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super(message, 403, ERROR_CODES.FORBIDDEN);
  }
}

export class ValidationError extends AppError {
  constructor(message = "The request payload is invalid", details?: unknown) {
    super(message, 422, ERROR_CODES.VALIDATION_ERROR, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "The requested resource was not found") {
    super(message, 404, ERROR_CODES.NOT_FOUND);
  }
}

export class ConflictError extends AppError {
  constructor(message = "The requested operation conflicts with existing data", details?: unknown) {
    super(message, 409, ERROR_CODES.CONFLICT, details);
  }
}

export class StaleVersionError extends AppError {
  constructor(expectedVersion: number, actualVersion: number) {
    super("The resource has changed since it was read", 409, ERROR_CODES.STALE_VERSION, {
      expectedVersion,
      actualVersion,
    });
  }
}

export class SchedulingConflictError extends AppError {
  constructor(message = "The requested schedule conflicts with another event", details?: unknown) {
    super(message, 409, ERROR_CODES.SCHEDULING_CONFLICT, details);
  }
}
