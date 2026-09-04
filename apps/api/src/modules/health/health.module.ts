import { createConnection, type Socket } from "node:net";
import { connect as connectTls, type TLSSocket } from "node:tls";

import { Module } from "@nestjs/common";
import { loadServerEnv } from "@orbit/config";
import { database } from "@orbit/database";

import {
  HealthController,
  POSTGRES_HEALTH_CHECK,
  REDIS_HEALTH_CHECK,
  type HealthCheck,
} from "./health.controller";

export {
  POSTGRES_HEALTH_CHECK,
  REDIS_HEALTH_CHECK,
  type HealthCheck,
} from "./health.controller";

function pingRedis(redisUrl: string): Promise<void> {
  const url = new URL(redisUrl);

  if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
    return Promise.reject(new Error("Unsupported Redis URL protocol"));
  }

  return new Promise((resolve, reject) => {
    const port = Number(url.port || (url.protocol === "rediss:" ? 6380 : 6379));
    const socket: Socket | TLSSocket = url.protocol === "rediss:"
      ? connectTls({ host: url.hostname, port, servername: url.hostname })
      : createConnection({ host: url.hostname, port });
    const connectedEvent = url.protocol === "rediss:" ? "secureConnect" : "connect";
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();
      error ? reject(error) : resolve();
    };

    socket.setTimeout(1_000, () => finish(new Error("Redis health check timed out")));
    socket.once("error", finish);
    socket.once(connectedEvent, () => socket.write("*1\r\n$4\r\nPING\r\n"));
    socket.on("data", (data) => {
      const response = data.toString("utf8");
      finish(response.startsWith("+PONG") ? undefined : new Error("Redis PING failed"));
    });
  });
}

const postgresHealthCheck: HealthCheck = async () => {
  await database.$queryRawUnsafe("SELECT 1");
};

@Module({
  controllers: [HealthController],
  providers: [
    { provide: POSTGRES_HEALTH_CHECK, useValue: postgresHealthCheck },
    {
      provide: REDIS_HEALTH_CHECK,
      useFactory: (): HealthCheck => {
        const { redisUrl } = loadServerEnv();
        return () => pingRedis(redisUrl);
      },
    },
  ],
})
export class HealthModule {}
