import type { BurgerCalendarDay, BurgerCalendarEntry, BurgerCalendarMonthStats } from './types';

const pad = (value: number) => String(value).padStart(2, '0');
const getMondayFirstWeekday = (date: Date) => (date.getDay() + 6) % 7;

export function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function groupEntriesByDate(
  entries: BurgerCalendarEntry[]
): Record<string, BurgerCalendarEntry[]> {
  return entries.reduce<Record<string, BurgerCalendarEntry[]>>((acc, entry) => {
    const date = new Date(entry.datetime);
    if (Number.isNaN(date.getTime())) return acc;
    const key = getDateKey(date);
    acc[key] = [...(acc[key] ?? []), entry];
    return acc;
  }, {});
}

export function getMonthCalendarDays(
  year: number,
  month: number,
  entries: BurgerCalendarEntry[]
): BurgerCalendarDay[] {
  const grouped = groupEntriesByDate(entries);
  const firstDay = new Date(year, month, 1);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - getMondayFirstWeekday(firstDay));

  const lastDay = new Date(year, month + 1, 0);
  const end = new Date(lastDay);
  end.setDate(lastDay.getDate() + (6 - getMondayFirstWeekday(lastDay)));

  const todayKey = getDateKey(new Date());
  const days: BurgerCalendarDay[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    const date = new Date(cursor);
    const dateKey = getDateKey(date);
    days.push({
      date,
      dateKey,
      isCurrentMonth: date.getMonth() === month && date.getFullYear() === year,
      isToday: dateKey === todayKey,
      entries: grouped[dateKey] ?? [],
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

export function calculateBurgerCalendarMonthStats(
  entries: BurgerCalendarEntry[],
  locale: string
): BurgerCalendarMonthStats {
  const grouped = groupEntriesByDate(entries);
  const dayCounts = Object.values(grouped).map((dayEntries) => dayEntries.length);
  const validPrices = entries
    .map((entry) => entry.price)
    .filter((price): price is number => typeof price === 'number' && Number.isFinite(price));
  const weekdayCounts = new Map<number, number>();

  entries.forEach((entry) => {
    const date = new Date(entry.datetime);
    if (Number.isNaN(date.getTime())) return;
    const weekday = date.getDay();
    weekdayCounts.set(weekday, (weekdayCounts.get(weekday) ?? 0) + 1);
  });

  let mostBurgerWeekday: string | null = null;
  let maxWeekdayCount = 0;
  weekdayCounts.forEach((count, weekday) => {
    if (count <= maxWeekdayCount) return;
    maxWeekdayCount = count;
    const sample = new Date(2026, 5, 7 + weekday);
    mostBurgerWeekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(sample);
  });

  const totalBurgers = entries.length;
  const burgerDays = dayCounts.length;
  const totalSpent = validPrices.reduce((sum, price) => sum + price, 0);

  return {
    totalBurgers,
    burgerDays,
    maxBurgersInOneDay: dayCounts.length ? Math.max(...dayCounts) : 0,
    averageBurgersPerBurgerDay: burgerDays ? totalBurgers / burgerDays : 0,
    mostBurgerWeekday,
    totalSpent,
    averagePrice: validPrices.length ? totalSpent / validPrices.length : null,
  };
}

export function getDayStatus(entries: BurgerCalendarEntry[]): 'empty' | 'one' | 'multiple' {
  if (entries.length === 0) return 'empty';
  if (entries.length === 1) return 'one';
  return 'multiple';
}

export function toLocalMonthBoundary(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}T00:00:00`;
}
