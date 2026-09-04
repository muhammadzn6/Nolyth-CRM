import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import { map, type Observable } from "rxjs";

import { ensureRequestId, type RequestWithContext } from "./request-context.middleware";

@Injectable()
export class SuccessEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithContext>();

    return next.handle().pipe(
      map((data: unknown) => ({
        success: true,
        data: data ?? null,
        meta: { requestId: ensureRequestId(request) },
      })),
    );
  }
}
