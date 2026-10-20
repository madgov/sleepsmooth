import { View } from 'react-native';
import { HEALTH_DISCONNECT_NOTE, HEALTH_NO_RECORDS, HEALTH_ROW_TITLE, HEALTH_SIDE_NOTE, healthConnectedValue, HEALTH_NOT_CONNECTED, HEALTH_UNAVAILABLE } from '@core/content/claims';
import { healthLine, type HealthNight } from '@core/mobileLogic/healthSleep';
import { formatClock } from '@core/mobileLogic/index';
import type { HealthStatus } from '../health';
import { AppText } from './AppText';
import { Chip } from './Chip';
import { ListRow } from './InsetGroup';
import { IconTile } from './IconTile';
import { Surface } from './Surface';

/** "last read" wording: "today 7:12 am" or a short date. */
export function lastReadText(iso: string | null, nowMs = Date.now()): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const clock = formatClock(d.getHours() * 60 + d.getMinutes());
  const same = new Date(nowMs).toDateString() === d.toDateString();
  return same ? `today ${clock}` : `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${clock}`;
}

export const healthRowValue = (status: HealthStatus, lastReadIso: string | null, nowMs?: number): string =>
  status === 'unavailable' ? HEALTH_UNAVAILABLE : status === 'not-connected' ? HEALTH_NOT_CONNECTED : healthConnectedValue(lastReadText(lastReadIso, nowMs));

/** Settings row. Connect is a row below it; the disconnect explanation is the footer text the parent passes. */
export function HealthRowView({ status, lastReadIso, onConnect, sample }: { status: HealthStatus; lastReadIso: string | null; onConnect: () => void; sample?: boolean }) {
  const value = healthRowValue(status, lastReadIso);
  return (
    <ListRow
      title={HEALTH_ROW_TITLE}
      subtitle={status === 'connected' ? HEALTH_DISCONNECT_NOTE : undefined}
      value={value}
      below={sample ? <Chip label="Sample data" icon="testtube.2" tone="sample" /> : undefined}
      leading={<IconTile name="heart.text.square" size={30} />}
      trailing={status === 'not-connected' ? 'chevron' : undefined}
      onPress={status === 'not-connected' ? onConnect : undefined}
      accessibilityLabel={`${HEALTH_ROW_TITLE}, ${value}${status === 'not-connected' ? ', button' : ''}`}
      testID="row-apple-health"
    />
  );
}

/** Night detail: the Apple Health record next to (never merged with) our own estimate. */
export function HealthLineView({ night, noRecords, sample }: { night: HealthNight | null; noRecords?: boolean; sample?: boolean }) {
  const clock = (ms: number) => {
    const d = new Date(ms);
    return formatClock(d.getHours() * 60 + d.getMinutes());
  };
  return (
    <Surface source={sample ? 'sample' : undefined} testID="health-line">
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Chip label="From Apple Health" icon="heart.text.square" tone="info" />
          {sample ? <Chip label="Sample data" icon="testtube.2" tone="sample" /> : null}
        </View>
        {night ? (
          <AppText variant="body" tabular accessibilityLiveRegion="polite">
            {healthLine(night, clock)}
          </AppText>
        ) : (
          <AppText variant="subheadline" tone="secondary">
            {noRecords ? HEALTH_NO_RECORDS : 'No Apple Health record overlaps this night.'}
          </AppText>
        )}
        <AppText variant="footnote" tone="secondary">
          {HEALTH_SIDE_NOTE}
        </AppText>
      </View>
    </Surface>
  );
}
