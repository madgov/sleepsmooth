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
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
  } catch {
    /* nothing scheduled */
  }
}

// One-shot follow-up note the user sets themselves (next-steps tracker). Generic wording on purpose: nothing health-related on the lock screen.
const FOLLOW_UP_ID = 'sleepsmooth-followup-reminder';

export async function scheduleFollowUpReminder(when: Date, title: string, body: string): Promise<boolean> {
  try {
    await Notifications.cancelScheduledNotificationAsync(FOLLOW_UP_ID).catch(() => undefined);
    await Notifications.scheduleNotificationAsync({
      identifier: FOLLOW_UP_ID,
      content: { title, body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
    });
    return true;
  } catch {
    return false;
  }
}

export async function cancelFollowUpReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(FOLLOW_UP_ID);
  } catch {
    /* nothing scheduled */
  }
}

/** "Delete my data": removes every SleepSmooth reminder, each by its own identifier. */
export async function cancelAllReminders(): Promise<void> {
  await cancelBedtimeReminder();
  await cancelFollowUpReminder();
}
