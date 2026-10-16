#!/usr/bin/env node
// Reproducible release check: `npm run release:check`.
// Runs every gate in order, never stops at the first failure, prints a summary and writes
// docs/releases/<date>-release-check.md with pass/fail per step plus the (unfilled) device test table copied from
// mobile/DEVICE_TEST.md. Exit code 1 if any step failed. Nothing here is a health or accuracy claim: it only says
// whether the build gates passed. Device behaviour is NOT covered (see the Device tests table).
//
// Options:  --skip=a,b   skip steps by id        --only=a,b   run only these ids        --list   print step ids
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MOBILE = join(ROOT, 'mobile');
const argv = process.argv.slice(2);
const opt = (name) => (argv.find((a) => a.startsWith(`--${name}=`)) ?? '').split('=')[1]?.split(',').filter(Boolean) ?? [];
const skip = new Set(opt('skip'));
const only = new Set(opt('only'));

const exportDir = mkdtempSync(join(tmpdir(), 'sleepsmooth-export-'));

/** Each step is { id, title, run }. run() returns { ok, output }. */
const sh = (cmd, args, cwd, timeoutMs = 15 * 60 * 1000) => () => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: timeoutMs, env: { ...process.env, CI: '1', FORCE_COLOR: '0' } });
  const output = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
  return { ok: r.status === 0 && !r.error, output: r.error ? `${output}\n${String(r.error)}` : output };
};

// ---- model bundle check ------------------------------------------------------------------------------------------
function modelBundleCheck() {
  const lines = [];
  let ok = true;
  const fail = (m) => {
    ok = false;
    lines.push(`FAIL ${m}`);
  };
  const pass = (m) => lines.push(`ok   ${m}`);

  // 1. Which model file does the mobile app actually import?
  const sources = [];
  const walk = (dir) => {
    for (const n of readdirSync(dir)) {
      if (n === 'node_modules' || n === 'ios' || n === 'dist' || n.startsWith('.')) continue;
      const p = join(dir, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx|js|mjs)$/.test(n)) sources.push(p);
    }
  };
  for (const d of ['app', 'src', 'modules']) if (existsSync(join(MOBILE, d))) walk(join(MOBILE, d));
  const modelImports = new Map(); // file path under src/audio/model -> importing files
  const metricImports = [];
  for (const f of sources) {
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(/(?:from\s+|require\()\s*['"]([^'"]+\.json)['"]/g)) {
      const spec = m[1];
      // Weight files only. Test fixtures (*.fixture.json) are not shipped models.
      if (/audio\/model\/[^'"]+\.json$/.test(spec) && !/\.fixture\.json$/.test(spec)) {
        const file = spec.replace(/^.*audio\/model\//, 'src/audio/model/');
        modelImports.set(file, [...(modelImports.get(file) ?? []), relative(ROOT, f)]);
      }
      if (/metrics[^/]*\.json$/.test(spec) || /model\/[^'"]*metrics/.test(spec)) metricImports.push({ spec, from: relative(ROOT, f) });
    }
  }
  // The app's capture path is the one that matters. The dev lab (debug) may import the same file.
  const shipped = [...modelImports.entries()].filter(([, from]) => from.some((p) => !p.includes('/debug/')));
  if (shipped.length !== 1) {
    fail(`expected exactly one model file imported by the app (outside the dev lab), found ${shipped.length}: ${shipped.map(([f]) => f).join(', ') || 'none'}`);
    return { ok, output: lines.join('\n') };
  }
  const [modelFile, importers] = shipped[0];
  pass(`mobile imports ${modelFile} (from ${importers.join(', ')})`);
  const labOnly = [...modelImports.entries()].filter(([f]) => f !== modelFile);
  if (labOnly.length) fail(`the app imports more than one model file: ${[...modelImports.keys()].join(', ')}`);

  // 2. Version and hash against the model card.
  const model = JSON.parse(readFileSync(join(ROOT, modelFile), 'utf8'));
  const card = readFileSync(join(ROOT, 'model/MODEL_CARD.md'), 'utf8');
  const cardVersion = /\*\*Version:\*\*\s*`([^`]+)`/.exec(card)?.[1];
  const cardHash = /\*\*Weights hash \(sha256\):\*\*\s*`([0-9a-f]+)\.{0,3}`/.exec(card)?.[1];
  if (!cardVersion || !cardHash) {
    fail('could not read "Version" and "Weights hash" from model/MODEL_CARD.md');
    return { ok, output: lines.join('\n') };
  }
  if (model.version === cardVersion) pass(`version ${model.version} matches the model card`);
  else fail(`app model version "${model.version}" differs from the model card version "${cardVersion}"`);
  if (typeof model.weightsHash === 'string' && model.weightsHash.startsWith(cardHash) && cardHash.length >= 12) pass(`weightsHash ${model.weightsHash.slice(0, 12)}... matches the card prefix ${cardHash}`);
  else fail(`app weightsHash "${String(model.weightsHash).slice(0, 16)}" does not start with the card hash "${cardHash}"`);

  // 3. Metrics shown in the app must refer to that exact version.
  const cardScreen = readFileSync(join(MOBILE, 'app/model-card.tsx'), 'utf8');
  const unavailable = /MODEL_CARD_METRICS_UNAVAILABLE/.test(cardScreen);
  // Hand-written constants (src/audio/modelCardInfo.ts) are allowed when a test pins them to model/MODEL_CARD.md.
  const handWritten = /V1_EVALUATION/.test(cardScreen) && existsSync(join(ROOT, 'src/audio/modelCardInfo.test.ts'));
  if (metricImports.length === 0) {
    if (handWritten) {
      const info = readFileSync(join(ROOT, 'src/audio/modelCardInfo.ts'), 'utf8');
      const v1 = /V1_EVALUATION[^=]*=\s*\{\s*version:\s*'([^']+)'/.exec(info)?.[1];
      if (v1 === model.version) pass(`the model card screen shows hand-written v1 numbers (src/audio/modelCardInfo.ts), pinned to model/MODEL_CARD.md by modelCardInfo.test.ts, for ${v1}`);
      else fail(`the hand-written model-card numbers are for "${String(v1)}", not for the app model "${model.version}"`);
    } else if (unavailable) pass('the app bundles no model metrics; the model card screen says test results are not available in this build');
    else fail('the app bundles no metrics file and the model card screen shows neither pinned numbers nor the "not available" line');
  } else {
    for (const m of metricImports) {
      const name = m.spec.replace(/^.*\//, '');
      const p = [join(ROOT, 'model', name), join(ROOT, 'src/audio/model', name)].find(existsSync);
      if (!p) {
        fail(`${m.from} imports ${m.spec}, which could not be found`);
        continue;
      }
      const j = JSON.parse(readFileSync(p, 'utf8'));
      const v = j.modelVersion ?? j.model?.version ?? j.version;
      if (v === model.version) pass(`${name} refers to ${v}`);
      else fail(`${name} (imported by ${m.from}) refers to "${String(v)}", not to the app model "${model.version}"`);
    }
  }
  return { ok, output: lines.join('\n') };
}

const steps = [
  { id: 'typecheck', title: 'Root typecheck (npm run typecheck)', run: sh('npm', ['run', 'typecheck'], ROOT) },
  { id: 'lint', title: 'Root lint (npm run lint)', run: sh('npm', ['run', 'lint'], ROOT) },
  { id: 'test', title: 'Root tests (npm test)', run: sh('npm', ['test'], ROOT) },
  { id: 'build', title: 'Web build (npm run build)', run: sh('npm', ['run', 'build'], ROOT) },
  { id: 'forbidden-phrases', title: 'Forbidden-phrases test', run: sh('npx', ['vitest', 'run', 'src/content/forbiddenPhrases.test.ts'], ROOT) },
  { id: 'mobile-tsc', title: 'Mobile typecheck (cd mobile && npx tsc --noEmit)', run: sh('npx', ['tsc', '--noEmit'], MOBILE) },
  { id: 'expo-export-ios', title: 'Expo export for iOS (npx expo export --platform ios)', run: sh('npx', ['expo', 'export', '--platform', 'ios', '--output-dir', exportDir], MOBILE) },
  { id: 'expo-install-check', title: 'Expo dependency check (npx expo install --check)', run: sh('npx', ['expo', 'install', '--check'], MOBILE, 5 * 60 * 1000) },
  { id: 'model-bundle', title: 'Model file the app imports matches model/MODEL_CARD.md (version, hash, metrics)', run: modelBundleCheck },
];

if (argv.includes('--list')) {
  for (const s of steps) console.log(`${s.id}\t${s.title}`);
  process.exit(0);
}

const tail = (text, n = 30) => text.split('\n').slice(-n).join('\n');
const results = [];
for (const s of steps) {
  if (skip.has(s.id) || (only.size > 0 && !only.has(s.id))) {
    results.push({ ...s, status: 'SKIPPED', seconds: 0, output: '' });
    console.log(`- SKIPPED ${s.id}`);
    continue;
  }
  process.stdout.write(`- running ${s.id} ... `);
  const t0 = Date.now();
  let r;
  try {
    r = s.run();
  } catch (e) {
    r = { ok: false, output: String(e?.stack ?? e) };
  }
  const seconds = Math.round((Date.now() - t0) / 1000);
  results.push({ ...s, status: r.ok ? 'PASS' : 'FAIL', seconds, output: r.output });
  console.log(`${r.ok ? 'PASS' : 'FAIL'} (${seconds}s)`);
  if (!r.ok) console.log(tail(r.output, 15).replace(/^/gm, '    '));
}
rmSync(exportDir, { recursive: true, force: true });

// ---- report ------------------------------------------------------------------------------------------------------
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const stamp = `${date} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
const git = sh('git', ['rev-parse', '--short', 'HEAD'], ROOT)();
const dirty = sh('git', ['status', '--porcelain'], ROOT)();
const deviceDoc = readFileSync(join(MOBILE, 'DEVICE_TEST.md'), 'utf8');
const table = /<!-- DEVICE-TESTS-TABLE:START -->\n([\s\S]*?)\n<!-- DEVICE-TESTS-TABLE:END -->/.exec(deviceDoc)?.[1] ?? '(the device test table was not found in mobile/DEVICE_TEST.md)';

const failed = results.filter((r) => r.status === 'FAIL');
const md = [
  `# Release check ${date}`,
  '',
  `Run at ${stamp} local time. Commit ${git.ok ? git.output : 'unknown'}${dirty.output ? ' plus uncommitted changes' : ''}. Command: \`npm run release:check\`.`,
  '',
  `**Result: ${failed.length === 0 ? 'all executed steps passed' : `${failed.length} step(s) failed: ${failed.map((f) => f.id).join(', ')}`}.** ${results.some((r) => r.status === 'SKIPPED') ? 'Some steps were skipped (listed below). ' : ''}Passing here means the build gates passed. It says nothing about how the app behaves on a phone: every device claim is NOT VERIFIED until the table at the end is filled in.`,
  '',
  '| Step | Result | Time |',
  '|---|---|---|',
  ...results.map((r) => `| ${r.title} | ${r.status} | ${r.status === 'SKIPPED' ? '-' : `${r.seconds}s`} |`),
  '',
  '## Output (last lines of each step)',
  '',
  ...results.flatMap((r) => [`### ${r.title}: ${r.status}`, '', '```', r.status === 'SKIPPED' ? 'skipped' : tail(r.output, r.id === 'model-bundle' ? 40 : 25) || '(no output)', '```', '']),
  '## Device tests',
  '',
  'Copied from `mobile/DEVICE_TEST.md`. Fill in on the device and keep this file with the release. "Not run" means no claim is made.',
  '',
  table,
  '',
].join('\n');

const outDir = join(ROOT, 'docs', 'releases');
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `${date}-release-check.md`);
writeFileSync(outFile, md);
console.log(`\nWrote ${relative(ROOT, outFile)}`);
console.log(failed.length === 0 ? 'RELEASE CHECK: all executed steps passed' : `RELEASE CHECK: FAILED (${failed.map((f) => f.id).join(', ')})`);
process.exit(failed.length === 0 ? 0 : 1);
