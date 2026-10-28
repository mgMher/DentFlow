import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength, registerDecorator, ValidationOptions } from 'class-validator';

/**
 * One password rule for every place a password is set (register, staff
 * create, change, admin reset). Register used to accept 6 characters while
 * the login form required 8, so such an account could not sign in.
 *
 * 72 is bcrypt's limit: anything past 72 bytes is silently ignored.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

export const IsPassword = () =>
    applyDecorators(IsString(), MinLength(PASSWORD_MIN_LENGTH), MaxLength(PASSWORD_MAX_LENGTH));

/** 24-hour `HH:MM`, which is what an `<input type="time">` submits. */
export const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Trims strings; leaves other values for the validators to reject. */
export const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

const isTimeZone = (value: unknown): boolean => {
    if (typeof value !== 'string' || !value) return false;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: value });
        return true;
    } catch {
        return false;
    }
};

/** An IANA timezone the runtime knows, e.g. `Asia/Yerevan`. */
export function IsTimeZone(options?: ValidationOptions) {
    return (object: object, propertyName: string) =>
        registerDecorator({
            name: 'isTimeZone',
            target: object.constructor,
            propertyName,
            options: { message: `${propertyName} must be an IANA timezone such as Asia/Yerevan`, ...options },
            validator: { validate: isTimeZone },
        });
}
