import { View } from 'react-native';
import { COVERAGE_LEGEND } from '@core/content/claims';
import { coverageAccessibilityLabel, coverageRuns, durationText, type Coverage, type CoverageKind } from '@core/mobileLogic/coverage';
import { useTheme } from '../theme/useTheme';
import { AppText } from './AppText';
import { clockFromMs } from './ClipPlayerRow';

const BAR_H = 34;

/**
 * The four kinds of time, told apart by colour AND shape so they work without colour vision:
 *   assessable      solid blue, full height
 *   not assessable  amber, half height, sitting on the baseline
 *   not recorded    empty, dashed outline, full height
 *   outside         thin slate line
 * There is no green anywhere, and no kind reads as "all clear".
 */
function useKindStyle() {
  const { colors } = useTheme();
  return (k: CoverageKind) => {
    switch (k) {
      case 'assessable':
        return { height: BAR_H, backgroundColor: colors.tint.sky.fg, borderWidth: 0, borderColor: 'transparent', borderStyle: 'solid' as const };
      case 'not-assessable':
        return { height: BAR_H / 2, backgroundColor: colors.tint.amber.fg, borderWidth: 0, borderColor: 'transparent', borderStyle: 'solid' as const };
      case 'not-recorded':
        return { height: BAR_H, backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.labelSecondary, borderStyle: 'dashed' as const };
      case 'outside':
        return { height: 4, backgroundColor: colors.tint.slate.fg, borderWidth: 0, borderColor: 'transparent', borderStyle: 'solid' as const };
    }
  };
}

export function CoverageTimeline({ coverage, utc, testID }: { coverage: Coverage; utc: boolean; testID?: string }) {
  const style = useKindStyle();
  const runs = coverageRuns(coverage.bins);
  const total = coverage.bins.length || 1;
  const s = coverage.seconds;
  return (
    <View style={{ gap: 12 }} testID={testID}>
      <View accessible accessibilityRole="image" accessibilityLabel={coverageAccessibilityLabel(coverage)} style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: BAR_H }}>
          {runs.map((r, i) => (
            <View key={i} style={[{ flex: r.count / total, borderRadius: 3, borderCurve: 'continuous', marginRight: i === runs.length - 1 ? 0 : 1 }, style(r.kind)]} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <AppText variant="caption1" tone="secondary" tabular>{clockFromMs(coverage.startMs, utc)}</AppText>
          <AppText variant="caption1" tone="secondary" tabular>{clockFromMs(coverage.endMs, utc)}</AppText>
        </View>
      </View>
      <View style={{ gap: 8 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <LegendRow kind="assessable" label={COVERAGE_LEGEND.assessable} value={durationText(s.assessable)} />
        <LegendRow kind="not-assessable" label={COVERAGE_LEGEND.notAssessable} value={durationText(s.notAssessable)} />
        <LegendRow kind="not-recorded" label={COVERAGE_LEGEND.gap} value={durationText(s.notRecorded)} />
        {s.recordedOutside >= 60 || coverage.bins.includes('outside') ? <LegendRow kind="outside" label={COVERAGE_LEGEND.outside} value={durationText(s.recordedOutside)} /> : null}
      </View>
    </View>
  );
}

function LegendRow({ kind, label, value }: { kind: CoverageKind; label: string; value: string }) {
  const style = useKindStyle();
  // Same colour and shape as the bar, scaled to a 14 pt swatch.
  const k = style(kind);
  const h = kind === 'assessable' || kind === 'not-recorded' ? 14 : kind === 'not-assessable' ? 7 : 4;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 22, height: 14, justifyContent: 'flex-end' }}>
        <View style={[k, { height: h, borderRadius: 3, borderCurve: 'continuous' }]} />
      </View>
      <AppText variant="footnote" style={{ flex: 1 }}>{label}</AppText>
      <AppText variant="footnote" tone="secondary" tabular>{value}</AppText>
    </View>
  );
}
