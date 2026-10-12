// FROZEN CONTRACT (ER-4). Do not edit without orchestrator approval.
import type { Source } from './evidence';

export interface CareSummarySection {
  id: string;
  title: string;
  source: Source;
  text: string;
  /** Propagated from demo data (Amendment 4). */
  isSynthetic?: boolean;
}

export interface CareSummary {
  sections: CareSummarySection[];
  generatedAt: string;
  userEdited: boolean;
}
