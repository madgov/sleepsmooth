import {
  MODEL_CARD_AUC_PLAIN,
  MODEL_CARD_INTENDED,
  MODEL_CARD_LICENSE,
  MODEL_CARD_NOT_FOR,
  MODEL_CARD_NO_REAL_PHONE,
  MODEL_CARD_OTHER_LIMITS,
  MODEL_CARD_PHONE_QUALITY,
  MODEL_CARD_PRECISION_PLAIN,
  MODEL_CARD_RUNNING_LINE,
  MODEL_CARD_SMALL_TEST,
  MODEL_CARD_SOURCE_LINE,
  MODEL_CARD_TITLE,
  MODEL_CARD_V3_HEADING,
  MODEL_CARD_V3_SMALL,
  MODEL_CARD_V3_STATUS,
} from '@core/content/claims';
import { V1_EVALUATION, V3_OFFLINE_EVALUATION, formatRange, formatValue } from '@core/audio/modelCardInfo';
import { AppText } from '../src/ui/AppText';
import { BackBar } from '../src/ui/ScreenHeader';
import { Screen } from '../src/ui/Screen';
import { Disclosure } from '../src/ui/Disclosure';
import { InsetGroup, ListRow } from '../src/ui/InsetGroup';

// The evaluated numbers are hand-written constants (src/audio/modelCardInfo.ts) for the model this build runs (v1).
// src/audio/modelCardInfo.test.ts pins them to model/MODEL_CARD.md and model/metrics.json. No metrics file is bundled.
export default function ModelCard() {
  return (
    <Screen variant="app" top={<BackBar title={MODEL_CARD_TITLE} />} gap={24}>
      <>
        <InsetGroup header="Intended use">
          <ListRow title={MODEL_CARD_INTENDED} />
        </InsetGroup>
        <InsetGroup header="Not for">
          <ListRow title={MODEL_CARD_NOT_FOR} />
        </InsetGroup>
        <InsetGroup header={`How it was tested: ${V1_EVALUATION.heading}`} footer={MODEL_CARD_SOURCE_LINE}>
          <ListRow title={MODEL_CARD_RUNNING_LINE} subtitle={`${V1_EVALUATION.version}. Test: ${V1_EVALUATION.testSet}.`} />
          {V1_EVALUATION.metrics.map((m) => (
            <ListRow key={m.label} title={m.label} subtitle={`95% range ${formatRange(m)}`} value={formatValue(m)} />
          ))}
          <ListRow title={MODEL_CARD_AUC_PLAIN} />
          <ListRow title={MODEL_CARD_PRECISION_PLAIN} />
        </InsetGroup>
        <InsetGroup header="Known limits">
          <ListRow title={MODEL_CARD_SMALL_TEST} />
          <ListRow title={MODEL_CARD_NO_REAL_PHONE} />
          <ListRow title={MODEL_CARD_PHONE_QUALITY} />
          <ListRow title={MODEL_CARD_OTHER_LIMITS} />
        </InsetGroup>
        <InsetGroup header={MODEL_CARD_V3_HEADING}>
          <Disclosure title="Offline numbers for v3 (not in this app)">
            <AppText variant="subheadline">{MODEL_CARD_V3_STATUS}</AppText>
            {V3_OFFLINE_EVALUATION.metrics.map((m) => (
              <AppText key={m.label} variant="subheadline" tone="secondary">
                {`${m.label}: ${formatValue(m)} (95% range ${formatRange(m)})`}
              </AppText>
            ))}
            <AppText variant="footnote" tone="secondary">
              {MODEL_CARD_V3_SMALL}
            </AppText>
          </Disclosure>
        </InsetGroup>
        <AppText variant="footnote" tone="secondary" style={{ paddingHorizontal: 16 }}>
          {MODEL_CARD_LICENSE}
        </AppText>
      </>
    </Screen>
  );
}
