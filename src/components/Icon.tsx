import type { ReactNode } from 'react';

/**
 * One small icon family (24 grid, 2px round stroke, no fill) drawn by hand. Replaces text glyphs so marks look the
 * same on every platform and follow the colour tokens. Each shape is distinct so meaning never depends on colour.
 * Always decorative: the visible text next to it carries the meaning.
 */
const SHAPES = {
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></>,
  wave: <path d="M2 12h3l2-7 3 14 3-10 2 6 2-3h5" />,
  model: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M7 12h2l1.5-3 2 6 1.5-3H17" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  missing: <circle cx="12" cy="12" r="9" strokeDasharray="3.5 3.5" />,
  watch: <><rect x="7" y="6" width="10" height="12" rx="3" /><path d="M9 6l.5-3h5L15 6M9 18l.5 3h5l.5-3" /></>,
  sample: <path d="M12 3l9 9-9 9-9-9z" />,
  discuss: <path d="M4 5h16v11H9l-5 4z" />,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 17h.01" /></>,
  caution: <path d="M12 3l10 18H2zM12 10v5M12 18h.01" />,
  ban: <><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></>,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof SHAPES;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {SHAPES[name]}
    </svg>
  );
}
