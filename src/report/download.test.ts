import { describe, expect, it } from 'vitest';
import { DISCLAIMER_NOT_DIAGNOSIS, SUMMARY_PRINT_NOT_DIAGNOSIS, SUMMARY_PRINT_TITLE } from '../content/claims';
import { summaryFileName, summaryTextFile } from './download';
import type { CareSummary } from '../types/report';

const summary: CareSummary = {
  generatedAt: '2026-10-19T08:00:00.000Z',
  userEdited: true,
  sections: [{ id: 'questions', title: 'Questions for my clinician', source: 'user-reported', text: 'my own words' }],
};

describe('web summary text download', () => {
  it('names the file by date only', () => {
    expect(summaryFileName(new Date(2026, 9, 5))).toBe('sleepsmooth-summary-2026-10-05.txt');
    expect(summaryFileName(new Date(2026, 9, 5))).toMatch(/^sleepsmooth-summary-\d{4}-\d{2}-\d{2}\.txt$/);
  });
  it('has the disclaimer header, edited sections and extra labels', () => {
    const t = summaryTextFile(summary, ['Sample audio label']);
    expect(t.startsWith(SUMMARY_PRINT_TITLE)).toBe(true);
    expect(t).toContain(SUMMARY_PRINT_NOT_DIAGNOSIS);
    expect(t).toContain('Sample audio label');
    expect(t).toContain('QUESTIONS FOR MY CLINICIAN\nmy own words');
    expect(t.trimEnd().endsWith(DISCLAIMER_NOT_DIAGNOSIS)).toBe(true);
  });
});
