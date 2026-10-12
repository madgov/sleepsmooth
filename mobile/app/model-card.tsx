import {
  MODEL_CARD_INTENDED,
  MODEL_CARD_LICENSE,
  MODEL_CARD_METRICS_INTRO,
  MODEL_CARD_METRICS_UNAVAILABLE,
  MODEL_CARD_NOT_FOR,
  MODEL_CARD_OTHER_LIMITS,
  MODEL_CARD_PHONE_WEAKNESS,
  MODEL_CARD_TITLE,
} from '@core/content/claims';
import { AppText } from '../src/ui/AppText';
import { BackBar } from '../src/ui/ScreenHeader';
import { Screen } from '../src/ui/Screen';
import { InsetGroup, ListRow } from '../src/ui/InsetGroup';

// Metrics are intentionally not shown here: this build does not bundle the evaluated numbers, so the honest line is
// MODEL_CARD_METRICS_UNAVAILABLE. TODO: render the evaluated ranges from the model card data once they are bundled.
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
        <InsetGroup header="How it was tested">
          <ListRow title={MODEL_CARD_METRICS_INTRO} />
          <ListRow title={MODEL_CARD_METRICS_UNAVAILABLE} />
        </InsetGroup>
        <InsetGroup header="Known limits">
          <ListRow title={MODEL_CARD_PHONE_WEAKNESS} />
          <ListRow title={MODEL_CARD_OTHER_LIMITS} />
        </InsetGroup>
        <AppText variant="footnote" tone="secondary" style={{ paddingHorizontal: 16 }}>
          {MODEL_CARD_LICENSE}
        </AppText>
      </>
    </Screen>
  );
}
