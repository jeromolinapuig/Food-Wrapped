import { describe, expect, it } from 'vitest';
import type { BurgerCalendarEntry } from './types';
import {
  calculateBurgerCalendarMonthStats,
  getMonthCalendarDays,
  groupEntriesByDate,
} from './utils';

const entry = (id: string, datetime: string, overrides: Partial<BurgerCalendarEntry> = {}): BurgerCalendarEntry => ({
  id,
  datetime,
  price: null,
  rating: null,
  ...overrides,
});

describe('BurgerCalendarPage utils', () => {
  describe('groupEntriesByDate', () => {
    it('groups multiple entries from the same local day', () => {
      const grouped = groupEntriesByDate([
        entry('1', '2026-06-15T12:00:00'),
        entry('2', '2026-06-15T20:30:00'),
      ]);

      expect(grouped['2026-06-15']).toHaveLength(2);
    });

    it('separates entries from different days', () => {
      const grouped = groupEntriesByDate([
        entry('1', '2026-06-15T12:00:00'),
        entry('2', '2026-06-16T12:00:00'),
      ]);

      expect(grouped['2026-06-15']).toHaveLength(1);
      expect(grouped['2026-06-16']).toHaveLength(1);
    });

    it('handles an empty list', () => {
      expect(groupEntriesByDate([])).toEqual({});
    });
  });

  describe('getMonthCalendarDays', () => {
    it('returns visible days for the selected month including surrounding weeks', () => {
      const days = getMonthCalendarDays(2026, 5, []);

      expect(days[0].dateKey).toBe('2026-06-01');
      expect(days.at(-1)?.dateKey).toBe('2026-07-05');
      expect(days).toHaveLength(35);
    });

    it('starts surrounding weeks on Monday when the month starts on Sunday', () => {
      const days = getMonthCalendarDays(2026, 10, []);

      expect(days[0].dateKey).toBe('2026-10-26');
      expect(days[6].dateKey).toBe('2026-11-01');
    });

    it('marks current-month days correctly', () => {
      const days = getMonthCalendarDays(2026, 5, []);
      const julyDay = days.find((day) => day.dateKey === '2026-07-05');
      const juneDay = days.find((day) => day.dateKey === '2026-06-01');

      expect(julyDay?.isCurrentMonth).toBe(false);
      expect(juneDay?.isCurrentMonth).toBe(true);
    });

    it('assigns entries to the matching day', () => {
      const days = getMonthCalendarDays(2026, 5, [
        entry('1', '2026-06-10T12:00:00'),
        entry('2', '2026-06-10T21:00:00'),
      ]);
      const day = days.find((candidate) => candidate.dateKey === '2026-06-10');

      expect(day?.entries.map((item) => item.id)).toEqual(['1', '2']);
    });
  });

  describe('calculateBurgerCalendarMonthStats', () => {
    it('calculates totals, day counts, prices and averages', () => {
      const stats = calculateBurgerCalendarMonthStats([
        entry('1', '2026-06-15T12:00:00', { price: 10 }),
        entry('2', '2026-06-15T20:30:00', { price: 20 }),
        entry('3', '2026-06-16T13:00:00', { price: null }),
      ], 'en');

      expect(stats.totalBurgers).toBe(3);
      expect(stats.burgerDays).toBe(2);
      expect(stats.maxBurgersInOneDay).toBe(2);
      expect(stats.averageBurgersPerBurgerDay).toBe(1.5);
      expect(stats.totalSpent).toBe(30);
      expect(stats.averagePrice).toBe(15);
      expect(stats.mostBurgerWeekday).toBe('Monday');
    });

    it('returns null average price and weekday when there is no data', () => {
      const stats = calculateBurgerCalendarMonthStats([], 'en');

      expect(stats.totalBurgers).toBe(0);
      expect(stats.averagePrice).toBeNull();
      expect(stats.mostBurgerWeekday).toBeNull();
    });

    it('returns null average price when no entry has a valid price', () => {
      const stats = calculateBurgerCalendarMonthStats([
        entry('1', '2026-06-15T12:00:00'),
      ], 'en');

      expect(stats.averagePrice).toBeNull();
    });
  });
});
