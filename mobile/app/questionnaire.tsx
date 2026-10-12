import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { commitDraft, type Draft } from '../src/flow/draft';
import { Stepper, type StepDef } from '../src/flow/Stepper';
import { questionSteps, ReviewStep } from '../src/flow/steps';

/** Retake flow (modal): the same questions, pre-filled from saved answers, with a review step and an explicit save. */
export default function Questionnaire() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const steps = useMemo<StepDef[]>(() => {
    const q = questionSteps();
    const first = q[0] as StepDef;
    q[0] = { ...first, closeHere: true };
    return [...q, { key: 'review', label: 'Review your answers', render: (c) => <ReviewStep ctx={c} saveLabel="Save answers" /> }];
  }, []);
  const close = () => (router.canGoBack() ? router.back() : router.replace(from === 'checks' ? '/checks' : '/settings'));
  const finish = (d: Draft) => {
    commitDraft(d);
    close();
  };
  return <Stepper steps={steps} onFinish={finish} onClose={close} />;
}
