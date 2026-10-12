import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const ESC_DIR = join(ROOT, 'data/raw/esc50/ESC-50-master');
export const KAGGLE_DIR = process.env.SLEEP_KAGGLE_DIR ?? join(ROOT, 'data/raw/kaggle-snoring');
export const PROC_DIR = process.env.SLEEP_PROC_DIR ?? join(ROOT, 'data/processed');
export const MODEL_DIR = join(ROOT, 'model');
export const MODEL_JSON = join(ROOT, 'src/audio/model/model.json');
export const FIXTURE_JSON = join(ROOT, 'src/audio/model/infer.fixture.json');
export const CONSTANTS_TS = join(ROOT, 'src/audio/constants.ts');

export const SEED = 20261010;
export const TEST_FOLD = 5;
export const TRAIN_FOLDS = [1, 2, 3, 4];

/** Bedroom-relevant ESC-50 negative classes (reported separately; up-weighted in training). */
export const BEDROOM_CLASSES = [
  'breathing', 'coughing', 'sneezing', 'clock_tick', 'clock_alarm', 'rain', 'wind',
  'crackling_fire', 'footsteps', 'door_wood_creaks', 'door_wood_knock', 'keyboard_typing',
  'mouse_click', 'brushing_teeth', 'vacuum_cleaner', 'washing_machine', 'toilet_flush',
  'drinking_sipping', 'laughing', 'crying_baby', 'thunderstorm', 'insects', 'cat', 'dog',
];
export const BEDROOM_NEG_WEIGHT = 2;

export interface WindowMeta {
  clip: string;
  start: number; // sample offset
  rmsDbfs: number;
  kept: boolean;
}
export interface ClipMeta {
  id: string;
  source: 'esc50' | 'kaggle';
  cls: string;
  label: 0 | 1;
  fold: number;
  bedroom: boolean;
  file: string; // relative to PROC_DIR
  nSamples: number;
  windows: WindowMeta[];
}
export interface Manifest {
  silenceFloorDbfs: number;
  floorMethod: string;
  clips: ClipMeta[];
}
