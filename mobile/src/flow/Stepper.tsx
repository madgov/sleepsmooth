import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, KeyboardAvoidingView, Platform, View } from 'react-native';
import Animated, { FadeIn, FadeInLeft, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';
import { AppText } from '../ui/AppText';
import { Backdrop } from '../ui/Backdrop';
import { PressScale } from '../ui/Press';
import { BackButton } from '../ui/ScreenHeader';
import { EASE_OUT } from '../ui/motion';
import { ProgressBar } from './parts';
import { initialDraft, type Draft } from './draft';

export interface StepCtx {
  draft: Draft;
  set: (p: Partial<Draft>) => void;
  next: () => void;
  back: () => void;
  skip: () => void;
  /** Jump to a step by key (used to skip the optional questionnaire block). */
  goTo: (key: string) => void;
  finish: () => void;
}

export interface StepDef {
  key: string;
  /** Show a Skip control in the header. */
  skippable?: boolean;
  /** Hide the Back control (first and final steps). */
  noBack?: boolean;
  /** Close (X) instead of Back on this step (first step of a modal flow). */
  closeHere?: boolean;
  /** Spoken when the step appears. */
  label: string;
  render: (ctx: StepCtx) => ReactNode;
}

/**
 * One question per screen. A progress bar on top, Back on the left, Skip on the right where the rules allow it.
 * The draft lives here; steps read and write it through the context. Steps fade in from the direction of travel.
 */
export function Stepper({ steps, onFinish, onClose }: { steps: StepDef[]; onFinish: (draft: Draft) => void; onClose?: () => void }) {
  const { reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const total = steps.length;
  const step = steps[index] as StepDef;

  const move = useCallback(
    (to: number, d: 1 | -1) => {
      const i = Math.max(0, Math.min(total - 1, to));
      setDir(d);
      setIndex(i);
      const st = steps[i];
      if (st) AccessibilityInfo.announceForAccessibility(`Step ${i + 1} of ${total}, ${st.label}`);
    },
    [steps, total],
  );
  const ctx = useMemo<StepCtx>(
    () => ({
      draft,
      set: (p) => setDraft((x) => ({ ...x, ...p })),
      next: () => move(index + 1, 1),
      back: () => move(index - 1, -1),
      skip: () => move(index + 1, 1),
      goTo: (key) => {
        const i = steps.findIndex((s) => s.key === key);
        if (i >= 0) move(i, 1);
      },
      finish: () => onFinish(draft),
    }),
    [draft, index, move, onFinish, steps],
  );

  const entering = reduceMotion ? FadeIn.duration(180) : (dir === 1 ? FadeInRight : FadeInLeft).duration(320).easing(EASE_OUT);
  return (
    <View style={{ flex: 1 }}>
      <Backdrop variant="app" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64 }}>
          {step.noBack && !step.closeHere ? (
            <View style={{ width: 44, height: 44 }} />
          ) : step.closeHere ? (
            <BackButton icon="xmark" label="Close" onPress={onClose} />
          ) : (
            <BackButton onPress={ctx.back} label="Back" />
          )}
          <View style={{ flex: 1 }}>
            <ProgressBar value={total > 1 ? (index + 1) / total : 1} />
          </View>
          <View style={{ minWidth: 56, alignItems: 'flex-end' }}>
            {step.skippable ? (
              <PressScale onPress={ctx.skip} haptic="none" accessibilityLabel="Skip this question" containerStyle={{ minHeight: 44, justifyContent: 'center' }}>
                <AppText variant="body" tone="accent" weight="600">
                  Skip
                </AppText>
              </PressScale>
            ) : null}
          </View>
        </View>
        <Animated.View key={step.key} entering={entering} style={{ flex: 1 }}>
          {step.render(ctx)}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}
