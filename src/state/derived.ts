import { useMemo } from 'react';
import { evaluate } from '../evidence/engine';
import { buildRulesInput } from '../evidence/input';
import type { ReportInput } from '../report/generate';
import { useSession } from './session';

/** Evidence summary and report input derived from the current session. */
export function useDerived() {
  const s = useSession();
  const { answers, symptoms, redFlag, partner, wearable, isSynthetic, audio, audioLabel } = s;
  return useMemo(() => {
    const { input, context } = buildRulesInput({ answers, symptoms, redFlag, isSynthetic }, audio, Boolean(audio && audioLabel));
    const evidence = evaluate(input, context);
    const reportInput = (generatedAt: string): ReportInput => ({
      answers,
      symptoms,
      redFlag,
      partner,
      wearable,
      evidence,
      audio,
      audioSampleLabel: audioLabel,
      isSynthetic: input.isSynthetic,
      generatedAt,
    });
    return { input, evidence, reportInput };
  }, [answers, symptoms, redFlag, partner, wearable, isSynthetic, audio, audioLabel]);
}
