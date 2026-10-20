import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { PartnerObservations } from '../questionnaire/partner';
import type { SymptomAnswers } from '../questionnaire/symptomChecklist';
import type { AudioAnalysis } from '../types/audio';
import type { CareSummary } from '../types/report';
import type { AnswerValue } from '../types/questionnaire';
import type { ConsentPurpose } from '../types/consent';
import type { WearableObservation } from '../types/wearable';
import { appendConsent } from '../consent/history';
import { clearAllStorage, deriveConsent, emptySession, loadSession, saveSession, WEB_CONSENT_VERSION, type PersistedSession } from './storage';

export interface SessionApi extends PersistedSession {
  /** In memory only. Never persisted. */
  audio: AudioAnalysis | null;
  /** In memory only. Set when the audio came from the public sample recording (Amendment 4). */
  audioLabel: string | null;
  /** Session-storage consent. Appends a record to the consent history. */
  setConsent(granted: boolean): void;
  /** Any other purpose (for example 'audio-local-analysis'). Appends to the history only when the choice changes. */
  recordConsent(purpose: ConsentPurpose, granted: boolean): void;
  setWearable(list: WearableObservation[]): void;
  setAnswers(a: Record<string, AnswerValue>): void;
  setSymptoms(s: SymptomAnswers): void;
  setRedFlag(v: boolean | null): void;
  setPartner(p: PartnerObservations): void;
  setAudio(a: AudioAnalysis | null, label?: string | null): void;
  setSummary(s: CareSummary | null, editedIds: string[]): void;
  /** Load a complete illustrative case (marked synthetic). */
  loadCase(c: { answers: Record<string, AnswerValue>; symptoms: SymptomAnswers; redFlag: boolean | null; audio: AudioAnalysis | null }): void;
  deleteMyData(): void;
}

const Ctx = createContext<SessionApi | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PersistedSession>(() => loadSession());
  const [audio, setAudioState] = useState<AudioAnalysis | null>(null);
  const [audioLabel, setAudioLabel] = useState<string | null>(null);

  useEffect(() => {
    saveSession(data);
  }, [data]);

  const setAudio = useCallback((a: AudioAnalysis | null, label: string | null = null) => {
    setAudioState(a);
    setAudioLabel(a ? label : null);
  }, []);

  const patch = useCallback((p: Partial<PersistedSession>) => setData((d) => ({ ...d, ...p })), []);

  const recordConsent = useCallback((purpose: ConsentPurpose, granted: boolean) => {
    setData((d) => {
      const consentHistory = appendConsent(d.consentHistory, { purpose, version: WEB_CONSENT_VERSION, granted, at: new Date().toISOString() });
      return consentHistory === d.consentHistory ? d : { ...d, consentHistory, consent: deriveConsent(consentHistory) };
    });
  }, []);

  const api = useMemo<SessionApi>(
    () => ({
      ...data,
      audio,
      audioLabel,
      setConsent: (granted) => recordConsent('session-storage', granted),
      recordConsent,
      setWearable: (wearable) => patch({ wearable }),
      setAnswers: (answers) => patch({ answers }),
      setSymptoms: (symptoms) => patch({ symptoms }),
      setRedFlag: (redFlag) => patch({ redFlag }),
      setPartner: (partner) => patch({ partner }),
      setAudio,
      setSummary: (summary, editedIds) => patch({ summary, editedIds }),
      loadCase: (c) => {
        setData((d) => ({ ...d, answers: c.answers, symptoms: c.symptoms, redFlag: c.redFlag, isSynthetic: true, summary: null, editedIds: [] }));
        setAudioState(c.audio);
        setAudioLabel(null);
      },
      deleteMyData: () => {
        clearAllStorage();
        setData(emptySession());
        setAudioState(null);
        setAudioLabel(null);
      },
    }),
    [data, audio, audioLabel, patch, setAudio, recordConsent],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useSession(): SessionApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession must be used inside SessionProvider');
  return v;
}
