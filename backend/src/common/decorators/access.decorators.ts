import { SetMetadata } from '@nestjs/common';

/**
 * F13 route kinds, checked by `ClinicGuard`.
 *
 * - `@Platform()`: the platform console. Only platform admins (no clinic), never a clinic's staff.
 * - `@NoClinic()`: any signed-in account, with or without a clinic (own sign-in, password, two-factor).
 * - `@AllowWhenReadOnly()`: a write still allowed when the clinic's subscription has ended
 *   (signing out, settings of your own account, exports, support access).
 * - `@AllowInSupport()`: a write allowed in a read-only support view (signing out, exports).
 */
export const PLATFORM_KEY = 'platformRoute';
export const NO_CLINIC_KEY = 'noClinicRoute';
export const READ_ONLY_ALLOWED_KEY = 'readOnlyAllowed';
export const SUPPORT_ALLOWED_KEY = 'supportAllowed';

export const Platform = () => SetMetadata(PLATFORM_KEY, true);
export const NoClinic = () => SetMetadata(NO_CLINIC_KEY, true);
export const AllowWhenReadOnly = () => SetMetadata(READ_ONLY_ALLOWED_KEY, true);
export const AllowInSupport = () => SetMetadata(SUPPORT_ALLOWED_KEY, true);
