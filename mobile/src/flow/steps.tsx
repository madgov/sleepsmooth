import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import {
  NOSAS_QUESTIONS,
  NOSAS_SCREENING_NOT_DIAGNOSIS,
  RED_FLAG_NOTE,
  RED_FLAG_QUESTION,
  SYMPTOM_NOT_VALIDATED,
} from '@core/content/claims';
import { formatClock, formatDuration, minutesInBed } from '@core/mobileLogic/index';
import { FREQUENCIES, FREQUENCY_LABELS, SYMPTOM_ITEMS } from '@core/questionnaire/symptomChecklist';
import type { SymptomFrequency } from '@core/types/questionnaire';
import { COPY } from '../content/copy';
import { updateSettings, useSettings } from '../state/settings';
import { AppText } from '../ui/AppText';
import { GlassCard } from '../ui/GlassCard';
import { Icon, type SymbolName } from '../ui/Icon';
import { IconTile } from '../ui/IconTile';
import { NeuSegmented } from '../ui/NeuSegmented';
import { TimeWheel } from '../ui/TimeWheel';
import { positive, type Draft } from './draft';
import { BigNumberField, ChoiceCard, FooterActions, StepFrame } from './parts';
import type { StepCtx, StepDef } from './Stepper';

// ---- Small shared pieces -------------------------------------------------------------------------------------------

/** Picking a choice answers the question and moves on after a beat, so the selection spring is seen. */
function useAutoAdvance(next: () => void) {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (t.current) clearTimeout(t.current); }, []);
  return () => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(next, 260);
  };
}

function Hero({ icon }: { icon: SymbolName }) {
  return (
    <View style={{ alignItems: 'flex-start', paddingTop: 6 }}>
      <IconTile name={icon} size={64} />
    </View>
  );
}

function UnitsControl({ ctx }: { ctx: StepCtx }) {
  return (
    <NeuSegmented
      accessibilityLabel={NOSAS_QUESTIONS.units}
      values={[COPY.C.metric, COPY.C.imperial]}
      selectedIndex={ctx.draft.units === 'metric' ? 0 : 1}
      onChange={(i) => {
        void Haptics.selectionAsync();
        ctx.set({ units: i === 0 ? 'metric' : 'imperial' });
      }}
    />
  );
}

// ---- Questionnaire steps (NoSAS wording verbatim from the core) ------------------------------------------------------

function NumberQuestion({ ctx, title, field, unit, icon, subtitle }: { ctx: StepCtx; title: string; field: 'height' | 'weight' | 'neck' | 'age'; unit: string; icon: SymbolName; subtitle?: string }) {
  const v = ctx.draft[field];
  const [touched, setTouched] = useState(false);
  const invalid = touched && v !== '' && !positive(v);
  const dontKnow = field === 'neck';
  return (
    <StepFrame
      title={title}
      subtitle={subtitle}
      hero={<Hero icon={icon} />}
      footer={<FooterActions primary={COPY.C.continue} onPrimary={ctx.next} disabled={dontKnow && ctx.draft.neckUnknown ? false : !positive(v)} />}
    >
      {field === 'height' || field === 'weight' || field === 'neck' ? <UnitsControl ctx={ctx} /> : null}
      {dontKnow && ctx.draft.neckUnknown ? null : (
        <BigNumberField
          label={field === 'neck' ? 'Neck circumference' : title}
          value={v}
          unit={unit}
          invalid={invalid}
          onChange={(t) => {
            setTouched(true);
            ctx.set({ [field]: t } as Partial<Draft>);
          }}
        />
      )}
      {invalid ? (
        <AppText variant="footnote" tone="destructive" accessibilityLiveRegion="polite">
          Enter a number greater than zero.
        </AppText>
      ) : null}
      {dontKnow ? (
        <ChoiceCard
          label={NOSAS_QUESTIONS.neckUnknown}
          icon="questionmark.circle"
          selected={ctx.draft.neckUnknown}
          accessibilityRole="checkbox"
          onPress={() => ctx.set({ neckUnknown: !ctx.draft.neckUnknown, neck: '' })}
        />
      ) : null}
    </StepFrame>
  );
}

function YesNoQuestion({ ctx, title, value, onPick, icons, note, subtitle }: { ctx: StepCtx; title: string; value: boolean | null; onPick: (v: boolean) => void; icons: [SymbolName, SymbolName]; note?: string; subtitle?: string }) {
  const advance = useAutoAdvance(ctx.next);
  return (
    <StepFrame title={title} subtitle={subtitle} hero={<Hero icon={icons[0]} />} footer={<FooterActions primary={COPY.C.continue} onPrimary={ctx.next} disabled={value === null} />}>
      <ChoiceCard label={COPY.C.yes} icon={icons[0]} selected={value === true} onPress={() => { onPick(true); advance(); }} />
      <ChoiceCard label={COPY.C.no} icon={icons[1]} selected={value === false} onPress={() => { onPick(false); advance(); }} />
      {note ? (
        <AppText variant="footnote" tone="secondary">
          {note}
        </AppText>
      ) : null}
    </StepFrame>
  );
}

function SexQuestion({ ctx }: { ctx: StepCtx }) {
  const advance = useAutoAdvance(ctx.next);
  const d = ctx.draft;
  return (
    <StepFrame title={NOSAS_QUESTIONS.sex} hero={<Hero icon="person" />} footer={<FooterActions primary={COPY.C.continue} onPrimary={ctx.next} disabled={d.sex === null} />}>
      <ChoiceCard label={COPY.C.male} icon="person" selected={d.sex === 'male'} onPress={() => { ctx.set({ sex: 'male' }); advance(); }} />
      <ChoiceCard label={COPY.C.female} icon="person" selected={d.sex === 'female'} onPress={() => { ctx.set({ sex: 'female' }); advance(); }} />
      <AppText variant="footnote" tone="secondary">
        {NOSAS_QUESTIONS.sexNote}
      </AppText>
    </StepFrame>
  );
}

function SymptomQuestion({ ctx, itemKey, text, n, of }: { ctx: StepCtx; itemKey: string; text: string; n: number; of: number }) {
  const advance = useAutoAdvance(ctx.next);
  const cur = ctx.draft.symptoms[itemKey];
  return (
    <StepFrame title={text} subtitle={`How often? Symptom ${n} of ${of}. ${SYMPTOM_NOT_VALIDATED}.`} hero={<Hero icon="checklist" />} footer={<FooterActions primary={COPY.C.continue} onPrimary={ctx.next} disabled={!cur} />}>
      {FREQUENCIES.map((f) => (
        <ChoiceCard
          key={f}
          label={FREQUENCY_LABELS[f]}
          selected={cur === f}
          onPress={() => {
            ctx.set({ symptoms: { ...ctx.draft.symptoms, [itemKey]: f as SymptomFrequency } });
            advance();
          }}
          testID={`symptom-${itemKey}-${f}`}
        />
      ))}
    </StepFrame>
  );
}

export function questionSteps(): StepDef[] {
  const steps: StepDef[] = [
    {
      key: 'height',
      label: NOSAS_QUESTIONS.height,
      skippable: true,
      render: (ctx) => <NumberQuestion ctx={ctx} title={NOSAS_QUESTIONS.height} field="height" unit={ctx.draft.units === 'metric' ? 'cm' : 'in'} icon="ruler" />,
    },
    {
      key: 'weight',
      label: NOSAS_QUESTIONS.weight,
      skippable: true,
      render: (ctx) => <NumberQuestion ctx={ctx} title={NOSAS_QUESTIONS.weight} field="weight" unit={ctx.draft.units === 'metric' ? 'kg' : 'lb'} icon="scalemass" />,
    },
    {
      key: 'neck',
      label: 'Neck circumference',
      skippable: true,
      render: (ctx) => <NumberQuestion ctx={ctx} title={NOSAS_QUESTIONS.neck} field="neck" unit={ctx.draft.units === 'metric' ? 'cm' : 'in'} icon="ruler" />,
    },
    {
      key: 'snoring',
      label: NOSAS_QUESTIONS.snoring,
      skippable: true,
      render: (ctx) => <YesNoQuestion ctx={ctx} title={NOSAS_QUESTIONS.snoring} value={ctx.draft.snoring} onPick={(v) => ctx.set({ snoring: v })} icons={['waveform', 'xmark']} />,
    },
    {
      key: 'age',
      label: NOSAS_QUESTIONS.age,
      skippable: true,
      render: (ctx) => <NumberQuestion ctx={ctx} title={NOSAS_QUESTIONS.age} field="age" unit="years" icon="calendar" />,
    },
    { key: 'sex', label: NOSAS_QUESTIONS.sex, skippable: true, render: (ctx) => <SexQuestion ctx={ctx} /> },
  ];
  SYMPTOM_ITEMS.forEach((it, i) => {
    steps.push({
      key: `symptom-${it.key}`,
      label: it.text,
      skippable: true,
      render: (ctx) => <SymptomQuestion ctx={ctx} itemKey={it.key} text={it.text} n={i + 1} of={SYMPTOM_ITEMS.length} />,
    });
  });
  steps.push({
    key: 'redflag',
    label: RED_FLAG_QUESTION,
    skippable: true,
    render: (ctx) => <YesNoQuestion ctx={ctx} title={RED_FLAG_QUESTION} value={ctx.draft.redFlag} onPick={(v) => ctx.set({ redFlag: v })} icons={['exclamationmark.triangle', 'xmark.circle']} note={RED_FLAG_NOTE} />,
  });
  return steps;
}

export function ReviewStep({ ctx, saveLabel }: { ctx: StepCtx; saveLabel: string }) {
  const d = ctx.draft;
  const answeredSymptoms = Object.keys(d.symptoms).length;
  const rows: [string, string][] = [
    ['Height and weight', d.height && d.weight ? 'Answered' : 'Not answered'],
    ['Neck circumference', d.neckUnknown ? 'Unknown' : d.neck ? 'Answered' : 'Not answered'],
    [NOSAS_QUESTIONS.snoring, d.snoring === null ? 'Not answered' : d.snoring ? COPY.C.yes : COPY.C.no],
    ['Age', d.age ? 'Answered' : 'Not answered'],
    [NOSAS_QUESTIONS.sex, d.sex ? 'Answered' : 'Not answered'],
    ['Symptom checklist', answeredSymptoms > 0 ? `${answeredSymptoms} of ${SYMPTOM_ITEMS.length}` : 'Not answered'],
    ['Warning signs', d.redFlag === null ? 'Not answered' : 'Answered'],
  ];
  return (
    <StepFrame title="Review your answers" subtitle={NOSAS_SCREENING_NOT_DIAGNOSIS} hero={<Hero icon="list.clipboard" />} footer={<FooterActions primary={saveLabel} onPrimary={ctx.finish} />}>
      <GlassCard radius={26} padding={4}>
        {rows.map(([k, v]) => (
          <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, minHeight: 48 }} accessible accessibilityLabel={`${k}: ${v}`}>
            <AppText variant="body" style={{ flex: 1 }}>
              {k}
            </AppText>
            <AppText variant="body" tone="secondary">
              {v}
            </AppText>
          </View>
        ))}
      </GlassCard>
      <AppText variant="footnote" tone="secondary">
        Skipped items count as unanswered. Your answers stay on this phone.
      </AppText>
    </StepFrame>
  );
}

// ---- Setup steps -----------------------------------------------------------------------------------------------------

export function AboutStep({ ctx }: { ctx: StepCtx }) {
  return (
    <StepFrame
      title={COPY.N17_ABOUT_TITLE}
      subtitle={COPY.N18_ABOUT_BODY}
      hero={<Hero icon="list.clipboard" />}
      footer={<FooterActions primary={COPY.C.answerNow} onPrimary={ctx.next} secondary={COPY.C.later} onSecondary={() => ctx.goTo('sleep')} />}
    >
      <GlassCard radius={26} padding={16}>
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Icon name="list.clipboard" size={22} color="#34C8E8" />
            <View style={{ flex: 1 }}>
              <AppText variant="headline">NoSAS screening score</AppText>
              <AppText variant="footnote" tone="secondary">
                Height, weight, neck, snoring, age, sex
              </AppText>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Icon name="checklist" size={22} color="#34C8E8" />
            <View style={{ flex: 1 }}>
              <AppText variant="headline">Symptom checklist</AppText>
              <AppText variant="footnote" tone="secondary">
                {SYMPTOM_NOT_VALIDATED}
              </AppText>
            </View>
          </View>
        </View>
      </GlassCard>
      <AppText variant="footnote" tone="secondary">
        {COPY.N19_ABOUT_LOCAL}
      </AppText>
    </StepFrame>
  );
}

export function SleepStep({ ctx }: { ctx: StepCtx }) {
  const s = useSettings();
  const [which, setWhich] = useState<0 | 1>(0);
  const { bedMin, wakeMin } = s.sleep;
  const set = (m: number) => updateSettings((p) => ({ ...p, sleep: { ...p.sleep, [which === 0 ? 'bedMin' : 'wakeMin']: m, userSet: true } }));
  return (
    <StepFrame
      title={COPY.N12_SLEEP_TITLE}
      subtitle={COPY.N13_SLEEP_BODY}
      hero={<Hero icon="clock" />}
      footer={<FooterActions primary={COPY.C.continue} onPrimary={() => { updateSettings((p) => ({ ...p, sleep: { ...p.sleep, userSet: true } })); ctx.next(); }} />}
    >
      <NeuSegmented accessibilityLabel="Which time to set" values={[`Bedtime ${formatClock(bedMin)}`, `Wake ${formatClock(wakeMin)}`]} selectedIndex={which} onChange={(i) => { void Haptics.selectionAsync(); setWhich(i as 0 | 1); }} />
      <GlassCard radius={28} padding={8}>
        <TimeWheel label={which === 0 ? 'Bedtime' : 'Wake time'} minutes={which === 0 ? bedMin : wakeMin} onChange={set} />
      </GlassCard>
      <AppText variant="subheadline" tone="secondary" center>
        {COPY.N14_IN_BED(formatDuration(minutesInBed(bedMin, wakeMin)))}
      </AppText>
    </StepFrame>
  );
}

export function FinishStep({ ctx }: { ctx: StepCtx }) {
  const s = useSettings();
  const rows: { label: string; value: string }[] = [
    { label: 'Sleep hours', value: `${formatClock(s.sleep.bedMin)} to ${formatClock(s.sleep.wakeMin)}` },
    { label: 'Your answers', value: Object.keys(ctx.draft.symptoms).length > 0 || ctx.draft.height || ctx.draft.age || ctx.draft.sex ? COPY.C.added : COPY.C.later },
  ];
  return (
    <StepFrame title={COPY.N23_YOURE_SET} subtitle="Your first night is one tap away. Before the first recording, SleepSmooth explains what the microphone is used for and asks for your OK. Nothing is recorded until you press Start." hero={<Hero icon="moon.stars" />} footer={<FooterActions primary="Go to Dashboard" onPrimary={ctx.finish} />}>
      <GlassCard radius={26} padding={4}>
        {rows.map((r) => (
          <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14, minHeight: 52 }} accessible accessibilityLabel={`${r.label}: ${r.value}`}>
            <AppText variant="body" style={{ flex: 1 }}>
              {r.label}
            </AppText>
            <AppText variant="body" tone="secondary">
              {r.value}
            </AppText>
          </View>
        ))}
      </GlassCard>
      <AppText variant="footnote" tone="secondary">
        SleepSmooth is informational and is not a diagnosis.
      </AppText>
    </StepFrame>
  );
}
