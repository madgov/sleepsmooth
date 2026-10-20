import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { AppFooter, Disclaimer, WearablePanel, ErrorBoundary, Stepper, useFocusHeading } from './components';
import { DELETE_DATA_DONE, SKIP_LINK } from './content/claims';
import { NextSteps } from './pages/NextSteps';
import { Questionnaire } from './pages/Questionnaire';
import { Results } from './pages/Results';
import { Summary } from './pages/Summary';
import { Welcome, useLoadDemoCase } from './pages/Welcome';
import { SessionProvider, useSession } from './state/session';
import { AudioInput } from './pages/AudioInput';

// Code-split: Parity (golden/codec fixtures) and the info views (model JSON) stay out of the main chunk.
const SourcesView = lazy(() => import('./pages/InfoViews').then((m) => ({ default: m.SourcesView })));
const ModelCardView = lazy(() => import('./pages/InfoViews').then((m) => ({ default: m.ModelCardView })));
const Parity = lazy(() => import('./pages/Parity').then((m) => ({ default: m.Parity })));

export const STEPS = ['Welcome', 'Questionnaire', 'Audio', 'Results', 'Summary', 'Next steps'] as const;

type View = 'flow' | 'sources' | 'model-card';
const viewFromHash = (): View => {
  const h = typeof location === 'undefined' ? '' : location.hash;
  return h === '#/sources' ? 'sources' : h === '#/model-card' ? 'model-card' : 'flow';
};

function Shell() {
  const [step, setStep] = useState(0);
  const [view, setView] = useState<View>(viewFromHash);
  const [notice, setNotice] = useState('');
  const [epoch, setEpoch] = useState(0); // bumps on delete so focus returns to the heading even when the step does not change
  const s = useSession();
  const loadDemo = useLoadDemoCase();
  const main = useRef<HTMLElement>(null);
  const go = (n: number) => setStep(Math.max(0, Math.min(STEPS.length - 1, n)));

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Focus moves to the page heading when the step or the information view changes.
  useFocusHeading(main, `${view}:${step}:${epoch}`);
  useEffect(() => {
    document.title = view === 'flow' ? `${STEPS[step]} | SleepSmooth` : `${view === 'sources' ? 'Sources' : 'Model card'} | SleepSmooth`;
  }, [step, view]);

  const deleteAll = () => {
    s.deleteMyData();
    setNotice(DELETE_DATA_DONE);
    setStep(0);
    setEpoch((n) => n + 1);
    if (location.hash) location.hash = '';
    setView('flow');
  };
  const advance = (n: number) => {
    setNotice('');
    go(n);
  };

  return (
    <>
      <a href="#main" className="skip-link no-print" onClick={(e) => {
        e.preventDefault();
        main.current?.focus();
      }}>
        {SKIP_LINK}
      </a>
      <div className="no-print">
        <Disclaimer variant="banner" />
      </div>
      <main className="container" id="main" tabIndex={-1} ref={main}>
        <h1 className="app-title no-print">SleepSmooth</h1>
        {/* Kept mounted (hidden) while an info view is open so in-page progress, e.g. questionnaire stage, is preserved. */}
        <div hidden={view !== 'flow'}>
            <div className="no-print">
              <Stepper steps={STEPS} current={step} />
            </div>
            {notice && (
              <p role="status" className="notice">
                {notice}
              </p>
            )}
            <ErrorBoundary>
              <div key={step} className="step-enter">
              {step === 0 && <Welcome onStart={() => advance(1)} onExample={() => advance(3)} />}
              {step === 1 && <Questionnaire onBack={() => advance(0)} onDone={() => advance(2)} />}
              {step === 2 && (
                <AudioInput
                  onComplete={(a, meta) => {
                    s.setAudio(a, meta?.sampleLabel ?? null);
                    advance(3);
                  }}
                  onUseLabeledSample={() => {
                    loadDemo();
                    advance(3);
                  }}
                  onSkip={() => advance(3)}
                  onBack={() => advance(1)}
                  onConsent={(r) => s.recordConsent(r.purpose, r.granted)}
                />
              )}
              {step === 2 && <WearablePanel entries={s.wearable} onChange={s.setWearable} />}
              {step === 3 && <Results onBack={() => advance(2)} onNext={() => advance(4)} onEdit={() => advance(1)} />}
              {step === 4 && <Summary onBack={() => advance(3)} onNext={() => advance(5)} />}
              {step === 5 && <NextSteps onBack={() => advance(4)} />}
              </div>
            </ErrorBoundary>
          </div>
        <Suspense fallback={<p role="status">Loading...</p>}>
          {view === 'sources' && <SourcesView />}
          {view === 'model-card' && <ModelCardView />}
        </Suspense>
      </main>
      <AppFooter onDelete={deleteAll} consentHistory={s.consentHistory} />
    </>
  );
}

export function App() {
  // Development builds only: the parity page is unreachable in a production build (import.meta.env.DEV is false there).
  if (import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('parity')) return (
      <Suspense fallback={<p role="status">Loading...</p>}>
        <Parity />
      </Suspense>
    );
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  );
}
