import { useEffect, useRef } from 'react';

type RevalidateFn = () => void;
type RevalidateOptions = {
  minIntervalMs?: number;
  maxStaleMs?: number;
  debounceMs?: number;
};

export const useRevalidateOnFocus = (
  callback: RevalidateFn,
  deps: unknown[] = [],
  options: RevalidateOptions = {}
) => {
  const latest = useRef<RevalidateFn>(callback);
  const lastRunAt = useRef<number>(0);
  const debounceTimer = useRef<number | null>(null);
  const minIntervalMs = options.minIntervalMs ?? 60_000;
  const maxStaleMs = options.maxStaleMs ?? 10 * 60_000;
  const debounceMs = options.debounceMs ?? 250;

  useEffect(() => {
    latest.current = callback;
  }, [callback]);

  useEffect(() => {
    const runIfAllowed = () => {
      const now = Date.now();
      const elapsed = now - lastRunAt.current;
      if (maxStaleMs && elapsed >= maxStaleMs) {
        lastRunAt.current = now;
        latest.current();
        return;
      }
      if (elapsed < minIntervalMs) return;
      lastRunAt.current = now;
      latest.current();
    };

    const schedule = () => {
      if (debounceTimer.current != null) {
        window.clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = window.setTimeout(runIfAllowed, debounceMs);
    };

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      schedule();
    };

    const handleFocus = () => {
      schedule();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    const intervalId =
      maxStaleMs > 0
        ? window.setInterval(() => {
            if (document.visibilityState !== 'visible') return;
            runIfAllowed();
          }, Math.min(maxStaleMs / 4, 60_000))
        : null;

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (intervalId != null) window.clearInterval(intervalId);
      if (debounceTimer.current != null) {
        window.clearTimeout(debounceTimer.current);
      }
    };
  }, [debounceMs, maxStaleMs, minIntervalMs, ...deps]);
};
