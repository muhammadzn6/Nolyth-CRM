import { ZodError } from "zod";

import { AppError, InternalServerError, ValidationError } from "@/lib/errors/app-error";

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new ValidationError(error.issues.map((issue) => issue.message).join(", "));
  }

  if (error instanceof Error) {
    return new InternalServerError(error.message);
  }

  return new InternalServerError();
}
