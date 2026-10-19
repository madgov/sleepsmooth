import { useEffect, useState } from 'react';
import {
  MODEL_CARD_APP_SIZE,
  MODEL_CARD_AUC_PLAIN,
  MODEL_CARD_INTENDED,
  MODEL_CARD_NOT_FOR,
  MODEL_CARD_NOT_VERIFIED_BATTERY,
  MODEL_CARD_NOT_VERIFIED_DEVICE,
  MODEL_CARD_NO_REAL_PHONE,
  MODEL_CARD_V3_OTHER_LIMITS,
  MODEL_CARD_PER_NIGHT,
  MODEL_CARD_PHONE_QUALITY,
  MODEL_CARD_PRECISION_PLAIN,
  MODEL_CARD_SHIPS_FALLBACK,
  MODEL_CARD_SHIPS_HEADING,
  MODEL_CARD_SHIPS_V3,
  MODEL_CARD_SHIPS_WEB,
  MODEL_CARD_SMALL_TEST,
  MODEL_CARD_SOURCE_LINE,
  MODEL_CARD_SYNTHETIC_HEADING,
  MODEL_CARD_SYNTHETIC_NOTE,
  MODEL_CARD_TITLE,
  MODEL_CARD_V1_TESTED_HEADING,
  MODEL_CARD_V3_LICENSE,
  MODEL_CARD_V3_PRECISION_PLAIN,
  MODEL_CARD_V3_SOURCE_LINE,
  MODEL_CARD_V3_TESTED_HEADING,
  modelCardNowLine,
} from '@core/content/claims';
import { V1_EVALUATION, V3_EVALUATION, V3_SYNTHETIC_NIGHTS, formatRange, formatValue } from '@core/audio/modelCardInfo';
import { AppText } from '../src/ui/AppText';
import { BackBar } from '../src/ui/ScreenHeader';
import { Screen } from '../src/ui/Screen';
import { Disclosure } from '../src/ui/Disclosure';
import { InsetGroup, ListRow } from '../src/ui/InsetGroup';
import { loadYamnetScorer, type FallbackReason } from '../src/capture/yamnetScorer';

// The evaluated numbers are hand-written constants (src/audio/modelCardInfo.ts) for the models this build ships (v3 on iPhone, v1 fallback).
// src/audio/modelCardInfo.test.ts pins them to model/MODEL_CARD.md, model/metrics.json and the synthetic-night results. No metrics file is bundled.

const REASON_TEXT: Record<FallbackReason, string> = {
  web: 'web preview',
  'expo-go': 'Expo Go',
  'native-module-missing': 'the on-phone runtime is not in this build',
  'model-load-failed': 'the YAMNet file did not load',
  'tensor-shape': 'the YAMNet file has unexpected inputs or outputs',
  'self-check-failed': 'the start-up check did not match',
  'head-not-shipped': 'the v3 layer is not marked for shipping',
};

function useActiveModel(): string | null {
  const [line, setLine] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void loadYamnetScorer().then((r) => {
      if (live) setLine(r.scorer ? modelCardNowLine('v3', null) : modelCardNowLine('v1', r.fallbackReason ? REASON_TEXT[r.fallbackReason] : null));
    });
    return () => {
      live = false;
    };
  }, []);
  return line;
}

export default function ModelCard() {
  const now = useActiveModel();
  return (
    <Screen variant="app" top={<BackBar title={MODEL_CARD_TITLE} />} gap={24}>
      <>
        <InsetGroup header="Intended use">
          <ListRow title={MODEL_CARD_INTENDED} />
        </InsetGroup>
        <InsetGroup header="Not for">
          <ListRow title={MODEL_CARD_NOT_FOR} />
        </InsetGroup>
        <InsetGroup header={MODEL_CARD_SHIPS_HEADING} footer={MODEL_CARD_APP_SIZE}>
          <ListRow title={MODEL_CARD_SHIPS_V3} subtitle={`${V3_EVALUATION.version}, on YAMNet float32.`} />
          <ListRow title={MODEL_CARD_SHIPS_FALLBACK} subtitle={V1_EVALUATION.version} />
          <ListRow title={MODEL_CARD_SHIPS_WEB} />
          <ListRow title={MODEL_CARD_PER_NIGHT} />
          {now ? <ListRow title={now} /> : null}
        </InsetGroup>
        <InsetGroup header="Not verified yet">
          <ListRow title={MODEL_CARD_NOT_VERIFIED_DEVICE} />
          <ListRow title={MODEL_CARD_NOT_VERIFIED_BATTERY} />
        </InsetGroup>
        <InsetGroup header={MODEL_CARD_V3_TESTED_HEADING} footer={MODEL_CARD_V3_SOURCE_LINE}>
          {V3_EVALUATION.metrics.map((m) => (
            <ListRow key={m.label} title={m.label} subtitle={`95% range ${formatRange(m)}`} value={formatValue(m)} />
          ))}
          <ListRow title={MODEL_CARD_AUC_PLAIN} />
          <ListRow title={MODEL_CARD_V3_PRECISION_PLAIN} />
        </InsetGroup>
        <InsetGroup header={MODEL_CARD_SYNTHETIC_HEADING} footer={MODEL_CARD_SYNTHETIC_NOTE}>
          {V3_SYNTHETIC_NIGHTS.metrics.map((m) => (
            <ListRow key={m.label} title={m.label} value={formatValue(m)} />
          ))}
        </InsetGroup>
        <InsetGroup header="Known limits">
          <ListRow title={MODEL_CARD_NO_REAL_PHONE} />
          <ListRow title={MODEL_CARD_V3_OTHER_LIMITS} />
        </InsetGroup>
        <InsetGroup header={MODEL_CARD_V1_TESTED_HEADING}>
          <Disclosure title={`${V1_EVALUATION.heading}: test numbers`}>
            <AppText variant="footnote" tone="secondary">
              {`${V1_EVALUATION.version}. Test: ${V1_EVALUATION.testSet}. ${MODEL_CARD_SOURCE_LINE}`}
            </AppText>
            {V1_EVALUATION.metrics.map((m) => (
              <AppText key={m.label} variant="subheadline" tone="secondary">
                {`${m.label}: ${formatValue(m)} (95% range ${formatRange(m)})`}
              </AppText>
            ))}
            <AppText variant="footnote" tone="secondary">
              {MODEL_CARD_PRECISION_PLAIN}
            </AppText>
            <AppText variant="footnote" tone="secondary">
              {MODEL_CARD_SMALL_TEST}
            </AppText>
            <AppText variant="footnote" tone="secondary">
              {MODEL_CARD_PHONE_QUALITY}
            </AppText>
          </Disclosure>
        </InsetGroup>
        <AppText variant="footnote" tone="secondary" style={{ paddingHorizontal: 16 }}>
          {MODEL_CARD_V3_LICENSE}
        </AppText>
      </>
    </Screen>
  );
}
