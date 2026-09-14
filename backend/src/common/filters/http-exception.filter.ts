import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(GlobalExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message: string | string[] = 'Internal server error';
        let code: string | undefined;

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const body = exception.getResponse();

            if (typeof body === 'string') {
                message = body;
            } else {
                const payload = body as Record<string, unknown>;
                message = (payload.message as string | string[]) ?? exception.message;
                // Services attach a stable `code` next to the message so the
                // client can translate it. It must survive this filter.
                code = typeof payload.code === 'string' ? payload.code : undefined;
            }
        } else if (exception instanceof Error) {
            // Log unexpected failures in full; never leak internals to the client.
            this.logger.error(
                `${request.method} ${request.url} — ${exception.message}`,
                exception.stack,
            );
        }

        // ValidationPipe reports an array of messages.
        if (Array.isArray(message)) {
            message = message.join(', ');
        }

        response.status(status).json({
            statusCode: status,
            message,
            ...(code ? { code } : {}),
            path: request.url,
            timestamp: new Date().toISOString(),
        });
    }
}
