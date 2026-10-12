import type { Conclusion, RulesInput } from '../types/evidence';

export type RuleId = 1 | 2 | 3 | 4;

/** ER-3 rules (`modelNotApplicable` behaves like `noModel`: never matches rule 3, so never reassuring), first match wins. */
export function matchRule(i: RulesInput): { rule: RuleId; conclusion: Conclusion } {
  if (i.noSas === 'notAnswered' && i.symptoms === 'notAnswered') return { rule: 1, conclusion: 'not-enough-information' };
  if (i.redFlagPresent || i.noSas === 'atOrAbove' || i.symptoms === 'high') {
    return { rule: 2, conclusion: 'discuss-with-clinician' };
  }
  if (i.audio === 'usableSnoreLikeObserved') return { rule: 3, conclusion: 'discuss-with-clinician' };
  return { rule: 4, conclusion: 'inconclusive' };
}
