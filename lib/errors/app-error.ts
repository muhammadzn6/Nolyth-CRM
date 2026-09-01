export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "UNAUTHENTICATED");
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super(message, 403, "FORBIDDEN");
    this.name = "AuthorizationError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "The request payload is invalid") {
    super(message, 422, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "The requested resource was not found") {
    super(message, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "The requested operation conflicts with existing data") {
    super(message, 409, "CONFLICT");
    this.name = "ConflictError";
  }
}

export class InternalServerError extends AppError {
  constructor(message = "An unexpected server error occurred") {
    super(message, 500, "INTERNAL_SERVER_ERROR");
    this.name = "InternalServerError";
  }
}
