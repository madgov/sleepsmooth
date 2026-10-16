import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { COPY } from '../../src/content/copy';
import { RecordingView } from '../../src/ui/RecordingView';

/** Dev-only visual preview of the recording screen with simulated input. It records nothing and is not reachable in release builds. */
export default function RecordingPreview() {
  const router = useRouter();
  const levels = useSharedValue<number[]>(Array.from({ length: 24 }, (_, i) => 0.2 + 0.6 * Math.abs(Math.sin(i * 0.7))));
  const [endAt] = useState(() => Date.now() + 3600_000);
  const [sec, setSec] = useState(7 * 3600 + 12 * 60 + 5);
  useEffect(() => {
    const id = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  if (!__DEV__) return <Redirect href="/" />;
  return <RecordingView state="recording" elapsedSec={sec} endAtMs={endAt} levels={levels} band="medium" stale={false} onStop={() => router.back()} onHide={() => router.back()} simulatedLabel={COPY.SIMULATED_INPUT ?? 'Simulated input'} />;
}
