import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import { AppError } from "@orbit/backend";

import { ensureRequestId, type RequestWithContext } from "./request-context.middleware";

type HttpResponse = {
  status(statusCode: number): { json(body: unknown): void };
};

const httpErrors: Record<number, { code: string; message: string }> = {
  [HttpStatus.BAD_REQUEST]: {
    code: "INVALID_REQUEST",
    message: "The request is malformed",
  },
  [HttpStatus.UNAUTHORIZED]: {
    code: "UNAUTHENTICATED",
    message: "Authentication required",
  },
  [HttpStatus.FORBIDDEN]: {
    code: "FORBIDDEN",
    message: "You do not have permission to perform this action",
  },
  [HttpStatus.NOT_FOUND]: {
    code: "NOT_FOUND",
    message: "The requested resource was not found",
  },
  [HttpStatus.CONFLICT]: {
    code: "CONFLICT",
    message: "The request conflicts with existing data",
  },
  [HttpStatus.UNPROCESSABLE_ENTITY]: {
    code: "VALIDATION_ERROR",
    message: "The request payload is invalid",
  },
  [HttpStatus.TOO_MANY_REQUESTS]: {
    code: "RATE_LIMITED",
    message: "Too many requests",
  },
  [HttpStatus.SERVICE_UNAVAILABLE]: {
    code: "SERVICE_UNAVAILABLE",
    message: "A required dependency is unavailable",
  },
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithContext>();
    const response = http.getResponse<HttpResponse>();
    const requestId = ensureRequestId(request);
    if (!(exception instanceof AppError) && !(exception instanceof HttpException)) {
      const requestDetails = request as RequestWithContext & { method?: string; url?: string };
      console.error("[Orbit backend] unhandled exception", {
        requestId,
        method: requestDetails.method,
        url: requestDetails.url,
        error: exception instanceof Error ? exception.stack ?? exception.message : String(exception),
      });
    }
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let error: { code: string; message: string; details?: unknown } = {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
    };

    if (exception instanceof AppError) {
      statusCode = exception.statusCode;
      error = exception.toJSON();
    } else if (exception instanceof HttpException) {
      const originalStatus = exception.getStatus();
      statusCode = originalStatus;
      error = httpErrors[originalStatus] ?? error;
    }

    response.status(statusCode).json({
      success: false,
      error,
      meta: { requestId },
    });
  }
}
