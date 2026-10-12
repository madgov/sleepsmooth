import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { runModelCheck, type ModelCheckResult } from '../debug/runModelCheck';
import { Card, colors, Notice, Row } from './ui';

export function ModelCheckScreen() {
  const [res, setRes] = useState<ModelCheckResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      // Let the "Running" state paint before the synchronous DSP loop blocks the JS thread.
      await new Promise<void>((r) => setTimeout(r, 50));
      setRes(await runModelCheck());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- runs the check once on mount
    void run();
  }, [run]);

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Notice>
        Developer check. Runs the shared snore-like model and DSP from the web app on this device. Test audio is the public ESC-50 sample clip (sample data, not a recording of you). Not a diagnosis.
      </Notice>
      <Pressable accessibilityRole="button" onPress={run} disabled={busy} style={[styles.btn, busy && { opacity: 0.5 }]}>
        <Text style={styles.btnText}>{busy ? 'Running...' : 'Run again'}</Text>
      </Pressable>
      {err ? (
        <Card title="Error">
          <Text style={{ color: colors.bad }}>{err}</Text>
        </Card>
      ) : null}
      {res ? (
        <>
          <Card title="Timing on this JS engine">
            <Row k="Engine" v={res.engine} />
            <Row k="Bundle" v={res.isDevBundle ? 'DEV (slower, not representative)' : 'Release'} bad={res.isDevBundle} />
            <Row k="ms per 1 s window (mean)" v={res.msPerWindowMean.toFixed(2)} />
            <Row k="ms per 1 s window (median)" v={res.msPerWindowMedian.toFixed(2)} />
            <Row k="ms per 1 s window (p95)" v={res.msPerWindowP95.toFixed(2)} />
            <Row k="  of which log-mel (mean)" v={res.msLogMelMean.toFixed(2)} />
            <Row k="  of which MLP (mean)" v={res.msMlpMean.toFixed(2)} />
            <Row k="Windows timed" v={String(res.windows)} />
            <Row k="Total" v={`${res.totalMs.toFixed(0)} ms`} />
          </Card>
          <Card title="Correctness">
            <Row k="Model" v={`${res.modelVersion} (${res.modelWeightsHash})`} />
            <Row k="Training-side fixture parity" v={`${res.fixturePass ? 'PASS' : 'FAIL'} (${res.fixtureCount} vectors, max err ${res.fixtureMaxAbsErr.toExponential(1)})`} bad={!res.fixturePass} />
            <Row k="Shared InferenceHook equals direct" v={res.hookMatchesDirect ? 'PASS' : 'FAIL'} bad={!res.hookMatchesDirect} />
            <Row k="loadShippedModel() on Metro" v={res.loadShippedModelReturns === 'null' ? 'null (import.meta.glob is Vite-only)' : 'model'} />
          </Card>
          <Card title="Sample clip result (sample data)">
            <Row k="Clip" v={`${res.clipSeconds.toFixed(1)} s at ${res.clipSampleRate} Hz`} />
            <Row k="Windows scored / too quiet" v={`${res.scoredWindows} / ${res.tooQuietWindows}`} />
            <Row k="Snore-like windows" v={String(res.snoreLikeWindows)} />
            <Row k="Score checksum (for Node comparison)" v={res.scoreChecksum.toFixed(6)} />
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 40 },
  btn: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 12, minHeight: 44 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
