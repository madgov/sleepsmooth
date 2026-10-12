import { NightStore } from '@core/mobileLogic/nightStore';
import { getStoreFs } from './fileStore';

let store: NightStore | null = null;
/** The single on-device night store. Created on first use so importing it never touches the disk. */
export function getNightStore(): NightStore {
  store ??= new NightStore(getStoreFs());
  return store;
}
