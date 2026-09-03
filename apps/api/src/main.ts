import "reflect-metadata";

import {
  type INestApplication,
  RequestMethod,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { loadServerEnv } from "@orbit/config";

import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/http-exception.filter";
import { RequestContextMiddleware } from "./common/request-context.middleware";
import { SuccessEnvelopeInterceptor } from "./common/success-envelope.interceptor";
import { OrbitValidationPipe } from "./common/validation.pipe";

type ApiConfiguration = {
  appBaseUrl: string;
};

type ApiRequest = {
  cookies?: Record<string, string>;
  headers: { cookie?: string | string[] };
};

type ApiResponse = {
  setHeader(name: string, value: string): void;
};

type Next = () => void;

export function resolveApiPort(
  source: Partial<Pick<NodeJS.ProcessEnv, "API_PORT" | "PORT">> = process.env,
): number {
  return Number(source.API_PORT ?? source.PORT ?? 3101);
}

function parseCookies(request: ApiRequest, _response: ApiResponse, next: Next): void {
  const header = request.headers.cookie;
  const value = Array.isArray(header) ? header.join("; ") : header;
  const cookies: Record<string, string> = {};

  for (const part of value?.split(";") ?? []) {
    const separator = part.indexOf("=");

    if (separator <= 0) {
      continue;
    }

    const name = part.slice(0, separator).trim();
    const rawValue = part.slice(separator + 1).trim();

    if (!name || name === "__proto__" || name === "constructor" || name === "prototype") {
      continue;
    }

    try {
      cookies[name] = decodeURIComponent(rawValue);
    } catch {
      cookies[name] = rawValue;
    }
  }

  request.cookies = cookies;
  next();
}

function setSecurityHeaders(_request: ApiRequest, response: ApiResponse, next: Next): void {
  response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  next();
}

export function configureApi(app: INestApplication, config: ApiConfiguration): void {
  const requestContext = new RequestContextMiddleware();

  app.setGlobalPrefix("api/v1", {
    exclude: [
      { path: "api/v1/auth", method: RequestMethod.ALL },
      { path: "api/v1/auth/{*path}", method: RequestMethod.ALL },
      { path: "health/live", method: RequestMethod.GET },
      { path: "health/ready", method: RequestMethod.GET },
    ],
  });
  app.use(parseCookies);
  app.use(requestContext.use.bind(requestContext));
  app.use(setSecurityHeaders);
  app.enableCors({
    origin: [new URL(config.appBaseUrl).origin],
    credentials: true,
  });
  app.useGlobalInterceptors(new SuccessEnvelopeInterceptor());
  app.useGlobalPipes(new OrbitValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());
}

export async function bootstrap(): Promise<void> {
  const env = loadServerEnv();
  const app = await NestFactory.create(AppModule);

  configureApi(app, env);
  await app.listen(resolveApiPort());
}

if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
  void bootstrap();
}
