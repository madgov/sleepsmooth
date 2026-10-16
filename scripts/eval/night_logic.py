"""Faithful Python port of the app's night logic (read-only copy of the rules in src/night), for offline evaluation.

Ported from:
  src/night/pipeline.ts   level blocks (100 ms), per-second dB, rolling 10th-percentile noise floor, per-window level gate  -> window_status()
  src/night/summary.ts    findEpisodes (episode = flagged windows, gap <= NIGHT_EPISODE_MAX_GAP_SEC, >= NIGHT_EPISODE_MIN_FLAGGED) -> find_segments()
  src/night/constants.ts  GATE_DB, ROLLING_FLOOR_SEC, FLOOR_PERCENTILE, FLOOR_MIN_HISTORY_SEC, NIGHT_EPISODE_* values
The port was checked against the TypeScript (scripts/eval/verify_port.sh): identical window statuses on a rendered test night and identical
episodes on random flag sets. If src/night changes, re-run that check. EXPERIMENTAL grouping variants (k-of-n, periodicity) are NOT in the app:
they live in this file only, clearly named, and are candidates to be ported to TypeScript only if they are chosen with real data.
"""
import numpy as np

SR = 16000
SILENCE_FLOOR_DBFS = -72.0
GATE_DB = 6.0
ROLLING_FLOOR_SEC = 600
FLOOR_PERCENTILE = 0.1
FLOOR_MIN_HISTORY_SEC = 30
EPISODE_MAX_GAP_SEC = 10.0
EPISODE_MIN_FLAGGED = 5
WINDOW_SEC, HOP_SEC = 1.0, 0.5
HIST_MIN_DB, HIST_BINS = -120, 121
MIN_DB = -120.0
BLOCK = SR // 10          # 1600 samples
HOP = SR // 2             # 8000
WIN = SR                  # 16000

STATUS_TOO_QUIET, STATUS_BELOW_GATE, STATUS_SCORED = 0, 1, 2


def to_db(mean_square):
    ms = np.asarray(mean_square, np.float64)
    return np.where(ms <= 0, MIN_DB, np.maximum(MIN_DB, 10 * np.log10(np.maximum(ms, 1e-300))))


def block_sums(x):
    """Sum of squares per 100 ms block (complete blocks only), float64."""
    nb = len(x) // BLOCK
    out = np.empty(nb, np.float64)
    step = 600 * 10                    # 10 min of blocks per chunk keeps temporaries small
    for a in range(0, nb, step):
        seg = x[a * BLOCK:min(nb, a + step) * BLOCK].astype(np.float64)
        out[a:a + len(seg) // BLOCK] = (seg * seg).reshape(-1, BLOCK).sum(1)
    return out


def _round_half_up(v):
    return np.floor(v + 0.5)


def window_status(blocks):
    """blocks: per-100ms sum of squares of a whole capture (one segment from t=0).
    Returns (level_db[k], floor_db[k], status[k]) for every window k that fits (window k = [k*0.5 s, k*0.5 s + 1 s))."""
    nb = len(blocks)
    nsec = nb // 10
    nh = nb // 5
    half = blocks[:nh * 5].reshape(-1, 5).sum(1)
    sec_db = to_db(blocks[:nsec * 10].reshape(-1, 10).sum(1) / SR)
    # rolling histogram floor: floor for second s is computed BEFORE adding second s (pipeline.completeSecond)
    hist = np.zeros(HIST_BINS, np.int64)
    count = 0
    floors = np.empty(nsec)
    bins = np.clip(_round_half_up(sec_db) - HIST_MIN_DB, 0, HIST_BINS - 1).astype(int)
    for s in range(nsec):
        if count < FLOOR_MIN_HISTORY_SEC:
            floors[s] = SILENCE_FLOOR_DBFS
        else:
            target = max(1, int(np.ceil(FLOOR_PERCENTILE * count)))
            cum = np.cumsum(hist)
            i = int(np.searchsorted(cum, target))      # first bin with cum >= target
            floors[s] = max(SILENCE_FLOOR_DBFS, (i + HIST_MIN_DB) if i < HIST_BINS else SILENCE_FLOOR_DBFS)
        hist[bins[s]] += 1
        count += 1
        if s - ROLLING_FLOOR_SEC >= 0:
            hist[bins[s - ROLLING_FLOOR_SEC]] -= 1
            count -= 1
    nwin = nh - 1
    k = np.arange(nwin)
    level = to_db((half[:nwin] + half[1:nwin + 1]) / SR)
    floor_k = floors[np.minimum(k // 2, nsec - 1)]
    gate = np.maximum(SILENCE_FLOOR_DBFS, floor_k + GATE_DB)
    status = np.where(level < SILENCE_FLOOR_DBFS, STATUS_TOO_QUIET, np.where(level < gate, STATUS_BELOW_GATE, STATUS_SCORED)).astype(np.int8)
    return level, floor_k, status


def find_segments(flagged_k, min_flagged=EPISODE_MIN_FLAGGED, max_gap_sec=EPISODE_MAX_GAP_SEC):
    """Port of summary.ts findEpisodes. flagged_k: window indices. Returns list of (t0_sec, t1_sec, n_flagged, k_first, k_last)."""
    ks = np.unique(np.asarray(flagged_k, np.int64))
    out, run = [], []

    def close():
        if len(run) >= min_flagged:
            out.append((run[0] * HOP_SEC, run[-1] * HOP_SEC + WINDOW_SEC, len(run), run[0], run[-1]))
        run.clear()
    for k in ks:
        if run:
            gap = (k - run[-1]) * HOP_SEC - WINDOW_SEC
            if gap > max_gap_sec:
                close()
        run.append(int(k))
    close()
    return out


def kofn_confirm(flag, n_sec, k_min):
    """EXPERIMENTAL (not in the app). A flagged window is confirmed if some run of N = 2*n_sec consecutive window indices containing it has >= k_min flagged."""
    flag = np.asarray(flag, bool)
    if k_min <= 1:
        return flag.copy()
    N = int(round(2 * n_sec))
    c = np.convolve(flag.astype(np.int32), np.ones(N, np.int32), mode='full')        # c[j + N - 1] = flags in [j, j+N-1]
    # run starting at j covers windows j..j+N-1; window k belongs to runs j in [k-N+1, k]
    ok = c >= k_min
    cs = np.concatenate([[0], np.cumsum(ok.astype(np.int64))])
    idx = np.where(flag)[0]
    hi = np.minimum(idx + N - 1, len(ok) - 1)
    out = np.zeros(len(flag), bool)
    out[idx] = (cs[hi + 1] - cs[idx]) > 0
    return out


def periodicity_peak(series, lag_lo=6, lag_hi=14):
    """EXPERIMENTAL. Max normalised autocorrelation of a (mean-removed) score series at lags lag_lo..lag_hi windows (3 to 7 s). None if too short."""
    x = np.asarray(series, np.float64)
    if len(x) < 2 * lag_hi + 2:      # needs about two cycles of the longest lag: 15 s
        return None
    x = x - x.mean()
    den = float((x * x).sum())
    if den <= 1e-12:
        return 0.0
    return max(float((x[:-l] * x[l:]).sum() / den) for l in range(lag_lo, lag_hi + 1))
