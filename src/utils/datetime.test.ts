import { describe, expect, it } from 'vitest';
import { formatLocalDateTime, getCurrentMonthValue, MIN_DATE, MIN_DATETIME_STRING } from './datetime';

describe('datetime utils', () => {
  it('exports expected minimum values', () => {
    expect(MIN_DATETIME_STRING).toBe('2026-01-01T00:00');
    expect(MIN_DATE.getFullYear()).toBe(2026);
    expect(MIN_DATE.getMonth()).toBe(0);
    expect(MIN_DATE.getDate()).toBe(1);
  });

  it('formats local datetime with yyyy-mm-ddThh:mm shape', () => {
    const value = formatLocalDateTime(new Date('2026-02-03T10:15:00.000Z'));
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it('gets current month value', () => {
    expect(getCurrentMonthValue(new Date('2026-11-25T12:00:00.000Z'))).toBe('2026-11');
  });
});
