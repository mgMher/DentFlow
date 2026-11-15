import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { errorBody } from 'src/common/utils';

/** `YYYY-MM` in a route. */
@Injectable()
export class MonthPipe implements PipeTransform<string, string> {
    transform(value: string): string {
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value ?? '')) throw new BadRequestException(errorBody('invalidMonth', 'Month must be YYYY-MM'));
        return value;
    }
}
