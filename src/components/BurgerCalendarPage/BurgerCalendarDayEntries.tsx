import { Star } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { BurgerCalendarEntry } from './types';

type BurgerCalendarDayEntriesProps = {
  date: Date;
  entries: BurgerCalendarEntry[];
  onOpenEntry: (entryId: string) => void;
};

const formatPrice = (price: number | null | undefined, currency: string | null | undefined) => {
  if (price == null) return null;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency ?? 'EUR' }).format(price);
  } catch {
    return `${price.toFixed(2)} ${currency ?? 'EUR'}`;
  }
};

export function BurgerCalendarDayEntries({
  date,
  entries,
  onOpenEntry,
}: Readonly<BurgerCalendarDayEntriesProps>) {
  const { t, i18n } = useTranslation();
  const titleDate = new Intl.DateTimeFormat(i18n.language, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);

  return (
    <section className="bw-burger-calendar-day-entries">
      <div className="bw-section-header">
        <h2 className="bw-section-title">{t('burgerCalendar.selectedDayTitle')} · {titleDate}</h2>
      </div>

      {entries.length === 0 ? (
        <article className="bw-card">
          <p className="bw-helper">{t('burgerCalendar.emptyDay')}</p>
        </article>
      ) : (
        <div className="bw-burger-calendar-entry-list">
          {entries.map((entry) => {
            const burgerName = entry.burger?.name ?? t('burgerCalendar.unknownBurger');
            const price = formatPrice(entry.price, entry.currency);
            return (
              <article className="bw-burger-calendar-entry-card" key={entry.id}>
                {entry.photo_url ? (
                  <img className="bw-burger-calendar-entry-photo" src={entry.photo_url} alt={burgerName} />
                ) : (
                  <div className="bw-burger-calendar-entry-photo is-empty" aria-hidden="true" />
                )}
                <div className="bw-burger-calendar-entry-body">
                  <h3>{burgerName}</h3>
                  {entry.restaurant?.name && <p>{entry.restaurant.name}</p>}
                  <div className="bw-burger-calendar-entry-meta">
                    {entry.rating != null && (
                      <span><Star fontSize="inherit" /> {entry.rating.toFixed(1)}</span>
                    )}
                    {price && <span>{price}</span>}
                    <span>
                      {new Date(entry.datetime).toLocaleTimeString(i18n.language, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="bw-btn bw-btn-ghost bw-burger-calendar-entry-action"
                  onClick={() => onOpenEntry(entry.id)}
                >
                  {t('burgerCalendar.openPost')}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
