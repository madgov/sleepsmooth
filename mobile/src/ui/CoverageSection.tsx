import { useMemo } from 'react';
import { View } from 'react-native';
import {
  COVERAGE_DETAILS_HEADING,
  COVERAGE_EXACT_HEADING,
  COVERAGE_HEADING,
  COUNTING_RULE_LINE,
  awakeGuessContextLine,
  snorePausesLine,
  snoreWindowsLine,
  tooQuietLine,
} from '@core/content/claims';
import { assessOutcome, assessOutcomeLine, coverageHeadline, coverageOutsideLine, durationText } from '@core/mobileLogic/coverage';
import { snorePausesForView } from '@core/night';
import { COPY } from '../content/copy';
import { SNORE_PAUSES_SHIPPED } from '../content/flags';
import { devSnorePausesPreview } from '../dev/devParams';
import type { NightListItem } from '../data/nightSource';
import { AppText } from './AppText';
import { CoverageTimeline } from './CoverageTimeline';
import { Disclosure } from './Disclosure';
import { SourceBadge } from './SourceBadge';
import { Surface } from './Surface';

/** The line that separates "nothing snore-like in the assessable time" from "could not assess". null when the state card already says it. */
function outcomeLine(night: NightListItem): string | null {
  if (night.state === 'not-assessed' || night.state === 'not-recorded') return assessOutcomeLine('could-not-assess');
  if (night.state === 'no-model' || night.state === 'model-not-applicable') return null;
  return assessOutcomeLine(assessOutcome(night.coverage));
}

/** Recording duration and coverage: the primary facts of a night. Exact numbers are behind "Details". */
export function CoverageSection({ night }: { night: NightListItem }) {
  const c = night.coverage;
  const outside = coverageOutsideLine(c);
  const outcome = outcomeLine(night);
  const sw = night.snoreWindows;
  // Pauses in snore-like sound: a count in Details only, no rate. Hidden unless shipped; see SNORE_PAUSES_SHIPPED.
  const preview = devSnorePausesPreview();
  const pauses = useMemo(() => {
    if (!SNORE_PAUSES_SHIPPED && preview === null) return 0;
    if (night.state !== 'snore-like-observed' && night.state !== 'few-observations') return 0;
    const real = snorePausesForView(night.view).count;
    return night.isSample && preview !== null ? preview : real;
  }, [night, preview]);
  const inAwakeGuess = night.snoreLikeInAwakeGuess ?? 0;
  return (
    <View style={{ gap: 8 }} testID="coverage-section">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, flexWrap: 'wrap' }}>
        <AppText variant="footnote" tone="secondary" accessibilityRole="header">{COVERAGE_HEADING}</AppText>
        <SourceBadge kind="audio-observation" size="compact" />
        {night.isSample ? <SourceBadge kind="sample" size="compact" /> : null}
      </View>
      <Surface source={night.isSample ? 'sample' : 'audio-observation'} padding={0}>
        <View style={{ padding: 16, gap: 14 }}>
          <AppText variant="title3" testID="coverage-headline">{coverageHeadline(c)}</AppText>
          <CoverageTimeline coverage={c} utc={night.view.summary.isSynthetic} testID="coverage-timeline" />
          {outside ? <AppText variant="footnote" tone="secondary">{outside}</AppText> : null}
          {outcome ? <AppText variant="subheadline" testID="coverage-outcome">{outcome}</AppText> : null}
        </View>
        <Disclosure title={COVERAGE_DETAILS_HEADING}>
          <AppText variant="footnote" tone="secondary" accessibilityRole="header">{COVERAGE_EXACT_HEADING}</AppText>
          <AppText variant="subheadline" tabular>{`Scheduled sleep hours: ${durationText(c.seconds.scheduled)}`}</AppText>
          <AppText variant="subheadline" tabular>{`Recorded in those hours: ${durationText(c.seconds.recordedInWindow)}`}</AppText>
          <AppText variant="subheadline" tabular>{`Not recorded: ${durationText(c.seconds.notRecorded)}`}</AppText>
          {sw ? (
            sw.assessable === 0 ? null : (
              <>
                <AppText variant="subheadline" tabular>{snoreWindowsLine(sw.snoreLike, sw.assessable)}</AppText>
                <AppText variant="subheadline" tabular>{tooQuietLine(sw.tooQuiet)}</AppText>
              </>
            )
          ) : null}
          {night.sensitivity ? <AppText variant="footnote" tone="secondary">{COPY.N64_SENSITIVITY(night.sensitivity.likelyAsleep, night.sensitivity.includingUncertain)}</AppText> : null}
          {pauses > 0 ? <AppText variant="subheadline" testID="snore-pauses-line">{snorePausesLine(pauses)}</AppText> : null}
          {inAwakeGuess > 0 ? <AppText variant="subheadline" tabular testID="awake-windows-line">{awakeGuessContextLine(inAwakeGuess)}</AppText> : null}
          <AppText variant="footnote" tone="secondary">{COUNTING_RULE_LINE}</AppText>
        </Disclosure>
      </Surface>
    </View>
  );
}
