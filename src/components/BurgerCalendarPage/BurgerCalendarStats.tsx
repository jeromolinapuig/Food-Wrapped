import { CalendarMonth, Euro, LocalDining, QueryStats, Today } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { usePreferences } from '../../context/PreferencesContext';
import type { BurgerCalendarMonthStats } from './types';

type BurgerCalendarStatsProps = {
  stats: BurgerCalendarMonthStats;
};

export function BurgerCalendarStats({ stats }: Readonly<BurgerCalendarStatsProps>) {
  const { t } = useTranslation();
  const { formatCurrency } = usePreferences();
  const statCards = [
    {
      key: 'totalBurgers',
      icon: <LocalDining fontSize="small" />,
      label: t('burgerCalendar.statsTotalBurgers'),
      value: String(stats.totalBurgers),
    },
    {
      key: 'burgerDays',
      icon: <CalendarMonth fontSize="small" />,
      label: t('burgerCalendar.statsBurgerDays'),
      value: String(stats.burgerDays),
    },
    {
      key: 'maxBurgersInOneDay',
      icon: <Today fontSize="small" />,
      label: t('burgerCalendar.statsMaxBurgersInOneDay'),
      value: String(stats.maxBurgersInOneDay),
    },
    {
      key: 'totalSpent',
      icon: <Euro fontSize="small" />,
      label: t('burgerCalendar.statsTotalSpent'),
      value: formatCurrency(stats.totalSpent),
    },
    {
      key: 'mostBurgerWeekday',
      icon: <QueryStats fontSize="small" />,
      label: t('burgerCalendar.statsMostBurgerWeekday'),
      value: stats.mostBurgerWeekday ?? '-',
    },
    {
      key: 'averagePrice',
      icon: <Euro fontSize="small" />,
      label: t('burgerCalendar.statsAveragePrice'),
      value: stats.averagePrice == null ? '-' : formatCurrency(stats.averagePrice),
    },
  ];

  return (
    <section className="bw-burger-calendar-stats" aria-label={t('burgerCalendar.statsTitle')}>
      {statCards.map((card) => (
        <article className="bw-burger-calendar-stat-card" key={card.key}>
          <div className="bw-stat-icon">{card.icon}</div>
          <div className="bw-burger-calendar-stat-value">{card.value}</div>
          <div className="bw-burger-calendar-stat-label">{card.label}</div>
        </article>
      ))}
    </section>
  );
}
