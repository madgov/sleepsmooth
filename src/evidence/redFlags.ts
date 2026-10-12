import { RED_FLAG_NOTE, RED_FLAG_WORDING } from '../content/claims';
import type { RulesInput } from '../types/evidence';

/** Generic wording only until the SOURCES.md red-flag rows are verified. No triage rules. */
export function redFlagsFor(i: RulesInput): string[] {
  return i.redFlagPresent ? [RED_FLAG_WORDING, RED_FLAG_NOTE] : [];
}
