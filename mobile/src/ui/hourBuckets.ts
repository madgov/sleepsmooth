import type { EpochState } from '../data/nightSource';

export interface HourBucket {
  /** Minutes from midnight of the first epoch's day (may exceed 1440 when the window crosses midnight). */
  startMin: number;
  /** Clock hour 0..23 for the label. */
  hour: number;
  minutes: number;
  asleepMin: number;
  uncertainMin: number;
}

/** Groups the existing per-epoch estimate into clock hours. Pure presentation; invents no data. */
export function hourBuckets(epochs: readonly EpochState[], epochMinutesEach: number, startMin: number): HourBucket[] {
  const out: HourBucket[] = [];
  epochs.forEach((e, i) => {
    const t = startMin + i * epochMinutesEach;
    const hourStart = Math.floor(t / 60) * 60;
    let b = out[out.length - 1];
    if (!b || b.startMin !== hourStart) {
      b = { startMin: hourStart, hour: ((Math.floor(hourStart / 60) % 24) + 24) % 24, minutes: 0, asleepMin: 0, uncertainMin: 0 };
      out.push(b);
    }
    b.minutes += epochMinutesEach;
    if (e === 'asleep') b.asleepMin += epochMinutesEach;
    else if (e === 'uncertain') b.uncertainMin += epochMinutesEach;
  });
  return out;
}
