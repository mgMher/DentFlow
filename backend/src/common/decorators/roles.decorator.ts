import { SetMetadata } from '@nestjs/common';

export enum Role {
    SUPER_ADMIN = 'super_admin',
    CLINIC_ADMIN = 'clinic_admin',
    DENTIST = 'dentist',
    RECEPTIONIST = 'receptionist',
    ASSISTANT = 'assistant',
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
