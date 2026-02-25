import { render } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRevalidateOnFocus } from './useRevalidateOnFocus';

type HarnessProps = {
  callback: () => void;
  depsValue?: number;
};

function Harness({ callback, depsValue = 0 }: Readonly<HarnessProps>) {
  const [value] = useState(depsValue);
  useRevalidateOnFocus(callback, [value], {
    minIntervalMs: 0,
    maxStaleMs: 1000,
    debounceMs: 10,
  });
  return null;
}

describe('useRevalidateOnFocus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
  });

  it('runs callback on window focus with debounce', () => {
    const callback = vi.fn();
    render(<Harness callback={callback} />);

    window.dispatchEvent(new Event('focus'));
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(11);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('runs callback on visibility change to visible', () => {
    const callback = vi.fn();
    render(<Harness callback={callback} />);

    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(11);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
