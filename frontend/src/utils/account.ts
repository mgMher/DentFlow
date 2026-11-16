import { UserProfile } from '../types';

/**
 * F13: who is signed in.
 * - `platform`: a platform admin (no clinic) — the platform console only;
 * - `support`: a platform admin looking into a clinic, read-only;
 * - `clinic`: a clinic's staff.
 */
export type AccountKind = 'platform' | 'support' | 'clinic';

export const accountKind = (user: UserProfile | null | undefined): AccountKind =>
    user?.support ? 'support' : user?.role === 'super_admin' && !user.clinicId ? 'platform' : 'clinic';

export const homeOf = (kind: AccountKind) => (kind === 'platform' ? '/platform' : '/dashboard');
