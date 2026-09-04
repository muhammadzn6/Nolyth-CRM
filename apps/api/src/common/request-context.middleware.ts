import { randomUUID } from "node:crypto";

import { Injectable, type NestMiddleware } from "@nestjs/common";

export type RequestWithContext = {
  headers: Record<string, string | string[] | undefined>;
  requestId?: string;
};

type ResponseWithHeaders = {
  setHeader(name: string, value: string): void;
};

const safeRequestIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function incomingRequestId(request: RequestWithContext): string | undefined {
  const value = request.headers["x-request-id"];

  return typeof value === "string" && safeRequestIdPattern.test(value) ? value : undefined;
}

export function ensureRequestId(request: RequestWithContext): string {
  request.requestId ??= incomingRequestId(request) ?? randomUUID();
  return request.requestId;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(request: RequestWithContext, response: ResponseWithHeaders, next: () => void): void {
    response.setHeader("X-Request-Id", ensureRequestId(request));
    next();
  }
}
