// Local bedtime reminder only. Never a push notification: no remote token is requested and no push entitlement is added.
import * as Notifications from 'expo-notifications';
import { COPY } from '../content/copy';

const REMINDER_ID = 'sleepsmooth-bedtime-reminder';

export async function scheduleBedtimeReminder(bedMin: number): Promise<boolean> {
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => undefined);
    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_ID,
      content: { title: COPY.REMINDER_TITLE, body: COPY.REMINDER_BODY, data: { url: 'sleepsmooth://start' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: Math.floor(bedMin / 60), minute: bedMin % 60 },
    });
    return true;
  } catch {
    return false;
  }
}

export async function cancelBedtimeReminder(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    /* nothing scheduled */
  }
}
