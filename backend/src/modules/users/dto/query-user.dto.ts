import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Role } from 'src/common/decorators';

/** Roles a clinic can actually staff. `super_admin` is platform-level. */
export const STAFF_ROLES = [
    Role.CLINIC_ADMIN,
    Role.DENTIST,
    Role.RECEPTIONIST,
    Role.ASSISTANT,
] as const;

/** Must match DENTIST_SPECIALIZATIONS in frontend/src/types/index.ts. '' means "not set". */
export const DENTIST_SPECIALIZATIONS = [
    'general_dentistry',
    'orthodontics',
    'periodontics',
    'endodontics',
    'prosthodontics',
    'pediatric_dentistry',
    'oral_surgery',
    'cosmetic_dentistry',
] as const;

/** Profile photos are resized in the browser to ~10 KB; this leaves room without inviting megabyte blobs. */
export const MAX_AVATAR_LENGTH = 150_000;
/** A resized photo (data URL) or a link to one. */
export const AVATAR_PATTERN = /^(data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+|https:\/\/\S+)$/;

export const USER_STATUS_FILTERS = ['active', 'inactive', 'all'] as const;
export type UserStatusFilter = (typeof USER_STATUS_FILTERS)[number];

export class QueryUserDto {
    @ApiPropertyOptional({ description: 'Page number', default: 1, minimum: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ description: 'Items per page', default: 20, minimum: 1, maximum: 100 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 20;

    @ApiPropertyOptional({ description: 'Search by name, email, phone or specialization' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ enum: STAFF_ROLES, description: 'Filter by role' })
    @IsOptional()
    @IsIn(STAFF_ROLES as unknown as string[])
    role?: Role;

    @ApiPropertyOptional({
        enum: USER_STATUS_FILTERS,
        default: 'active',
        description: 'Filter by account status',
    })
    @IsOptional()
    @IsIn(USER_STATUS_FILTERS as unknown as string[])
    status?: UserStatusFilter = 'active';
}
