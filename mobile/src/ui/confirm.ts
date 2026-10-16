import { Alert, Platform } from 'react-native';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

/**
 * Two-button confirmation. iOS and Android: the native alert. Web preview: react-native-web's Alert.alert is a silent no-op,
 * so a destructive confirm would never appear and the button would look dead. Fall back to the browser's confirm dialog there.
 */
export function confirmAction({ title, message, confirmLabel, cancelLabel = 'Cancel', destructive, onConfirm, onCancel }: ConfirmOptions): void {
  const w = globalThis as { confirm?: (m?: string) => boolean };
  if (Platform.OS === 'web') {
    const ok = typeof w.confirm === 'function' ? w.confirm(message ? `${title}\n\n${message}` : title) : false;
    if (ok) onConfirm();
    else onCancel?.();
    return;
  }
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel', onPress: onCancel },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
