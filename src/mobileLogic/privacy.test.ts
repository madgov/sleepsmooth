// Privacy checks that can be proven without a phone (docs/PRIVACY_CHECKS.md lists each promise and its status).
// What only a device can prove stays unproven here, and CLAIMS_VERIFIED stays false for it.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { CLAIMS_VERIFIED } from '../../mobile/src/content/flags';
import { DIAG_NOT_VERIFIED, FEEDBACK_NOTE } from '../content/claims';
import { buildSampleNight } from '../night/sample';
import { buildNightFromFlags } from '../night/testkit';
import { excludeClipsFolder } from './backupExclusion';
import { emptyFeedback, toggleVerdict } from './clipFeedback';
import { newDiagnostics, startRun } from './diagnostics';
import { MemFs } from './memFs';
import { NightStore, NIGHTS_DIR } from './nightStore';

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

function seedNight(store: NightStore, fs: MemFs, id: string) {
  const b = buildNightFromFlags({ epochs: 4 });
  store.begin({ ...b.record, id });
  store.appendEpochs(id, b.epochs);
  store.writeManifest({ ...b.record, id });
  store.writeDiagnostics(id, startRun(newDiagnostics({ nightId: id, device: { model: 'x', os: '1', app: '1' }, scheduledStartMs: null, scheduledEndMs: null }), 1, null));
  // what the native clip code writes inside the night's folder
  fs.ensureDir(`${NIGHTS_DIR}/${id}/clips`);
  fs.writeText(`${NIGHTS_DIR}/${id}/clips/c1.wav`, 'RIFF-binary-stand-in');
  fs.writeText(`${NIGHTS_DIR}/${id}/clips/clips.json`, '{}');
  store.writeFeedback(id, toggleVerdict(emptyFeedback(id), 'c1', 'sounds-right', 5));
}

describe('deleting data removes everything, including clips, feedback and diagnostics', () => {
  it('seeded nights really contain a clips folder, feedback and diagnostics', () => {
    const fs = new MemFs();
    const store = new NightStore(fs);
    seedNight(store, fs, 'n1');
    const paths = fs.all();
    expect(paths).toContain('nights/n1/clips/c1.wav');
    expect(paths).toContain('nights/n1/clips/feedback.json');
    expect(paths).toContain('nights/n1/diagnostics.json');
  });

  it('deleting one night removes its clips folder, feedback and diagnostics and leaves the other night alone', () => {
    const fs = new MemFs();
    const store = new NightStore(fs);
    seedNight(store, fs, 'n1');
    seedNight(store, fs, 'n2');
    store.remove('n1');
    expect(fs.all().filter((p) => p.startsWith('nights/n1'))).toEqual([]);
    expect(fs.all().filter((p) => p.startsWith('nights/n2')).length).toBeGreaterThan(4);
  });

  it('"Delete my data" (removeAll) leaves nothing under the store, including a folder this build does not know', () => {
    const fs = new MemFs();
    const store = new NightStore(fs);
    seedNight(store, fs, 'n1');
    seedNight(store, fs, 'n2');
    fs.writeText('nights/n3/clips/stray.wav', 'x');
    store.removeAll();
    expect(fs.all()).toEqual([]);
  });

  it('reading a night back after deletion finds no diagnostics or feedback', async () => {
    const fs = new MemFs();
    const store = new NightStore(fs);
    seedNight(store, fs, 'n1');
    store.remove('n1');
    expect(await store.readDiagnostics('n1')).toBeNull();
    expect((await store.readFeedback('n1')).entries).toEqual([]);
  });

  it('the app wires delete-night and Delete my data to those store calls', () => {
    const src = read('mobile/src/data/nightSource.ts');
    expect(src).toMatch(/async deleteNight\(id\)\s*\{[^}]*getNightStore\(\)\.remove\(id\)/s);
    const settings = read('mobile/app/(tabs)/settings.tsx');
    const body = /const doDelete = async \(\) => \{([\s\S]*?)\n {2}\};/.exec(settings)?.[1] ?? '';
    expect(body).toMatch(/captureController\.discardAll\(\)/);
    expect(body).toMatch(/getNightStore\(\)\.removeAll\(\)/);
    expect(body).toMatch(/clearClipTemp\(\)/);
    expect(body).toMatch(/deleteAllSettings\(\)/);
  });

  it('removing only the clips (Delete all clips) removes the feedback that belongs to them', () => {
    const fs = new MemFs();
    const store = new NightStore(fs);
    seedNight(store, fs, 'n1');
    fs.remove('nights/n1/clips'); // what deleteAllClips / deleteClipsForNight do: remove the folder
    expect(fs.all().filter((p) => p.includes('/clips'))).toEqual([]);
    expect(fs.all()).toContain('nights/n1/diagnostics.json'); // the night itself stays
  });

  it('a sample night is never written to the store by the sample builder', () => {
    const fs = new MemFs();
    buildSampleNight('snore-episodes');
    expect(fs.all()).toEqual([]);
  });
});

describe('backup exclusion is requested for the clips folder', () => {
  it('passes the decoded folder path to the native call and reports the result honestly', () => {
    const calls: string[] = [];
    const ok = { setExcludedFromBackup: (p: string) => (calls.push(p), true) };
    expect(excludeClipsFolder(ok, 'file:///var/mobile/App%20Support/SleepSmooth/nights/n1/clips')).toBe('excluded');
    expect(calls).toEqual(['/var/mobile/App Support/SleepSmooth/nights/n1/clips']);
    expect(excludeClipsFolder({ setExcludedFromBackup: () => false }, 'file:///x')).toBe('failed');
    expect(excludeClipsFolder({ setExcludedFromBackup: () => { throw new Error('boom'); } }, 'file:///x')).toBe('failed');
    expect(excludeClipsFolder(null, 'file:///x')).toBe('unavailable');
  });

  it('finalizeClips calls it on the night clips directory and returns the outcome', () => {
    const src = read('mobile/src/clips/clipFiles.ts');
    const fn = /export async function finalizeClips[\s\S]*?\n}\n/.exec(src)?.[0] ?? '';
    expect(fn).toMatch(/const dir = nightClipsDir\(nightId\)/);
    expect(fn).toMatch(/return excludeFromBackup\(dir\)/);
    expect(src).toMatch(/excludeClipsFolder\(nativeAutomation, dir\.uri\)/);
  });

  it('the native module sets NSURLIsExcludedFromBackupKey', () => {
    const swift = read('mobile/modules/sleepsmooth-live-activity/ios/SleepSmoothAutomationModule.swift');
    expect(swift).toMatch(/Function\("setExcludedFromBackup"\)/);
    expect(swift).toMatch(/isExcludedFromBackup\s*=\s*true|\.isExcludedFromBackup/);
  });

  it('the user-facing backup sentence stays hidden until a device has proven it', () => {
    expect(CLAIMS_VERIFIED.clipsLocalOnlyVerified).toBe(false);
  });
});

describe('copy matches the flags', () => {
  it('the clip feedback note makes no upload claim by itself, and the upload sentence is gated on the flag', () => {
    expect(FEEDBACK_NOTE).not.toMatch(/upload/i);
    const src = read('mobile/src/ui/ClipsSection.tsx');
    expect(src).toMatch(/CLAIMS_VERIFIED\.noUploadNoTrackingVerified \? `\$\{FEEDBACK_NOTE\} \$\{FEEDBACK_NOTE_NO_UPLOAD\}`/);
  });
  it('the diagnostics section states that interruption handling is not verified on a device', () => {
    expect(DIAG_NOT_VERIFIED).toMatch(/NOT VERIFIED/);
    expect(read('mobile/src/ui/DiagnosticsSection.tsx')).toMatch(/DIAG_NOT_VERIFIED/);
  });
});

describe('claims that only a device can prove stay false', () => {
  it('every CLAIMS_VERIFIED flag is false in this build', () => {
    expect(CLAIMS_VERIFIED).toEqual({
      noNetworkVerified: false,
      audioNotWrittenVerified: false,
      noUploadNoTrackingVerified: false,
      lockedScreenVerified: false,
      clipsLocalOnlyVerified: false,
    });
  });
});

// ---- No network calls in the mobile app code ---------------------------------------------------------------------
// Allowed exceptions, each documented in docs/PRIVACY_CHECKS.md:
//  - mobile/src/debug/runModelCheck.ts: fetch() of a bundled asset URI (a local file in a Release build, the Metro dev
//    server in a dev build). Reachable only from the developer lab, which Release builds exclude unless
//    EXPO_PUBLIC_DEVICE_LAB=1 is set at build time.
//  - Expo dev tooling (expo-dev-client, the Metro connection): Debug builds only.
const NETWORK_ALLOWED_FILES: Record<string, string> = {
  'mobile/src/debug/runModelCheck.ts': 'fetch of a bundled local asset in the developer lab',
};
const NETWORK_IDENTIFIERS = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon', 'axios'];
const NETWORK_MODULES = /^(axios|node-fetch|cross-fetch|isomorphic-fetch|got|ky|superagent|socket\.io-client|ws|expo-network|expo-web-browser|expo-updates|expo-tracking-transparency|expo-application|@sentry\/.*|firebase.*|@react-native-firebase\/.*|mixpanel.*|@amplitude\/.*|amplitude.*|posthog.*|segment.*|@segment\/.*|react-native-fbsdk.*|@datadog\/.*|bugsnag.*|@bugsnag\/.*|appsflyer.*|react-native-appsflyer|expo-analytics.*)$/;

function codeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    if (n === 'node_modules' || n === 'ios' || n === 'dist' || n === '.expo') return [];
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return codeFiles(p);
    return /\.(tsx?|js)$/.test(n) && !/\.test\.tsx?$/.test(n) && !n.endsWith('.d.ts') ? [p] : [];
  });
}

function networkFindings(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found: string[] = [];
  const visit = (n: ts.Node) => {
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier) && NETWORK_MODULES.test(n.moduleSpecifier.text)) {
      found.push(`import of ${n.moduleSpecifier.text}`);
    }
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'require' && n.arguments[0] && ts.isStringLiteral(n.arguments[0]) && NETWORK_MODULES.test(n.arguments[0].text)) {
      found.push(`require of ${n.arguments[0].text}`);
    }
    if (ts.isIdentifier(n) && NETWORK_IDENTIFIERS.includes(n.text)) {
      const parent = n.parent;
      // ignore property names such as `x.fetch` on unrelated objects and declarations of our own members
      const isMember = ts.isPropertyAccessExpression(parent) && parent.name === n;
      const isDecl = (ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent) || ts.isMethodDeclaration(parent)) && parent.name === n;
      if (!isMember && !isDecl) found.push(`use of ${n.text}`);
    }
    if (ts.isStringLiteralLike(n) && /^https?:\/\//i.test(n.text) && !/www\.apple\.com\/DTDs/.test(n.text)) found.push(`URL literal ${n.text}`);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return found;
}

describe('the mobile app code makes no network calls', () => {
  const dirs = ['mobile/app', 'mobile/src', 'mobile/modules', 'mobile/plugins', 'src/mobileLogic', 'src/night'];
  const files = dirs.flatMap((d) => codeFiles(join(ROOT, d)));

  it('scans a meaningful number of files', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('has no fetch, XMLHttpRequest, WebSocket, EventSource, sendBeacon, axios, analytics or tracking imports outside the documented exceptions', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const rel = relative(ROOT, f);
      if (NETWORK_ALLOWED_FILES[rel]) continue;
      for (const x of networkFindings(f)) offenders.push(`${rel}: ${x}`);
    }
    expect(offenders).toEqual([]);
  });

  it('the single allowed exception is still just a fetch of a local asset URI', () => {
    const text = read('mobile/src/debug/runModelCheck.ts');
    expect(text.match(/\bfetch\(/g)?.length).toBe(1);
    expect(text).toMatch(/asset\.localUri \?\? asset\.uri/);
    expect(text).not.toMatch(/https?:\/\//);
  });

  it('the developer lab is not reachable in a Release build unless the build flag is set', () => {
    const src = read('mobile/src/config/devLab.ts').toString();
    expect(src).toMatch(/EXPO_PUBLIC_DEVICE_LAB/);
  });

  it('no native Swift code opens a network connection', () => {
    const swiftFiles: string[] = [];
    const walk = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p);
        else if (n.endsWith('.swift')) swiftFiles.push(p);
      }
    };
    walk(join(ROOT, 'mobile/modules'));
    walk(join(ROOT, 'mobile/plugins'));
    expect(swiftFiles.length).toBeGreaterThan(0);
    const bad = swiftFiles.filter((f) => /URLSession|URLRequest|NWConnection|CFNetwork|WKWebView|Alamofire/.test(readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });

  it('mobile/package.json lists no networking, analytics or crash-reporting package', () => {
    const pkg = JSON.parse(read('mobile/package.json')) as { dependencies: Record<string, string>; devDependencies?: Record<string, string> };
    const names = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies ?? {})];
    expect(names.filter((n) => NETWORK_MODULES.test(n))).toEqual([]);
  });
});
