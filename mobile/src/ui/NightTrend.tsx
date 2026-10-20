import { View } from 'react-native';
import {
  TREND_FIXED_NOTE,
  TREND_WINDOWS,
  rowAccessibilityLabel,
  trendAccessibilityLabel,
  trendDateLabel,
  trendSentence,
  type TrendRow,
  type TrendWindow,
} from '@core/mobileLogic/nightTrend';
import { useTheme } from '../theme/useTheme';
import { AppText } from './AppText';
import { DisclaimerNote } from './DisclaimerNote';
import { Icon } from './Icon';
import { NeuSegmented } from './NeuSegmented';
import { PressScale } from './Press';
import { SourceBadge } from './SourceBadge';
import { Surface } from './Surface';

/**
 * Last-nights list. It describes what each night showed; it does not compare nights. No arrows, no score, no average.
 * State is text plus a distinct shape (never colour alone). There is no green.
 */
export interface NightTrendProps {
  rows: readonly TrendRow[];
  window: TrendWindow;
  onWindowChange: (w: TrendWindow) => void;
  onOpen: (id: string) => void;
}

function StateGlyph({ row, size }: { row: TrendRow; size: number }) {
  const { colors } = useTheme();
  const solid = row.state.state === 'snore-like-observed';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: solid ? colors.accentFill : 'transparent',
        borderWidth: 1,
        borderColor: row.state.state === 'not-assessed' || row.state.state === 'inconclusive' ? colors.labelTertiary : colors.accent,
        borderStyle: row.state.state === 'not-assessed' ? 'dashed' : 'solid',
      }}
    >
      <Icon name={row.state.icon} size={Math.round(size * 0.62)} color={row.state.state === 'snore-like-observed' || row.state.state === 'few-observations' ? colors.accent : colors.labelSecondary} weight="semibold" />
    </View>
  );
}

function CoverageBar({ share }: { share: number | null }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 3 }}>
      <View style={{ height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.labelTertiary, borderStyle: share === null ? 'dashed' : 'solid' }}>
        {share !== null ? <View style={{ width: `${Math.round(share * 100)}%`, height: '100%', backgroundColor: colors.tint.sky.fg }} /> : null}
      </View>
      <AppText variant="caption1" tone="secondary" tabular maxFontSizeMultiplier={1.6}>
        {share === null ? 'Schedule unknown' : `Recorded ${Math.round(share * 100)}% of scheduled hours`}
      </AppText>
    </View>
  );
}

function TrendRowView({ row, onOpen }: { row: TrendRow; onOpen: (id: string) => void }) {
  const { colors } = useTheme();
  return (
    <PressScale testID={`trend-row-${row.id}`} accessibilityLabel={rowAccessibilityLabel(row)} accessibilityHint="Opens this night" onPress={() => onOpen(row.id)} containerStyle={{ minHeight: 56 }}>
      <View style={{ gap: 6, paddingVertical: 12, minHeight: 56 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <AppText variant="subheadline" weight="600" style={{ flexShrink: 1 }}>
            {trendDateLabel(row.dateISO)}
          </AppText>
          {row.isSample ? <SourceBadge kind="sample" size="compact" /> : null}
          <View style={{ flex: 1 }} />
          <AppText variant="caption1" weight="600" tone="secondary" maxFontSizeMultiplier={1.6}>
            {`Model ${row.model}`}
          </AppText>
          <Icon name="chevron.right" size={13} color={colors.labelTertiary} weight="semibold" />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <StateGlyph row={row} size={20} />
          <AppText variant="subheadline" style={{ flex: 1 }}>
            {row.state.label}
          </AppText>
        </View>
        <CoverageBar share={row.recordedShare} />
      </View>
    </PressScale>
  );
}

export function NightTrend({ rows, window: win, onWindowChange, onOpen }: NightTrendProps) {
  const { colors } = useTheme();
  const chrono = [...rows].reverse();
  return (
    <Surface radius="xl" padding={16} testID="night-trend">
      <View style={{ gap: 12 }}>
        <View style={{ gap: 10 }}>
          <AppText variant="headline" accessibilityRole="header">
            Recent nights
          </AppText>
          <NeuSegmented
            testID="trend-window"
            accessibilityLabel="How many nights to show"
            values={TREND_WINDOWS.map((w) => `Last ${w}`)}
            selectedIndex={TREND_WINDOWS.indexOf(win)}
            onChange={(i) => onWindowChange(TREND_WINDOWS[i] ?? 7)}
          />
        </View>

        <AppText variant="body" testID="trend-sentence">
          {trendSentence(rows, win)}
        </AppText>

        {rows.length > 0 ? (
          <View style={{ gap: 4 }}>
            <View accessible accessibilityRole="image" accessibilityLabel={trendAccessibilityLabel(rows, win)} testID="trend-strip" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {chrono.map((r) => (
                <StateGlyph key={r.id} row={r} size={18} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <AppText variant="caption1" tone="secondary">
                Oldest
              </AppText>
              <AppText variant="caption1" tone="secondary">
                Newest
              </AppText>
            </View>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4 }}>
              {(['snore-like-observed', 'few-observations', 'not-assessed', 'inconclusive'] as const).map((k) => {
                const sample = rows.find((r) => r.state.state === k);
                return sample ? (
                  <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <StateGlyph row={sample} size={16} />
                    <AppText variant="caption1" tone="secondary">
                      {sample.state.label}
                    </AppText>
                  </View>
                ) : null;
              })}
            </View>
          </View>
        ) : null}

        <View>
          {rows.map((r, i) => (
            <View key={r.id} style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.separatorOpaque }}>
              <TrendRowView row={r} onOpen={onOpen} />
            </View>
          ))}
        </View>

        <DisclaimerNote testID="trend-note">{TREND_FIXED_NOTE}</DisclaimerNote>
      </View>
    </Surface>
  );
}
