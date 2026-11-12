import { SetMetadata } from '@nestjs/common';

export const NO_AUDIT_KEY = 'audit:skip';
export const AUDIT_VIEW_KEY = 'audit:view';

/** Not logged: personal actions (my notifications), token refresh, or logged by the service itself. */
export const NoAudit = () => SetMetadata(NO_AUDIT_KEY, true);

/** A read that is logged too (e.g. opening a patient's document). */
export const AuditView = () => SetMetadata(AUDIT_VIEW_KEY, true);
