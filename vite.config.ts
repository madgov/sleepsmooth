import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Dev only: @vitejs/plugin-react injects an inline React Refresh preamble script, which a strict
// script-src 'self' would block. Production builds keep the strict CSP from index.html unchanged.
const devCspRelax: Plugin = {
  name: 'dev-csp-relax-script-inline',
  apply: 'serve',
  transformIndexHtml: { order: 'post', handler: (html) => html.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'") },
};

// Production only: the HMR websocket allowance is not needed (or wanted) in a built page.
const prodCspStrip: Plugin = {
  name: 'prod-csp-strip-hmr-websocket',
  apply: 'build',
  transformIndexHtml: { order: 'post', handler: (html) => html.replace(' ws://localhost:* ws://127.0.0.1:*', '') },
};

// Production only: writes dist/sw.js from pwa/sw.template.js. The build id is a hash of the emitted (content-hashed) file names plus the
// contents of the other shell files, so every build that changes anything gets a new cache name and old caches are deleted on activate.
// The QA-only parity page and its audio are left out of the precache (they are fetched and stored on first use if ever opened).
const PUBLIC_SHELL = ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'privacy.html', 'support.html', 'sample-audio/esc50-sample.wav', 'sample-audio/esc50-sample.segments.json'];
const pwaServiceWorker: Plugin = {
  name: 'sleepsmooth-service-worker',
  apply: 'build',
  generateBundle(_opts, bundle) {
    const built = Object.keys(bundle).filter((f) => !/^assets\/[Pp]arity-/.test(f) && /\.(js|css)$/.test(f)).sort();
    const pub = PUBLIC_SHELL.filter((f) => existsSync(join('public', f)));
    const hash = createHash('sha256');
    const template = readFileSync('pwa/sw.template.js', 'utf8');
    hash.update(template);
    for (const f of built) hash.update(f);
    for (const f of pub) hash.update(readFileSync(join('public', f)));
    const buildId = hash.digest('hex').slice(0, 12);
    const precache = ['./', 'index.html', ...built, ...pub];
    const source = template.replace('__BUILD_ID__', buildId).replace('__PRECACHE__', JSON.stringify(precache));
    this.emitFile({ type: 'asset', fileName: 'sw.js', source });
  },
};

export default defineConfig({
  plugins: [react(), devCspRelax, prodCspStrip, pwaServiceWorker],
  worker: { format: 'es' },
});
