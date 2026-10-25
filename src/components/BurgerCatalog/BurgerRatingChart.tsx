import { useTranslation } from 'react-i18next';
import './BurgerCatalog.css';

export function BurgerRatingChart({ ratings, average }: { ratings: number[]; average: number | null }) {
  const { t, i18n } = useTranslation();
  // Keep existing decimal scores at their numeric positions, without rounding them into bins.
  const scores = [...new Set([
    ...Array.from({ length: 10 }, (_, i) => (i + 1) / 2),
    ...ratings,
  ])].sort((a, b) => a - b);
  const bins = scores.map(score => ({ score, count: ratings.filter(rating => rating === score).length }));
  const maxCount = Math.max(1, ...bins.map(bin => bin.count));
  // Leave half a normal bin at each end so endpoint bars and their labels fit.
  const axisMin = scores[0] - 0.25;
  const axisMax = scores[scores.length - 1] + 0.25;
  const axisRange = axisMax - axisMin;
  const position = (score: number) => ((score - axisMin) / axisRange * 100) + '%';
  const minGap = Math.min(0.5, ...scores.slice(1).map((score, index) => score - scores[index]));
  const barWidth = (minGap / axisRange * 65) + '%';
  const averageLabel = average === null ? null : t('burgerCatalog.averageRating', {
    value: average.toLocaleString(i18n.language, { maximumFractionDigits: 2 }),
  });

  return <section className="bw-card bw-catalog-chart">
    <h3>{t('burgerCatalog.distribution')}</h3>
    {averageLabel && <p className="bw-catalog-average-label">
      <span aria-hidden="true" />{averageLabel}
    </p>}
    <div className="bw-catalog-chart-scroll">
      <div className="bw-catalog-rating-plot" style={{ minWidth: Math.max(260, axisRange / minGap * 24) }}>
        <div className="bw-catalog-bars" role="list" aria-label={t('burgerCatalog.distribution')}>
          {bins.map(bin => {
            const height = (bin.count / maxCount * 100) + '%';
            return <div key={bin.score} className="bw-catalog-bar-col" role="listitem"
              style={{ left: position(bin.score), width: barWidth }}>
              <small>{bin.score.toLocaleString(i18n.language)}★</small>
              <div className="bw-catalog-bar-track" aria-hidden="true" style={{ height }}><div /></div>
              <span style={{ bottom: height }}>{bin.count}</span>
            </div>;
          })}
        </div>
        {average !== null && <div className="bw-catalog-average-marker" aria-hidden="true"
          style={{ left: position(average) }} />}
      </div>
    </div>
  </section>;
}
