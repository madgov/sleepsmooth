import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { captureController } from '../../src/capture/controller';
import { nightSource } from '../../src/data/nightSource';

/** Target of sleepsmooth://night/latest (the Live Activity "Open" fallback). Goes to the newest recorded night, else the Nights tab. */
export default function LatestNight() {
  const [to, setTo] = useState<string | null>(captureController.getSnapshot().nightId ? `/night/${captureController.getSnapshot().nightId}` : null);
  useEffect(() => {
    if (to) return;
    let live = true;
    nightSource
      .listRealNights()
      .then((n) => live && setTo(n[0] ? `/night/${n[0].id}` : '/nights'))
      .catch(() => live && setTo('/nights'));
    return () => {
      live = false;
    };
  }, [to]);
  return to ? <Redirect href={to as never} /> : null;
}
