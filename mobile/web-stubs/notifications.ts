// Web preview stub (dev only). No notifications are ever scheduled in the browser build.
export const SchedulableTriggerInputTypes = { DAILY: 'daily' } as const;
export const setNotificationHandler = () => undefined;
export const useLastNotificationResponse = () => null;
export const getPermissionsAsync = async () => ({ granted: false, canAskAgain: true });
export const requestPermissionsAsync = async () => ({ granted: false });
export const scheduleNotificationAsync = async () => 'web-stub';
export const cancelScheduledNotificationAsync = async () => undefined;
export const cancelAllScheduledNotificationsAsync = async () => undefined;
