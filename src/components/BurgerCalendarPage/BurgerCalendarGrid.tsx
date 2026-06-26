import { useTranslation } from 'react-i18next';
import { getDayStatus } from './utils';
import type { BurgerCalendarDay } from './types';

type BurgerCalendarGridProps = {
  days: BurgerCalendarDay[];
  selectedDateKey: string;
  onSelectDate: (dateKey: string) => void;
};

export function BurgerCalendarGrid({ days, selectedDateKey, onSelectDate }: Readonly<BurgerCalendarGridProps>) {
  const { i18n } = useTranslation();
  const locale = i18n.language;
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2026, 5, 8 + index))
  );

  return (
    <section className="bw-burger-calendar-card" aria-label="Burger calendar">
      <div className="bw-burger-calendar-weekdays" aria-hidden="true">
        {weekdays.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>
      <div className="bw-burger-calendar-grid">
        {days.map((day) => {
          const status = getDayStatus(day.entries);
          const count = day.entries.length;
          const formattedDate = new Intl.DateTimeFormat(locale, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }).format(day.date);
          const ariaLabel = `${formattedDate}, ${count} ${count === 1 ? 'burger' : 'burgers'}`;
          const className = [
            'bw-burger-calendar-day',
            !day.isCurrentMonth ? 'bw-burger-calendar-day--outside-month' : null,
            day.isToday ? 'bw-burger-calendar-day--today' : null,
            selectedDateKey === day.dateKey ? 'bw-burger-calendar-day--selected' : null,
            status === 'one' ? 'bw-burger-calendar-day--has-one' : null,
            status === 'multiple' ? 'bw-burger-calendar-day--has-multiple' : null,
          ].filter(Boolean).join(' ');

          return (
            <button
              type="button"
              key={day.dateKey}
              className={className}
              onClick={() => onSelectDate(day.dateKey)}
              aria-label={ariaLabel}
              aria-pressed={selectedDateKey === day.dateKey}
            >
              <span>{day.date.getDate()}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
