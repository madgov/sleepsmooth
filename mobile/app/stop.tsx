import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useRecordAction } from '../src/hooks/useRecordAction';

/** Target of the Live Activity "Stop" link (sleepsmooth://stop). Shows the recording screen and asks for the normal stop confirmation. */
export default function StopRoute() {
  const router = useRouter();
  const { active, confirmStop } = useRecordAction();
  useEffect(() => {
    router.replace(active ? '/recording' : '/dashboard');
    if (active) {
      const id = setTimeout(confirmStop, 450);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
