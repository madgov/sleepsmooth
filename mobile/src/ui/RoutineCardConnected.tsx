import { useSettings } from '../state/settings';
import { applyRoutine, dismissRoutine, findRoutine, routineIdleOffered, routineOffered, useRoutine } from '../routine';
import { RoutineCardView } from './RoutineCard';

/**
 * Dashboard / Settings routine card. Dashboard: only while the hours are still the defaults, the build can read motion
 * history, and "Not now" was not tapped in the last 7 days (or a suggestion is on screen). Settings: always shown.
 */
export function RoutineCard({ where }: { where: 'dashboard' | 'settings' }) {
  const r = useRoutine();
  useSettings(); // re-render when the hours or "Not now" change
  if (where === 'dashboard') {
    const hasResult = r.status !== 'idle';
    const idleOk = routineIdleOffered();
    if (!hasResult && !idleOk) return null;
    if (r.status === 'found' && !routineOffered(r.suggestion)) return null;
  }
  return <RoutineCardView status={r.status} suggestion={r.suggestion} onFind={() => void findRoutine()} onUse={applyRoutine} onNotNow={dismissRoutine} />;
}
