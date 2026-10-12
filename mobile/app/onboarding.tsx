import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { commitDraft, type Draft } from '../src/flow/draft';
import { Stepper } from '../src/flow/Stepper';
import { AboutStep, FinishStep, SleepStep, questionSteps } from '../src/flow/steps';
import type { StepDef } from '../src/flow/Stepper';
import { COPY } from '../src/content/copy';
import { updateSettings } from '../src/state/settings';

export default function Onboarding() {
  const router = useRouter();
  const steps = useMemo<StepDef[]>(
    () => [
      { key: 'about', label: COPY.N17_ABOUT_TITLE, noBack: true, render: (c) => <AboutStep ctx={c} /> },
      ...questionSteps(),
      { key: 'sleep', label: COPY.N12_SLEEP_TITLE, render: (c) => <SleepStep ctx={c} /> },
      { key: 'finish', label: COPY.N23_YOURE_SET, noBack: true, render: (c) => <FinishStep ctx={c} /> },
    ],
    [],
  );
  const finish = (d: Draft) => {
    commitDraft(d);
    updateSettings((p) => ({ ...p, onboardingCompletedAt: new Date().toISOString() }));
    router.replace('/dashboard');
  };
  return <Stepper steps={steps} onFinish={finish} onClose={() => router.back()} />;
}
