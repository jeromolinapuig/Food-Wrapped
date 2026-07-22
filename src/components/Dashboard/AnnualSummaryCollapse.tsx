import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BorderBeam } from 'border-beam';

type AnnualSummaryCollapseProps = {
  year: number;
  totalBurgers: number;
  averageRating: number;
  totalSpentLabel: string;
  favoriteRestaurant: string;
  theme: 'light' | 'dark';
  children: ReactNode;
};

export function AnnualSummaryCollapse({
  year,
  totalBurgers,
  averageRating,
  totalSpentLabel,
  theme,
  children,
}: Readonly<AnnualSummaryCollapseProps>) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const contentId = `bw-annual-summary-${year}`;

  return (
    <section className="bw-annual-summary">
      {!expanded && (
        <BorderBeam
          size="md"
          colorVariant="colorful"
          theme={theme}
          strength={0.9}
          duration={8}
          borderRadius={24}
          staticColors
          className="bw-annual-summary-beam"
        >
          <button
            type="button"
            className="bw-card bw-annual-summary-toggle"
            aria-expanded={expanded}
            aria-controls={contentId}
            onClick={() => setExpanded(true)}
          >
            <span className="bw-annual-summary-title">{t('burgerCalendar.summaryTitle', { year })}</span>
            <span className="bw-annual-summary-metrics">
              <span className="bw-annual-summary-metric">
                <span className="bw-annual-summary-metric-value">{totalBurgers}</span>
                <span className="bw-annual-summary-metric-label">{t('burgerCalendar.summaryBurgersLabel')}</span>
              </span>
              <span className="bw-annual-summary-metric">
                <span className="bw-annual-summary-metric-value">{averageRating ? averageRating.toFixed(1) : '-'}</span>
                <span className="bw-annual-summary-metric-label">{t('burgerCalendar.summaryAverageRatingLabel')}</span>
              </span>
              <span className="bw-annual-summary-metric">
                <span className="bw-annual-summary-metric-value">{totalSpentLabel}</span>
                <span className="bw-annual-summary-metric-label">{t('burgerCalendar.summaryTotalSpentLabel')}</span>
              </span>
            </span>
            <span className="bw-annual-summary-action">
              <span>{t('burgerCalendar.summaryShowFull')}</span>
              <span className="bw-annual-summary-chevron" aria-hidden="true" />
            </span>
          </button>
        </BorderBeam>
      )}
      <div className={`bw-annual-summary-content ${expanded ? 'is-expanded' : ''}`} id={contentId}>
        <button
          type="button"
          className="bw-annual-summary-collapse-button"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded(false)}
        >
          <span>{t('burgerCalendar.summaryHideFull')}</span>
          <span className="bw-annual-summary-chevron" aria-hidden="true" />
        </button>
        {children}
      </div>
    </section>
  );
}
