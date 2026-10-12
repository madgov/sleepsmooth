import { View } from 'react-native';
import { MORNING_PREVIEW_LABEL, MORNING_PREVIEW_NOTE, MORNING_PROMPT, morningAutoStoppedLine } from '@core/content/claims';
import { AppText } from './AppText';
import { Icon } from './Icon';

// A React Native drawing of the Live Activity layouts in plugins/withLiveActivity/widget/SleepSmoothLiveActivity.swift,
// for the web preview and Expo Go (where ActivityKit does not exist). It is NOT the real island: iOS draws that. Colours and
// copy mirror the SwiftUI file (accent #34C8E8, surface #1C1B33, island black). Always labelled as a preview, with sample times.
export type IslandPhase = 'listening' | 'morning' | 'autoStopped';

const ACCENT = '#34C8E8';
const SURFACE = '#1C1B33';
const SECONDARY = '#B9BAD0';
const WHITE = '#FFFFFF';

function Btn({ label, prominent }: { label: string; prominent?: boolean }) {
  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={label === 'Stop' ? 'Stop recording' : 'Open SleepSmooth'}
      style={{ minHeight: 44, paddingHorizontal: 18, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: prominent ? ACCENT : 'rgba(52,200,232,0.16)' }}
    >
      <AppText variant="subheadline" weight="600" tone={{ color: prominent ? SURFACE : ACCENT }}>
        {label}
      </AppText>
    </View>
  );
}

const Glyph = ({ phase, size }: { phase: IslandPhase; size: number }) => <Icon name={phase === 'listening' ? 'waveform' : 'sunrise.fill'} size={size} color={ACCENT} weight="semibold" />;

function headline(phase: IslandPhase, time: string): string {
  return phase === 'listening' ? 'Listening tonight' : phase === 'morning' ? MORNING_PROMPT : morningAutoStoppedLine(time);
}

export interface IslandPreviewProps {
  phase: IslandPhase;
  /** Sample time text, for example "7:00 am". */
  time: string;
}

/** Expanded island, compact island, minimal island and Lock Screen card for one phase. */
export function IslandPreview({ phase, time }: IslandPreviewProps) {
  return (
    <View style={{ gap: 14 }} testID={`island-preview-${phase}`}>
      <View style={{ gap: 2 }}>
        <AppText variant="footnote" weight="600" tone="secondary">
          {MORNING_PREVIEW_LABEL}
        </AppText>
        <AppText variant="caption1" tone="secondary">
          {MORNING_PREVIEW_NOTE}
        </AppText>
      </View>

      {/* Expanded */}
      <View style={{ backgroundColor: '#000', borderRadius: 44, borderCurve: 'continuous', paddingHorizontal: 22, paddingTop: 16, paddingBottom: 16, gap: 10 }} accessible accessibilityLabel={`Expanded island. ${headline(phase, time)}`}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Glyph phase={phase} size={18} />
            {phase === 'listening' ? (
              <AppText variant="headline" tone={{ color: WHITE }}>
                Listening tonight
              </AppText>
            ) : null}
          </View>
          <AppText variant="title3" tabular tone={{ color: WHITE }}>
            {phase === 'listening' ? '7:42:10' : time}
          </AppText>
        </View>
        {phase !== 'listening' ? (
          <AppText variant="headline" tone={{ color: WHITE }} numberOfLines={1} adjustsFontSizeToFit>
            {headline(phase, time)}
          </AppText>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {phase === 'listening' ? (
            <AppText variant="subheadline" tone={{ color: SECONDARY }} style={{ flexShrink: 1 }}>
              Estimated window ends 7:00 am
            </AppText>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {phase === 'listening' ? <Btn label="Stop" /> : null}
            {phase === 'morning' ? (
              <>
                <Btn label="Open" />
                <Btn label="Stop" prominent />
              </>
            ) : null}
            {phase === 'autoStopped' ? <Btn label="Open" /> : null}
          </View>
        </View>
      </View>

      {/* Compact and minimal */}
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <View style={{ backgroundColor: '#000', borderRadius: 20, height: 37, width: 190, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }} accessible accessibilityLabel="Compact island">
          <Glyph phase={phase} size={14} />
          <AppText variant="footnote" weight="600" tabular tone={{ color: ACCENT }}>
            {phase === 'listening' ? '7:42' : time}
          </AppText>
        </View>
        <View style={{ backgroundColor: '#000', borderRadius: 19, height: 37, width: 37, alignItems: 'center', justifyContent: 'center' }} accessible accessibilityLabel="Minimal island">
          <Glyph phase={phase} size={14} />
        </View>
      </View>

      {/* Lock Screen */}
      <View style={{ backgroundColor: SURFACE, borderRadius: 22, borderCurve: 'continuous', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }} accessible accessibilityLabel={`Lock Screen. ${headline(phase, time)}`}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(52,200,232,0.16)', alignItems: 'center', justifyContent: 'center' }}>
          <Glyph phase={phase} size={18} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="headline" tone={{ color: WHITE }}>
            {headline(phase, time)}
          </AppText>
          <AppText variant="subheadline" tone={{ color: SECONDARY }}>
            {phase === 'listening' ? 'Estimated window ends 7:00 am' : phase === 'morning' ? 'Still listening. Recorded on this iPhone.' : 'The night is saved on this iPhone.'}
          </AppText>
          {phase === 'morning' ? (
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
              <Btn label="Open" />
              <Btn label="Stop" prominent />
            </View>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <AppText variant="title3" tabular tone={{ color: WHITE }}>
            {phase === 'listening' ? '7:42:10' : time}
          </AppText>
          {phase !== 'morning' ? <Btn label={phase === 'listening' ? 'Stop' : 'Open'} /> : null}
        </View>
      </View>
    </View>
  );
}
