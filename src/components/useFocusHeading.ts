import { useEffect, useRef, type RefObject } from 'react';

/**
 * Moves keyboard/screen-reader focus to the first visible heading inside `container` whenever `key` changes
 * (not on first render, so the page does not steal focus on load). If the heading is not there yet (a lazily
 * loaded view), it waits for it to appear, for a few seconds at most.
 */
export function useFocusHeading(container: RefObject<HTMLElement | null>, key: unknown, selector = 'h2'): void {
  // Compare against the last seen key (not a "first run" flag) so React StrictMode's double effect run
  // on initial load does not move focus, which would skip the skip link as the first Tab stop.
  const last = useRef(key);
  useEffect(() => {
    if (Object.is(last.current, key)) return;
    last.current = key;
    const root = container.current;
    if (!root) return;
    // Skip headings inside hidden regions (the flow stays mounted, hidden, while an information view is open).
    const find = () => Array.from(root.querySelectorAll<HTMLElement>(selector)).find((el) => !el.closest('[hidden]'));
    const focus = (h: HTMLElement) => {
      h.setAttribute('tabindex', '-1');
      h.focus({ preventScroll: true });
      try {
        window.scrollTo({ top: 0 });
      } catch {
        // not implemented in some test environments
      }
    };
    const now = find();
    if (now) {
      focus(now);
      return;
    }
    if (typeof MutationObserver === 'undefined') return;
    const obs = new MutationObserver(() => {
      const h = find();
      if (!h) return;
      obs.disconnect();
      focus(h);
    });
    obs.observe(root, { childList: true, subtree: true });
    const t = window.setTimeout(() => obs.disconnect(), 4000);
    return () => {
      obs.disconnect();
      window.clearTimeout(t);
    };
  }, [container, key, selector]);
}
