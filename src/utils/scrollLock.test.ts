import { describe, expect, it } from 'vitest';
import { lockBodyScroll } from './scrollLock';

describe('scrollLock', () => {
  it('adds and removes modal class using lock count', () => {
    const unlockA = lockBodyScroll();
    const unlockB = lockBodyScroll();

    expect(document.body.classList.contains('bw-modal-open')).toBe(true);
    unlockA();
    expect(document.body.classList.contains('bw-modal-open')).toBe(true);
    unlockB();
    expect(document.body.classList.contains('bw-modal-open')).toBe(false);
  });
});
