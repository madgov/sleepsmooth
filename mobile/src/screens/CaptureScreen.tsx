import { useMemo, useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { CaptureSpike, GAP_THRESHOLD_MS, type SessionConfig } from '../capture/captureSpike';
import { checkAppStorage, formatFsReport } from '../capture/fsCheck';
import { saveLogFile } from '../capture/saveLog';
import { Card, colors, Notice, Row } from './ui';

const CATEGORIES: SessionConfig['iosCategory'][] = ['playAndRecord', 'record'];
const MODES: SessionConfig['iosMode'][] = ['measurement', 'default'];

export function CaptureScreen() {
  const spike = useMemo(() => new CaptureSpike(), []);
  const stats = useSyncExternalStore(spike.subscribe, spike.getStats);
  const lineCount = useSyncExternalStore(spike.subscribe, spike.getLineCount);
  const [cat, setCat] = useState<SessionConfig['iosCategory']>('playAndRecord');
  const [mode, setMode] = useState<SessionConfig['iosMode']>('measurement');
  const [fsText, setFsText] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);

  const recording = stats.phase === 'recording' || stats.phase === 'starting';
  const log = showLog ? spike.getLog().split('\n').slice(-60).join('\n') : '';

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Notice>
        Capture spike for engineers. It counts microphone chunks and writes a plain-text log. It never saves audio. iOS shows the orange microphone indicator while it runs. Not a diagnosis.
      </Notice>

      <Card title="Audio session (iOS)">
        <Text style={styles.label}>Category</Text>
        <View style={styles.seg}>
          {CATEGORIES.map((c) => (
            <Pressable key={c} accessibilityRole="button" accessibilityState={{ selected: cat === c }} disabled={recording} onPress={() => setCat(c)} style={[styles.segBtn, cat === c && styles.segOn]}>
              <Text style={[styles.segText, cat === c && styles.segTextOn]}>{c}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Mode</Text>
        <View style={styles.seg}>
          {MODES.map((m) => (
            <Pressable key={m} accessibilityRole="button" accessibilityState={{ selected: mode === m }} disabled={recording} onPress={() => setMode(m)} style={[styles.segBtn, mode === m && styles.segOn]}>
              <Text style={[styles.segText, mode === m && styles.segTextOn]}>{m}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <View style={styles.btnRow}>
        <Pressable accessibilityRole="button" disabled={recording} onPress={() => void spike.start({ iosCategory: cat, iosMode: mode })} style={[styles.btn, recording && { opacity: 0.4 }]}>
          <Text style={styles.btnText}>Start</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={!recording} onPress={() => void spike.stop()} style={[styles.btn, styles.btnStop, !recording && { opacity: 0.4 }]}>
          <Text style={styles.btnText}>Stop</Text>
        </Pressable>
      </View>

      <Card title="Live counters">
        <Row k="State" v={stats.phase} bad={stats.phase === 'error'} />
        <Row k="App state" v={stats.appState} />
        <Row k="PCM chunks received" v={String(stats.chunks)} />
        <Row k="Chunk sample rate (reported)" v={stats.reportedSampleRate ? `${stats.reportedSampleRate} Hz` : 'n/a'} />
        <Row k="Frames in last chunk" v={stats.lastFrames !== null ? String(stats.lastFrames) : 'n/a'} />
        <Row k="Audio seconds / wall seconds" v={`${stats.audioSeconds.toFixed(1)} / ${stats.wallSeconds.toFixed(1)}`} />
        <Row k="Time not in foreground" v={`${stats.backgroundSeconds.toFixed(0)} s (final at Stop)`} />
        <Row k="Level, last chunk" v={stats.lastRmsDb !== null ? `${stats.lastRmsDb.toFixed(1)} dBFS` : 'n/a'} />
        <Row k={`Gaps > ${GAP_THRESHOLD_MS / 1000} s, arrival`} v={`${stats.arrivalGaps} (max ${stats.maxArrivalGapMs.toFixed(0)} ms)`} bad={stats.arrivalGaps > 0} />
        <Row k={`Gaps > ${GAP_THRESHOLD_MS / 1000} s, audio timeline`} v={`${stats.audioGaps} (max ${stats.maxAudioGapMs.toFixed(0)} ms)`} bad={stats.audioGaps > 0} />
        <Row k="Interruptions (began)" v={String(stats.interruptions)} />
        <Row k="All-zero chunks" v={String(stats.digitalSilenceChunks)} />
        {stats.error ? <Text style={{ color: colors.bad, marginTop: 6 }}>{stats.error}</Text> : null}
      </Card>

      <Card title={`Log (${lineCount} lines, text only)`}>
        <View style={styles.btnRow}>
          <Pressable accessibilityRole="button" onPress={() => setShowLog((s) => !s)} style={styles.smallBtn}>
            <Text style={styles.smallBtnText}>{showLog ? 'Hide' : 'Show last 60'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void Share.share({ message: spike.getLog() || '(empty log)', title: 'SleepSmooth capture spike log' })}
            style={styles.smallBtn}
          >
            <Text style={styles.smallBtnText}>Share log</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              try {
                setSaved(saveLogFile(spike.getLog()));
              } catch (e) {
                setSaved(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
              }
            }}
            style={styles.smallBtn}
          >
            <Text style={styles.smallBtnText}>Save to Documents</Text>
          </Pressable>
        </View>
        {saved ? <Text style={styles.mono}>{saved}</Text> : null}
        {showLog ? <Text style={styles.mono}>{log || '(empty)'}</Text> : null}
      </Card>

      <Card title="Storage check (no audio should exist)">
        <Pressable accessibilityRole="button" onPress={() => setFsText(formatFsReport(checkAppStorage()))} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>List Documents and Caches</Text>
        </Pressable>
        {fsText ? <Text style={styles.mono}>{fsText}</Text> : null}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 60 },
  label: { color: colors.sub, fontSize: 13, marginTop: 4, marginBottom: 4 },
  seg: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  segBtn: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingVertical: 10, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  segOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  segText: { color: colors.text, fontSize: 13 },
  segTextOn: { color: '#fff', fontWeight: '700' },
  btnRow: { flexDirection: 'row', gap: 10, marginBottom: 12, flexWrap: 'wrap' },
  btn: { flex: 1, backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 14, alignItems: 'center', minHeight: 48 },
  btnStop: { backgroundColor: colors.bad },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  smallBtn: { borderWidth: 1, borderColor: colors.accent, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' },
  smallBtnText: { color: colors.accent, fontWeight: '600', fontSize: 14 },
  mono: { fontFamily: 'Menlo', fontSize: 11, color: colors.text, marginTop: 8 },
});
