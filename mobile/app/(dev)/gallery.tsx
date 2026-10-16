import { Redirect } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { nightSource, type NightAudioState } from '../../src/data/nightSource';
import { useTheme } from '../../src/theme/useTheme';
import { AppText } from '../../src/ui/AppText';
import { NightRow } from '../../src/ui/NightRow';
import { SampleRow } from '../../src/ui/SampleRow';
import { StateCard } from '../../src/ui/StateCard';
import { Surface } from '../../src/ui/Surface';
import { IslandPreview } from '../../src/ui/IslandPreview';
import { RoutineCardView } from '../../src/ui/RoutineCard';
import { HealthLineView, HealthRowView } from '../../src/ui/HealthParts';

// Development gallery. Every card here is SAMPLE data (the core's synthetic night with only the state label changed).
const STATES: NightAudioState[] = ['snore-like-observed', 'few-observations', 'not-assessed', 'model-not-applicable', 'no-model'];
const SOURCES = ['user-reported', 'audio-observation', 'missing', 'sample', 'app-guidance'] as const;

// Development only: in a release build (__DEV__ false) this route redirects home and the gallery is not rendered.
export default function Gallery() {
  if (!__DEV__) return <Redirect href="/" />;
  return <GalleryScreen />;
}

function GalleryScreen() {
  const { colors } = useTheme();
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 20 }}>
      <AppText variant="footnote" tone="secondary">
        Sample data only. Not a recording of anyone.
      </AppText>
      {STATES.map((st) => (
        <View key={st} style={{ gap: 6 }}>
          <AppText variant="caption1" tone="secondary">{st}</AppText>
          <NightRow night={nightSource.getSampleNight(st)} onPress={() => undefined} />
        </View>
      ))}
      <AppText variant="caption1" tone="secondary">Sample: Dynamic Island (listening, morning, auto-stopped)</AppText>
      <IslandPreview phase="listening" time="7:12 am" />
      <IslandPreview phase="morning" time="7:12 am" />
      <IslandPreview phase="autoStopped" time="7:12 am" />
      <AppText variant="caption1" tone="secondary">Sample: routine suggestion</AppText>
      <RoutineCardView status="found" suggestion={{ bedMin: 23 * 60 + 15, wakeMin: 6 * 60 + 50, nights: 5, fromHealth: 0, fromStillness: 5, basis: 'phone-stillness' }} onFind={() => undefined} onUse={() => undefined} onNotNow={() => undefined} sample />
      <RoutineCardView status="idle" suggestion={null} onFind={() => undefined} onUse={() => undefined} onNotNow={() => undefined} />
      <AppText variant="caption1" tone="secondary">Sample: Apple Health row and night line</AppText>
      <HealthRowView status="not-connected" lastReadIso={null} onConnect={() => undefined} sample />
      <HealthRowView status="connected" lastReadIso={new Date().toISOString()} onConnect={() => undefined} sample />
      <HealthLineView night={{ key: 0, startMs: new Date(2026, 0, 1, 23, 20).getTime(), endMs: new Date(2026, 0, 2, 6, 50).getTime(), kind: 'asleep', source: 'Apple Watch' }} sample />
      <SampleRow onPress={() => undefined} />
      {(['discuss', 'info', 'missing', 'sample', 'error'] as const).map((t) => (
        <StateCard key={t} tone={t} icon="info.circle" title={`Tone: ${t}`} body="Calm, non-alarmist copy." animated={false} />
      ))}
      {SOURCES.map((src) => (
        <Surface key={src} source={src}>
          <AppText variant="subheadline">{`Border source: ${src}`}</AppText>
        </Surface>
      ))}
    </ScrollView>
  );
}
