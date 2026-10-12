declare module '*.wav' {
  const asset: number;
  export default asset;
}

// Hermes provides performance.now(); the mobile tsconfig has no DOM lib.
declare const performance: { now(): number };

// The shared core (../src/audio/model/infer.ts) is written for Vite and mentions import.meta.glob.
// On Metro it is rewritten by babel-preset-expo and the call throws into the existing try/catch.
interface ImportMeta {
  glob(pattern: string, options?: unknown): Record<string, unknown>;
}

// Inlined at bundle time by babel-preset-expo (EXPO_PUBLIC_* only).
declare const process: { env: { EXPO_PUBLIC_DEVICE_LAB?: string; [k: string]: string | undefined } };

// Hermes provides TextEncoder; the mobile tsconfig has no DOM lib.
declare class TextEncoder {
  encode(input?: string): Uint8Array;
}
