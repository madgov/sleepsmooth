import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

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

export default defineConfig({
  plugins: [react(), devCspRelax, prodCspStrip],
  worker: { format: 'es' },
});
