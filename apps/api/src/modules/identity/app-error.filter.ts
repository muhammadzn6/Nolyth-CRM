import { Catch, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
import { AppError } from "@orbit/backend";

type HttpResponse = {
  status(statusCode: number): { json(body: unknown): void };
};

@Catch(AppError)
export class AppErrorFilter implements ExceptionFilter {
  catch(exception: AppError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponse>();

    response.status(exception.statusCode).json(exception.toJSON());
  }
}
