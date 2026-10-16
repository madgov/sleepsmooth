import { beforeEach, describe, expect, it, vi } from 'vitest';

const n = vi.hoisted(() => {
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
  return {
  cancelScheduledNotificationAsync: vi.fn().mockResolvedValue(undefined),
  cancelAllScheduledNotificationsAsync: vi.fn().mockResolvedValue(undefined),
  scheduleNotificationAsync: vi.fn().mockResolvedValue('x'),
  SchedulableTriggerInputTypes: { DAILY: 'daily', DATE: 'date' },
  };
});
vi.mock('../../mobile/node_modules/expo-notifications/build/index.js', () => n);
vi.mock('../../mobile/src/content/copy', () => ({ COPY: { REMINDER_TITLE: 't', REMINDER_BODY: 'b' } }));

import { cancelAllReminders, cancelBedtimeReminder, cancelFollowUpReminder } from '../../mobile/src/platform/reminder';

beforeEach(() => vi.clearAllMocks());

describe('reminder cancel helpers cancel only their own identifier', () => {
  it('bedtime cancel does not touch the follow-up', async () => {
    await cancelBedtimeReminder();
    expect(n.cancelScheduledNotificationAsync.mock.calls).toEqual([['sleepsmooth-bedtime-reminder']]);
    expect(n.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
  });
  it('follow-up cancel does not touch bedtime', async () => {
    await cancelFollowUpReminder();
    expect(n.cancelScheduledNotificationAsync.mock.calls).toEqual([['sleepsmooth-followup-reminder']]);
  });
  it('delete-my-data cancels both by id, never all notifications', async () => {
    await cancelAllReminders();
    expect(n.cancelScheduledNotificationAsync.mock.calls.map((c) => c[0]).sort()).toEqual(['sleepsmooth-bedtime-reminder', 'sleepsmooth-followup-reminder']);
    expect(n.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
  });
});
