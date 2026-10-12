import { noSas } from './instruments/noSas';
import type { ScreeningInstrument } from './types';

/** The active instrument. Swapping instruments is a one-line change here. */
export const activeInstrument: ScreeningInstrument = noSas;
