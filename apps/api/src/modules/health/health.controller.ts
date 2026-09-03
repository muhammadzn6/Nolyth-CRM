import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from "@nestjs/common";

export const POSTGRES_HEALTH_CHECK = Symbol("POSTGRES_HEALTH_CHECK");
export const REDIS_HEALTH_CHECK = Symbol("REDIS_HEALTH_CHECK");

export type HealthCheck = () => Promise<void>;

@Controller("health")
export class HealthController {
  constructor(
    @Inject(POSTGRES_HEALTH_CHECK) private readonly checkPostgres: HealthCheck,
    @Inject(REDIS_HEALTH_CHECK) private readonly checkRedis: HealthCheck,
  ) {}

  @Get("live")
  live() {
    return { status: "ok" };
  }

  @Get("ready")
  async ready() {
    const results = await Promise.allSettled([
      this.checkPostgres(),
      this.checkRedis(),
    ]);

    if (results.some((result) => result.status === "rejected")) {
      throw new ServiceUnavailableException("A required dependency is unavailable");
    }

    return {
      status: "ready",
      dependencies: { postgres: "up", redis: "up" },
    };
  }
}
