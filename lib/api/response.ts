import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError, InternalServerError, ValidationError } from "@/lib/errors/app-error";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    {
      status: init?.status ?? 200,
      headers: init?.headers,
    },
  );
}

export function created<T>(data: T) {
  return ok(data, { status: 201 });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function errorResponse(error: unknown) {
  const appError =
    error instanceof AppError
      ? error
      : error instanceof ZodError
        ? new ValidationError(error.issues.map((issue) => issue.message).join(", "))
        : error instanceof Error
          ? new InternalServerError(error.message)
          : new InternalServerError();

  return NextResponse.json(
    {
      success: false,
      error: {
        code: appError.code,
        message: appError.message,
      },
    },
    {
      status: appError.statusCode,
    },
  );
}
