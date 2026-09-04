import { Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { SessionService, type Actor, type SessionRequest } from "@orbit/backend";

export type AuthenticatedRequest = SessionRequest & { actor?: Actor };

@Injectable()
export class IdentityGuard implements CanActivate {
  constructor(@Inject(SessionService) private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.actor = await this.sessions.requireActiveUser(request);
    return true;
  }
}
