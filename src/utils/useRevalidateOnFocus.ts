import { useEffect, useRef } from 'react';

type RevalidateFn = () => void;

export const useRevalidateOnFocus = (callback: RevalidateFn, deps: unknown[] = []) => {
  const latest = useRef<RevalidateFn>(callback);

  useEffect(() => {
    latest.current = callback;
  }, [callback]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      latest.current();
    };

    const handleFocus = () => {
      latest.current();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, deps);
};
