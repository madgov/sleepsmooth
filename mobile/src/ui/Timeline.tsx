import { View } from 'react-native';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';
import { epochMinutes, formatClock, spokenDuration } from '@core/mobileLogic/index';
import type { EpochState } from '../data/nightSource';
import { COPY } from '../content/copy';
import { useTheme } from '../theme/useTheme';
import { AppText } from './AppText';

/**
 * Estimated sleep window strip. Three states differ by PATTERN, not colour alone: solid (estimated asleep),
 * hatched (uncertain), outlined (awake or not captured). One accessible element with a computed summary.
 * Static: no scrub in this milestone.
 */
export function Timeline({ epochs, epochMinutesEach, startMin, endMin }: { epochs: readonly EpochState[]; epochMinutesEach: number; startMin: number; endMin: number }) {
  const { colors } = useTheme();
  const cellW = 100 / Math.max(1, epochs.length);
  const totals = epochMinutes(epochs, epochMinutesEach);
  const windowLabel = `${formatClock(startMin)} to ${formatClock(endMin)}`;
  const label = `Estimated sleep window, ${windowLabel}. Estimated asleep ${spokenDuration(totals.asleep ?? 0)}, uncertain ${spokenDuration(totals.uncertain ?? 0)}, awake or not captured ${spokenDuration(totals.awake ?? 0)}. Unvalidated estimate.`;
  const ink = colors.accent;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ gap: 12 }}>
      <Svg width="100%" height={24} viewBox="0 0 100 24" preserveAspectRatio="none">
        <Defs>
          <Pattern id="hatch" width={2.4} height={2.4} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <Line x1={0} y1={0} x2={0} y2={2.4} stroke={ink} strokeWidth={0.9} />
          </Pattern>
        </Defs>
        {epochs.map((e, i) => {
          const x = i * cellW + 0.25;
          const w = cellW - 0.5;
          if (e === 'asleep') return <Rect key={i} x={x} y={0} width={w} height={24} rx={1.2} fill={ink} />;
          if (e === 'uncertain') return <Rect key={i} x={x} y={0} width={w} height={24} rx={1.2} fill="url(#hatch)" stroke={ink} strokeWidth={0.35} />;
          return <Rect key={i} x={x + 0.2} y={0.2} width={w - 0.4} height={23.6} rx={1.2} fill="none" stroke={colors.missing.border} strokeWidth={0.5} />;
        })}
      </Svg>
      <View style={{ gap: 6 }} accessible={false}>
        {(['asleep', 'uncertain', 'awake'] as const).map((k) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Svg width={22} height={12}>
              {k === 'asleep' ? <Rect x={0} y={0} width={22} height={12} rx={3} fill={ink} /> : null}
              {k === 'uncertain' ? (
                <>
                  <Defs>
                    <Pattern id="hatchL" width={4} height={4} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                      <Line x1={0} y1={0} x2={0} y2={4} stroke={ink} strokeWidth={1.4} />
                    </Pattern>
                  </Defs>
                  <Rect x={0.5} y={0.5} width={21} height={11} rx={3} fill="url(#hatchL)" stroke={ink} strokeWidth={1} />
                </>
              ) : null}
              {k === 'awake' ? <Rect x={0.5} y={0.5} width={21} height={11} rx={3} fill="none" stroke={colors.missing.border} strokeWidth={1} /> : null}
            </Svg>
            <AppText variant="footnote" tone="secondary">
              {COPY.N62_LEGEND[k]}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}
