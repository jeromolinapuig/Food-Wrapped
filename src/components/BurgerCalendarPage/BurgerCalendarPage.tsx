import { useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '../common/AppShell';
import { BackButton } from '../common/BackButton';
import { PageHeader } from '../common/PageHeader';
import { usePreferences } from '../../context/PreferencesContext';
import { calculateBurgerCalendarMonthStats, getDateKey, getMonthCalendarDays } from './utils';
import { useBurgerCalendar } from './useBurgerCalendar';
import { BurgerCalendarDayEntries } from './BurgerCalendarDayEntries';
import { BurgerCalendarGrid } from './BurgerCalendarGrid';
import { BurgerCalendarStats } from './BurgerCalendarStats';
import '../../styles/layout.css';
import '../../styles/shared.css';
import './BurgerCalendarPage.css';

type BurgerCalendarPageProps = {
  session: Session;
  onBack: () => void;
};

export function BurgerCalendarPage({ session, onBack }: Readonly<BurgerCalendarPageProps>) {
  const { t, i18n } = useTranslation();
  const { language } = usePreferences();
  const navigate = useNavigate();
  const location = useLocation();
  const today = new Date();
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDateKey, setSelectedDateKey] = useState(() => getDateKey(today));
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const { entries, isLoading, error } = useBurgerCalendar(session, year, month);

  const days = useMemo(() => getMonthCalendarDays(year, month, entries), [entries, month, year]);
  const stats = useMemo(
    () => calculateBurgerCalendarMonthStats(entries, language || i18n.language),
    [entries, i18n.language, language]
  );
  const selectedDay = days.find((day) => day.dateKey === selectedDateKey) ?? days.find((day) => day.isToday) ?? days[0];
  const selectedEntries = selectedDay?.entries ?? [];
  const title = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(visibleMonth);

  const shiftMonth = (delta: number) => {
    setVisibleMonth((current) => {
      const next = new Date(current.getFullYear(), current.getMonth() + delta, 1);
      setSelectedDateKey(getDateKey(next));
      return next;
    });
  };

  const goToday = () => {
    const now = new Date();
    setVisibleMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDateKey(getDateKey(now));
  };

  return (
    <AppShell>
      <PageHeader
        leading={<BackButton onClick={onBack} ariaLabel={t('common.back', { defaultValue: 'Back' })} />}
        title={t('burgerCalendar.title')}
        subtitle={t('burgerCalendar.description')}
      />

      <main className="bw-main bw-burger-calendar-page">
        <section className="bw-burger-calendar-controls" aria-label={t('burgerCalendar.navigation')}>
          <button
            type="button"
            className="bw-icon-button"
            onClick={() => shiftMonth(-1)}
            aria-label={t('burgerCalendar.previousMonth')}
          >
            <ChevronLeft />
          </button>
          <h2>{title}</h2>
          <button
            type="button"
            className="bw-icon-button"
            onClick={() => shiftMonth(1)}
            aria-label={t('burgerCalendar.nextMonth')}
          >
            <ChevronRight />
          </button>
          <button type="button" className="bw-btn bw-btn-ghost" onClick={goToday}>
            {t('burgerCalendar.today')}
          </button>
        </section>

        {isLoading && <p className="bw-helper">{t('burgerCalendar.loading')}</p>}
        {error && <p className="bw-burger-calendar-error">{t('burgerCalendar.error')}</p>}

        <BurgerCalendarStats stats={stats} />
        <BurgerCalendarGrid
          days={days}
          selectedDateKey={selectedDateKey}
          onSelectDate={setSelectedDateKey}
        />
        {selectedDay && (
          <BurgerCalendarDayEntries
            date={selectedDay.date}
            entries={selectedEntries}
            onOpenEntry={(entryId) => navigate(`/posts/${entryId}`, { state: { returnTo: location.pathname } })}
          />
        )}
      </main>
    </AppShell>
  );
}
