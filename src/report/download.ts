// Web download of the clinician summary as a plain text file. The text comes from the same generator the iPhone share sheet
// uses (summaryToPlainText), so the edited sections and the not-a-diagnosis header are identical. Nothing is uploaded: the file
// is built in the page and saved by the browser.
import { summaryToPlainText } from '../mobileLogic/summaryText';
import type { CareSummary } from '../types/report';

/** No personal data in the name: just the date the file was made. */
export function summaryFileName(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `sleepsmooth-summary-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.txt`;
}

export function summaryTextFile(summary: CareSummary, extraLabels: readonly string[] = []): string {
  return summaryToPlainText(summary, false, extraLabels);
}

/** Saves text through a Blob and a temporary link. Returns false if the browser cannot do it. */
export function downloadTextFile(name: string, text: string): boolean {
  try {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
