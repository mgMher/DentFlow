import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Error as MongooseError } from 'mongoose';

interface ErrorResult {
    status: number;
    message: string | string[];
    code?: string;
    /** Extra values the client needs to build the message, e.g. `{ minutes: 12 }`. */
    params?: Record<string, string | number | boolean>;
}

/** Keys of an exception body that are not message parameters. */
const RESERVED_KEYS = new Set(['statusCode', 'message', 'code', 'error', 'path', 'timestamp']);

/** Fallback codes so even a bare `throw new ForbiddenException()` can be translated. */
const CODE_BY_STATUS: Partial<Record<number, string>> = {
    [HttpStatus.UNAUTHORIZED]: 'unauthorized',
    [HttpStatus.FORBIDDEN]: 'forbidden',
    [HttpStatus.NOT_FOUND]: 'notFound',
    [HttpStatus.PAYLOAD_TOO_LARGE]: 'payloadTooLarge',
    [HttpStatus.TOO_MANY_REQUESTS]: 'tooManyRequests',
    [HttpStatus.INTERNAL_SERVER_ERROR]: 'serverError',
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(GlobalExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const result = this.fromHttpException(exception) ?? this.fromDatabaseError(exception);

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message: string | string[] = 'Internal server error';
        let code: string | undefined;
        let params: ErrorResult['params'];

        if (result) {
            ({ status, message, code, params } = result);
        } else {
            // Unexpected failure: log it in full, never leak internals to the client.
            const err = exception instanceof Error ? exception : new Error(String(exception));
            this.logger.error(`${request.method} ${request.url} — ${err.message}`, err.stack);
        }

        // ValidationPipe reports an array of messages.
        if (Array.isArray(message)) {
            message = message.join(', ');
        }

        code ??= CODE_BY_STATUS[status];

        response.status(status).json({
            statusCode: status,
            message,
            ...(code ? { code } : {}),
            ...params,
            path: request.url,
            timestamp: new Date().toISOString(),
        });
    }

    private fromHttpException(exception: unknown): ErrorResult | null {
        if (!(exception instanceof HttpException)) return null;

        const status = exception.getStatus();
        const body = exception.getResponse();

        if (typeof body === 'string') {
            return { status, message: body };
        }

        const payload = body as Record<string, unknown>;
        const params: ErrorResult['params'] = {};
        for (const [key, value] of Object.entries(payload)) {
            if (!RESERVED_KEYS.has(key) && ['string', 'number', 'boolean'].includes(typeof value)) {
                params[key] = value as string | number | boolean;
            }
        }
        return {
            status,
            message: (payload.message as string | string[]) ?? exception.message,
            // Services attach a stable `code` next to the message so the
            // client can translate it. It must survive this filter.
            code: typeof payload.code === 'string' ? payload.code : undefined,
            params,
        };
    }

    /**
     * Errors the database layer raises for bad input. Without this they all
     * surfaced as a 500 "Internal server error", which reads as an outage to
     * the user and hides a client mistake from the developer.
     */
    private fromDatabaseError(exception: unknown): ErrorResult | null {
        if (exception instanceof MongooseError.ValidationError) {
            const fields = Object.keys(exception.errors);
            return {
                status: HttpStatus.BAD_REQUEST,
                message: `Invalid value for: ${fields.join(', ')}`,
                code: 'validationFailed',
            };
        }

        if (exception instanceof MongooseError.CastError) {
            return {
                status: HttpStatus.BAD_REQUEST,
                message: `Invalid value for ${exception.path}`,
                code: exception.kind === 'ObjectId' ? 'invalidId' : 'validationFailed',
            };
        }

        // Optimistic concurrency: the document changed between read and save.
        if (exception instanceof MongooseError.VersionError) {
            return {
                status: HttpStatus.CONFLICT,
                message: 'This record was changed by someone else. Reload and try again.',
                code: 'recordChanged',
            };
        }

        // `new Types.ObjectId('not-an-id')` in a service.
        if (exception instanceof Error && exception.name === 'BSONError') {
            return { status: HttpStatus.BAD_REQUEST, message: 'Invalid id', code: 'invalidId' };
        }

        // Unique index violation (E11000) — usually a race past a "does it exist?" check.
        const mongo = exception as { name?: string; code?: number; keyValue?: Record<string, unknown> };
        if (mongo?.name === 'MongoServerError' && mongo.code === 11000) {
            const fields = Object.keys(mongo.keyValue ?? {}).filter((f) => f !== 'clinicId');
            return {
                status: HttpStatus.CONFLICT,
                message: `A record with this ${fields.join(', ') || 'value'} already exists`,
                code: 'duplicateValue',
            };
        }

        return null;
    }
}
