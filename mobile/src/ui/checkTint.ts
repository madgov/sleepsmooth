import type { CheckId } from '../state/checks';
import type { TintName } from '../theme/tokens';

/** One tint per check, shared by the Checks list and the check detail header so the same check always looks the same. */
export const CHECK_TINT: Record<CheckId, TintName> = { snore: 'teal', nosas: 'violet', symptoms: 'sky', warning: 'rose' };
