import { File, Paths } from 'expo-file-system';

/** Saves the plain-text capture log (no audio) to Documents/capture-spike-log.txt. Returns its URI. */
export function saveLogFile(text: string): string {
  const f = new File(Paths.document, 'capture-spike-log.txt');
  if (!f.exists) f.create();
  f.write(text);
  return f.uri;
}
