import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import { formatDuration, spokenDuration } from '@core/mobileLogic/index';
import { DISCLAIMER_NOT_DIAGNOSIS } from '@core/content/claims';
import type { NightListItem } from '../data/nightSource';
import { AppText } from './AppText';
import { Chip } from './Chip';
import { GlassCard } from './GlassCard';
import { Ring } from './Ring';
import { SourceBadge } from './SourceBadge';

const hm = (min: number) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
const dateFmt = { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' } as const;

/** Recording quality as a plain fact from the core: how many of the audio signals were usable. Never a grade. */
export function qualityChip(n: NightListItem): { label: string; tone: 'info' | 'missing'; icon: 'waveform' | 'circle.dashed' } {
  if (n.state === 'not-assessed' || n.state === 'not-recorded') return { label: 'Not assessed', tone: 'missing', icon: 'circle.dashed' };
  return { label: `${n.signals.used.length} of ${n.signals.total} signals usable`, tone: 'info', icon: 'waveform' };
}

/**
 * Dashboard hero for one night: a ring for hours recorded against the scheduled window, with the measured facts
 * beside it. There is no score or grade anywhere on this card. Sample nights carry the Sample badge.
 */
export function NightHero({ night, scheduledMin }: { night: NightListItem; scheduledMin: number }) {
  const q = qualityChip(night);
  const share = scheduledMin > 0 ? Math.min(1, night.recordedMinutes / scheduledMin) : 0;
  const dateLabel = new Date(night.dateISO).toLocaleDateString('en-US', dateFmt);
  return (
    <View testID="night-hero" style={{ borderRadius: 30, borderCurve: 'continuous', boxShadow: '0px 18px 40px rgba(10,8,40,0.28)' }}>
      <GlassCard radius={30} padding={0}>
        {/* Angled accent slab behind the content (chrome only). */}
        <View pointerEvents="none" style={{ position: 'absolute', top: -40, right: -90, width: 300, height: 170, transform: [{ rotate: '-18deg' }], borderRadius: 40, borderCurve: 'continuous', overflow: 'hidden', opacity: 0.55 }}>
          <LinearGradient colors={['rgba(52,200,232,0.30)', 'rgba(78,74,242,0.05)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
        </View>
        <View style={{ padding: 22, gap: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <AppText variant="subheadline" tone="secondary" weight="600">
                {night.isSample ? 'Sample night' : 'Last night'}
              </AppText>
              <AppText variant="title3" numberOfLines={1}>
                {dateLabel}
              </AppText>
            </View>
            {night.isSample ? <SourceBadge kind="sample" size="compact" /> : <SourceBadge kind="audio-observation" size="compact" />}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
            <Ring size={136} stroke={13} progress={share} id="heroRing" accessibilityLabel={`Recorded ${spokenDuration(night.recordedMinutes)} of a ${spokenDuration(scheduledMin)} window.`}>
              <View style={{ alignItems: 'center' }}>
                <AppText variant="title2" tabular weight="700" maxFontSizeMultiplier={1.2}>
                  {hm(night.recordedMinutes)}
                </AppText>
                <AppText variant="caption1" tone="secondary" maxFontSizeMultiplier={1.3}>
                  recorded
                </AppText>
              </View>
            </Ring>
            <View style={{ flex: 1, gap: 12 }}>
              <Fact label="Scheduled window" value={formatDuration(scheduledMin)} />
              <Fact label="Window covered" value={`${Math.round(share * 100)}%`} />
            </View>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label={q.label} icon={q.icon} tone={q.tone} />
            <Chip label="Not a diagnosis" icon="info.circle" tone="info" />
          </View>
          <AppText variant="footnote" tone="secondary">
            {DISCLAIMER_NOT_DIAGNOSIS}
          </AppText>
        </View>
      </GlassCard>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`}>
      <AppText variant="caption1" tone="secondary" weight="600" maxFontSizeMultiplier={1.4} style={{ letterSpacing: 0.3 }}>
        {label.toUpperCase()}
      </AppText>
      <AppText variant="headline" tabular maxFontSizeMultiplier={1.4}>
        {value}
      </AppText>
    </View>
  );
}

