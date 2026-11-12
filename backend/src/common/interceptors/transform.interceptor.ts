import { CallHandler, ExecutionContext, Injectable, NestInterceptor, StreamableFile } from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface ApiResponse<T> {
    statusCode: number;
    message: string;
    data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | StreamableFile> {
    intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T> | StreamableFile> {
        return next.handle().pipe(
            // Files (document downloads) go out as they are, not wrapped in JSON.
            map((data) =>
                data instanceof StreamableFile
                    ? data
                    : {
                          statusCode: context.switchToHttp().getResponse().statusCode,
                          message: 'Success',
                          data,
                      },
            ),
        );
    }
}
