import { useTranslation } from 'react-i18next';

type BurgerCalendarHomeCardProps = {
  burgerDaysThisMonth: number;
  onOpen: () => void;
};

export function BurgerCalendarHomeCard({ burgerDaysThisMonth, onOpen }: Readonly<BurgerCalendarHomeCardProps>) {
  const { t } = useTranslation();
  const summary = burgerDaysThisMonth > 0
    ? t('burgerCalendar.homeCardWithData', { count: burgerDaysThisMonth })
    : t('burgerCalendar.homeCardWithoutData');

  return (
    <section className="bw-burger-calendar-home">
      <article className="bw-card bw-burger-calendar-home-card">
        <div className="bw-burger-calendar-home-icon" aria-hidden="true">
          <span className="bw-burger-calendar-home-icon-shape" />
        </div>
        <div className="bw-burger-calendar-home-body">
          <h2>{t('burgerCalendar.homeCardTitle')}</h2>
          <p>{summary}</p>
        </div>
        <button type="button" className="bw-btn bw-btn-primary" onClick={onOpen}>
          {t('burgerCalendar.homeCardCta')}
        </button>
      </article>
    </section>
  );
}
