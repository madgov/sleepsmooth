# features API: READY

`resampleTo16k`, `computeLogMel`, `frameLogMel` in `index.ts` are implemented and tested
(`features.test.ts`: FFT vs naive DFT, mel properties, resample tone checks, golden parity at 1e-4).
Pure TS, no DOM imports; runs in Node and the browser.

- Resampler: Kaiser-windowed sinc (8 zero crossings, beta 8, cutoff 0.97 x Nyquist), anti-aliased.
- Frames: 400 samples (25 ms), hop 160, periodic Hann, zero-padded to a 512-point radix-2 FFT, power spectrum.
- Mel: HTK scale, 40 triangular filters, 0-8000 Hz, peak weight 1 (no area normalization).
- Log: `ln(energy + 1e-10)` (natural log).
- `frameLogMel`: 1 s window zero-padded 120 samples per side -> 100 frames x 40.
- Golden generator: `npx tsx src/audio/features/golden/makeGolden.ts` -> `golden/golden/*.json`.

Codec parity (mp3/m4a fixtures, `golden/fixtures`): measured mean abs log-mel difference vs uncompressed
(128 kbps): mp3 mean 0.123 / max 0.765 / p95 frame 0.150; m4a mean 0.168 / max 1.263 / p95 frame 0.226.
`CODEC_TOLERANCE` = 0.34 (~2x larger mean). Browser decode path is exercised in QA.
