import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowBackIosNew, ArrowForwardIos, CalendarToday, Close, Euro, LocalDining, LunchDining, Star } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { supabase } from '../../lib/supabaseClient';
import { whereNotDeleted } from '../../lib/whereNotDeleted';
import { usePreferences } from '../../context/PreferencesContext';
import './WrappedPreviewPage.css';

type WrappedPreviewPageProps = {
  session: Session;
};

type MeatType = 'beef' | 'chicken' | 'vegan' | 'other';

type WrappedEntryRow = {
  id: string;
  datetime: string;
  rating: number | null;
  price: number | null;
  photo_url: string | null;
  additional_notes: string | null;
  currency?: string | null;
  is_burger: boolean;
  burger_origin: 'restaurant' | 'homemade' | null;
  meat_type: MeatType | null;
  restaurant_id: string | null;
  restaurant: { name: string } | null;
  burger: { name: string | null; meat_type: MeatType | null } | null;
};

type WrappedHighlight = {
  names: string[];
  count: number;
};

type WrappedMonthHighlight = {
  monthValue: string;
  count: number;
};

type WrappedStats = {
  totalBurgers: number;
  totalSpent: number;
  types: Record<MeatType, number>;
  favoriteEntry: WrappedEntryRow | null;
  mostExpensiveEntry: WrappedEntryRow | null;
  worstEntry: WrappedEntryRow | null;
  restaurantHighlight: WrappedHighlight | null;
  monthHighlight: WrappedMonthHighlight | null;
  discoveredRestaurants: number;
  homemadeBurgers: number;
  restaurantBurgers: number;
  topRatedEntries: WrappedEntryRow[];
};

type WrappedTypeRow = {
  key: MeatType;
  label: string;
  icon: string;
  value: number;
};

const SLIDE_DURATION_MS = 6500;

const emptyStats: WrappedStats = {
  totalBurgers: 0,
  totalSpent: 0,
  favoriteEntry: null,
  mostExpensiveEntry: null,
  worstEntry: null,
  restaurantHighlight: null,
  monthHighlight: null,
  discoveredRestaurants: 0,
  homemadeBurgers: 0,
  restaurantBurgers: 0,
  topRatedEntries: [],
  types: {
    beef: 0,
    chicken: 0,
    vegan: 0,
    other: 0,
  },
};

function getHighlightedCountGroup(counter: Map<string, number>): WrappedHighlight | null {
  const rows = Array.from(counter.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (!rows.length) return null;
  if (rows.length > 1 && rows.every((row) => row[1] === rows[0][1])) return null;
  const topCount = rows[0][1];
  const names = rows.filter((row) => row[1] === topCount).map(([name]) => name).slice(0, 3);
  return { names, count: topCount };
}

function getHighlightedMonth(monthCounter: Map<string, number>): WrappedMonthHighlight | null {
  const rows = Array.from(monthCounter.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (!rows.length) return null;
  if (rows.length > 1 && rows.every((row) => row[1] === rows[0][1])) return null;
  return { monthValue: rows[0][0], count: rows[0][1] };
}

function useAnimatedNumber(value: number, durationMs = 1200) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let frameId = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(value * eased);
      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [durationMs, value]);

  return displayValue;
}

function buildWrappedStats(entries: WrappedEntryRow[], convertAmount: (amount: number, fromCurrency: string, toCurrency: string) => number, targetCurrency: string): WrappedStats {
  const restaurantCounter = new Map<string, number>();
  const monthCounter = new Map<string, number>();
  const uniqueRestaurants = new Set<string>();

  const stats = entries.reduce<WrappedStats>((acc, entry) => {
    if (entry.price != null) {
      acc.totalSpent += convertAmount(entry.price, entry.currency ?? 'EUR', targetCurrency);
    }

    if (!entry.is_burger) return acc;

    acc.totalBurgers += 1;
    if (entry.burger_origin === 'homemade') {
      acc.homemadeBurgers += 1;
    } else {
      acc.restaurantBurgers += 1;
    }

    const date = new Date(entry.datetime);
    if (!Number.isNaN(date.getTime())) {
      const monthValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthCounter.set(monthValue, (monthCounter.get(monthValue) ?? 0) + 1);
    }

    if (entry.burger_origin !== 'homemade' && entry.restaurant?.name) {
      const restaurantName = entry.restaurant.name;
      restaurantCounter.set(restaurantName, (restaurantCounter.get(restaurantName) ?? 0) + 1);
      uniqueRestaurants.add(entry.restaurant_id ?? restaurantName);
    }

    if (
      entry.rating != null &&
      (
        !acc.favoriteEntry ||
        (acc.favoriteEntry.rating ?? -Infinity) < entry.rating ||
        ((acc.favoriteEntry.rating ?? -Infinity) === entry.rating && entry.datetime > acc.favoriteEntry.datetime)
      )
    ) {
      acc.favoriteEntry = entry;
    }

    if (
      entry.rating != null &&
      (
        !acc.worstEntry ||
        (acc.worstEntry.rating ?? Infinity) > entry.rating ||
        ((acc.worstEntry.rating ?? Infinity) === entry.rating && entry.datetime > acc.worstEntry.datetime)
      )
    ) {
      acc.worstEntry = entry;
    }

    if (
      entry.price != null &&
      (
        !acc.mostExpensiveEntry ||
        convertAmount(entry.price, entry.currency ?? 'EUR', targetCurrency) >
          convertAmount(acc.mostExpensiveEntry.price ?? 0, acc.mostExpensiveEntry.currency ?? 'EUR', targetCurrency)
      )
    ) {
      acc.mostExpensiveEntry = entry;
    }

    const meatType = entry.meat_type ?? entry.burger?.meat_type ?? 'other';
    if (meatType === 'beef' || meatType === 'chicken' || meatType === 'vegan') {
      acc.types[meatType] += 1;
    } else {
      acc.types.other += 1;
    }

    return acc;
  }, {
    totalBurgers: 0,
    totalSpent: 0,
    favoriteEntry: null,
    mostExpensiveEntry: null,
    worstEntry: null,
    restaurantHighlight: null,
    monthHighlight: null,
    discoveredRestaurants: 0,
    homemadeBurgers: 0,
    restaurantBurgers: 0,
    topRatedEntries: [],
    types: {
      beef: 0,
      chicken: 0,
      vegan: 0,
      other: 0,
    },
  });

  stats.restaurantHighlight = getHighlightedCountGroup(restaurantCounter);
  stats.monthHighlight = getHighlightedMonth(monthCounter);
  stats.discoveredRestaurants = uniqueRestaurants.size;
  stats.topRatedEntries = entries
    .filter((entry) => entry.is_burger && entry.rating != null)
    .sort((a, b) => {
      const ratingDelta = (b.rating ?? 0) - (a.rating ?? 0);
      if (ratingDelta !== 0) return ratingDelta;
      return b.datetime.localeCompare(a.datetime);
    })
    .slice(0, 5);

  return stats;
}

function getBurgerIntroCopy(totalBurgers: number, year: number, t: TFunction) {
  if (totalBurgers === 0) return t('wrapped.burgersIntroNone', { year });
  return t('wrapped.burgersIntroSuspense', { count: totalBurgers, year });
}

function getSpentCopyKey(totalSpent: number) {
  if (totalSpent <= 0) return 'wrapped.spentCopyNone';
  return 'wrapped.spentCopyWithAmount';
}

function getTypeCopy(typeRows: WrappedTypeRow[], totalBurgers: number, t: TFunction) {
  if (totalBurgers === 0) {
    return t('wrapped.typesCopyNone');
  }

  const [topType, secondType] = typeRows;
  if (!topType || topType.value === 0) {
    return t('wrapped.typesCopyNone');
  }

  if (secondType && topType.value === secondType.value) {
    return t('wrapped.typesCopyTie', { count: topType.value });
  }

  const percentage = Math.round((topType.value / totalBurgers) * 100);
  return t('wrapped.typesCopyDominant', {
    type: topType.label,
    count: topType.value,
    percentage,
  });
}

function getEntryName(entry: WrappedEntryRow | null, fallback: string) {
  if (!entry) return fallback;
  return entry.burger?.name ?? entry.restaurant?.name ?? fallback;
}

function getEntryRestaurant(entry: WrappedEntryRow | null, t: TFunction) {
  if (!entry) return '';
  return entry.burger_origin === 'homemade'
    ? t('wrapped.favoriteHomemade')
    : entry.restaurant?.name ?? t('wrapped.favoriteUnknownRestaurant');
}

function formatMonthValue(monthValue: string, locale: string | undefined) {
  const [yearText, monthText] = monthValue.split('-');
  const date = new Date(Number(yearText), Number(monthText) - 1, 1);
  if (Number.isNaN(date.getTime())) return monthValue;
  return date.toLocaleString(locale, { month: 'long' });
}

export function WrappedPreviewPage({ session }: Readonly<WrappedPreviewPageProps>) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currency, language, formatCurrency, convertAmount } = usePreferences();
  const [entries, setEntries] = useState<WrappedEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const year = new Date().getFullYear();

  useEffect(() => {
    let cancelled = false;

    const loadEntries = async () => {
      setLoading(true);
      setError(null);

      const from = `${year}-01-01`;
      const to = `${year + 1}-01-01`;
      const query = whereNotDeleted(
        supabase
          .from('entries')
          .select(`
            id,
            datetime,
            rating,
            price,
            currency,
            photo_url,
            additional_notes,
            is_burger,
            burger_origin,
            meat_type,
            restaurant_id,
            restaurant:restaurants ( name ),
            burger:burgers ( name, meat_type )
          `)
          .eq('user_id', session.user.id)
          .gte('datetime', from)
          .lt('datetime', to)
      );
      const { data, error: entriesError } = await query;

      if (cancelled) return;

      if (entriesError) {
        setEntries([]);
        setError(entriesError.message);
      } else {
        setEntries((data ?? []) as unknown as WrappedEntryRow[]);
      }
      setLoading(false);
    };

    void loadEntries();

    return () => {
      cancelled = true;
    };
  }, [session.user.id, year]);

  const stats = useMemo(
    () => loading ? emptyStats : buildWrappedStats(entries, convertAmount, currency),
    [convertAmount, currency, entries, loading]
  );

  const typeRows = useMemo(() => {
    const rows = [
      { key: 'beef' as const, label: t('wrapped.typeBeef'), icon: '/meat.png', value: stats.types.beef },
      { key: 'chicken' as const, label: t('wrapped.typeChicken'), icon: '/chicken-leg.png', value: stats.types.chicken },
      { key: 'vegan' as const, label: t('wrapped.typeVegan'), icon: '/plant.png', value: stats.types.vegan },
      { key: 'other' as const, label: t('wrapped.typeOther'), icon: '/question-mark.png', value: stats.types.other },
    ];
    return rows.sort((a, b) => b.value - a.value);
  }, [stats.types, t]);

  const wrappedCopy = useMemo(() => {
    const spent = formatCurrency(stats.totalSpent, { fromCurrency: currency, toCurrency: currency });
    return {
      burgers: getBurgerIntroCopy(stats.totalBurgers, year, t),
      spent: t(getSpentCopyKey(stats.totalSpent), { amount: spent }),
      types: getTypeCopy(typeRows, stats.totalBurgers, t),
    };
  }, [currency, formatCurrency, stats.totalBurgers, stats.totalSpent, t, typeRows, year]);

  const favoriteEntry = stats.favoriteEntry;
  const favoriteName = getEntryName(favoriteEntry, t('wrapped.favoriteUnknown'));
  const favoriteRestaurant = getEntryRestaurant(favoriteEntry, t);
  const favoriteDate = favoriteEntry
    ? new Date(favoriteEntry.datetime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
  const mostExpensiveEntry = stats.mostExpensiveEntry;
  const mostExpensiveName = getEntryName(mostExpensiveEntry, t('wrapped.favoriteUnknown'));
  const worstEntry = stats.worstEntry;
  const worstName = getEntryName(worstEntry, t('wrapped.favoriteUnknown'));
  const monthHighlightLabel = stats.monthHighlight
    ? formatMonthValue(stats.monthHighlight.monthValue, language)
    : null;
  const topType = typeRows.find((row) => row.value > 0) ?? null;
  const summaryPhotos = stats.topRatedEntries
    .map((entry) => entry.photo_url)
    .filter(Boolean)
    .slice(0, 5) as string[];
  const summaryTopBurgers = stats.topRatedEntries.map((entry) => ({
    id: entry.id,
    name: entry.burger?.name ?? entry.restaurant?.name ?? t('wrapped.favoriteUnknown'),
  }));
  const summarySpent = formatCurrency(stats.totalSpent, { fromCurrency: currency, toCurrency: currency });

  const slides = useMemo(
    () => {
      const nextSlides = [
        { id: 'burgers', tone: 'coral' },
        { id: 'favorite', tone: 'gold' },
        { id: 'spent', tone: 'mint' },
      ];
      if (stats.restaurantHighlight) nextSlides.push({ id: 'restaurant', tone: 'ink' });
      if (stats.monthHighlight) nextSlides.push({ id: 'month', tone: 'coral' });
      if (stats.mostExpensiveEntry) nextSlides.push({ id: 'expensive', tone: 'mint' });
      if (stats.worstEntry) nextSlides.push({ id: 'worst', tone: 'ink' });
      nextSlides.push(
        { id: 'discovered', tone: 'gold' },
        { id: 'origin', tone: 'coral' },
        { id: 'hall', tone: 'ink' },
        { id: 'summary', tone: 'paper' },
      );
      return nextSlides;
    },
    [stats.monthHighlight, stats.mostExpensiveEntry, stats.restaurantHighlight, stats.worstEntry]
  );

  useEffect(() => {
    if (slides[activeIndex]?.id === 'summary') return;
    const timeoutId = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, SLIDE_DURATION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [activeIndex, slides]);

  const goPrevious = () => setActiveIndex((current) => current === 0 ? slides.length - 1 : current - 1);
  const goNext = () => setActiveIndex((current) => current === slides.length - 1 ? current : current + 1);
  const activeSlide = slides[activeIndex];
  const isFinalSlide = activeSlide.id === 'summary';
  const animatedSpent = useAnimatedNumber(stats.totalSpent);
  const maxTypeCount = Math.max(...typeRows.map((row) => row.value), 1);

  return (
    <main className={`bw-wrapped-page bw-wrapped-tone-${activeSlide.tone}`}>
      <div className="bw-wrapped-progress" aria-hidden="true">
        {slides.map((slide, index) => (
          <span key={slide.id} className="bw-wrapped-progress-track">
            <span
              className={`bw-wrapped-progress-fill ${index < activeIndex || (index === activeIndex && isFinalSlide) ? 'is-complete' : ''} ${index === activeIndex && !isFinalSlide ? 'is-active' : ''}`}
              style={index === activeIndex && !isFinalSlide ? { animationDuration: `${SLIDE_DURATION_MS}ms` } : undefined}
            />
          </span>
        ))}
      </div>

      <button
        type="button"
        className="bw-wrapped-close"
        onClick={() => navigate('/')}
        aria-label={t('wrapped.close')}
      >
        <Close />
      </button>

      <button
        type="button"
        className="bw-wrapped-nav-zone is-left"
        onClick={goPrevious}
        aria-label={t('wrapped.previous')}
      >
        <ArrowBackIosNew />
      </button>
      <button
        type="button"
        className="bw-wrapped-nav-zone is-right"
        onClick={goNext}
        aria-label={t('wrapped.next')}
      >
        <ArrowForwardIos />
      </button>

      <section key={activeSlide.id} className="bw-wrapped-slide">
        {activeSlide.id === 'burgers' && (
          <>
            <span className="bw-wrapped-kicker">{t('wrapped.burgersKicker', { year })}</span>
            <div className="bw-wrapped-icon-orbit">
              <LunchDining />
            </div>
            {stats.totalBurgers > 0 ? (
              <h1 className="bw-wrapped-burger-suspense" aria-label={wrappedCopy.burgers}>
                <span>{t('wrapped.burgersIntroBefore', { year })}</span>
                <strong>{stats.totalBurgers}</strong>
                <span>{t('wrapped.burgersIntroAfter')}</span>
              </h1>
            ) : (
              <h1 className="bw-wrapped-statement">{wrappedCopy.burgers}</h1>
            )}
          </>
        )}

        {activeSlide.id === 'favorite' && (
          <>
            <span className="bw-wrapped-kicker">{t('wrapped.favoriteKicker')}</span>
            <h1 className="bw-wrapped-title is-compact">{t('wrapped.favoriteTitle')}</h1>
            {favoriteEntry ? (
              <article className="bw-wrapped-post-card">
                {favoriteEntry.photo_url ? (
                  <img src={favoriteEntry.photo_url} alt={favoriteName} className="bw-wrapped-post-photo" />
                ) : (
                  <div className="bw-wrapped-post-photo is-empty">
                    <LunchDining />
                  </div>
                )}
                <div className="bw-wrapped-post-body">
                  <div>
                    <h2 className="bw-wrapped-post-title">{favoriteName}</h2>
                    <p className="bw-wrapped-post-restaurant">{favoriteRestaurant}</p>
                  </div>
                  <div className="bw-wrapped-post-meta">
                    <span><Star fontSize="small" /> {favoriteEntry.rating?.toFixed(1)}</span>
                    {favoriteDate && <span><CalendarToday fontSize="small" /> {favoriteDate}</span>}
                  </div>
                  {favoriteEntry.additional_notes && (
                    <p className="bw-wrapped-post-notes">{favoriteEntry.additional_notes}</p>
                  )}
                </div>
              </article>
            ) : (
              <p className="bw-wrapped-copy">{t('wrapped.favoriteEmpty')}</p>
            )}
          </>
        )}

        {activeSlide.id === 'restaurant' && stats.restaurantHighlight && (
          <>
            <span className="bw-wrapped-kicker">{t('wrapped.restaurantKicker')}</span>
            <div className="bw-wrapped-icon-orbit">
              <LocalDining />
            </div>
            <h1 className="bw-wrapped-title is-compact">{t('wrapped.restaurantTitle')}</h1>
            <div className="bw-wrapped-feature-list">
              {stats.restaurantHighlight.names.map((name) => (
                <strong key={name}>{name}</strong>
              ))}
            </div>
            <p className="bw-wrapped-copy">
              {t('wrapped.restaurantCopy', { count: stats.restaurantHighlight.count })}
            </p>
          </>
        )}

        {activeSlide.id === 'month' && stats.monthHighlight && monthHighlightLabel && (
          <>
            <span className="bw-wrapped-kicker">{t('wrapped.monthKicker')}</span>
            <div className="bw-wrapped-icon-orbit">
              <CalendarToday />
            </div>
            <h1 className="bw-wrapped-title is-compact">{monthHighlightLabel}</h1>
            <strong className="bw-wrapped-number">{stats.monthHighlight.count}</strong>
            <p className="bw-wrapped-copy">
              {t('wrapped.monthCopy', { count: stats.monthHighlight.count })}
            </p>
          </>
        )}

        {activeSlide.id === 'expensive' && mostExpensiveEntry && (
          <>
            <span className="bw-wrapped-kicker">{t('wrapped.expensiveKicker')}</span>
            <h1 className="bw-wrapped-title is-compact">{t('wrapped.expensiveTitle')}</h1>
            <article className="bw-wrapped-post-card">
              {mostExpensiveEntry.photo_url ? (
                <img src={mostExpensiveEntry.photo_url} alt={mostExpensiveName} className="bw-wrapped-post-photo" />
              ) : (
                <div className="bw-wrapped-post-photo is-empty"><LunchDining /></div>
              )}
              <div className="bw-wrapped-post-body">
                <h2 className="bw-wrapped-post-title">{mostExpensiveName}</h2>
                <p className="bw-wrapped-post-restaurant">{getEntryRestaurant(mostExpensiveEntry, t)}</p>
                <strong className="bw-wrapped-post-price">
                  {formatCurrency(mostExpensiveEntry.price ?? 0, { fromCurrency: mostExpensiveEntry.currency ?? 'EUR', toCurrency: currency })}
                </strong>
              </div>
            </article>
          </>
        )}

        {activeSlide.id === 'worst' && worstEntry && (
          <>
            <span className="bw-wrapped-kicker">{t('wrapped.worstKicker')}</span>
            <h1 className="bw-wrapped-title is-compact">{t('wrapped.worstTitle')}</h1>
            <article className="bw-wrapped-post-card">
              {worstEntry.photo_url ? (
                <img src={worstEntry.photo_url} alt={worstName} className="bw-wrapped-post-photo" />
              ) : (
                <div className="bw-wrapped-post-photo is-empty"><LunchDining /></div>
              )}
              <div className="bw-wrapped-post-body">
                <h2 className="bw-wrapped-post-title">{worstName}</h2>
                <p className="bw-wrapped-post-restaurant">{getEntryRestaurant(worstEntry, t)}</p>
                <div className="bw-wrapped-post-meta">
                  <span><Star fontSize="small" /> {worstEntry.rating?.toFixed(1)}</span>
                </div>
              </div>
            </article>
          </>
        )}

        {activeSlide.id === 'spent' && (
          <>
            <span className="bw-wrapped-kicker">{t('wrapped.spentKicker')}</span>
            <div className="bw-wrapped-icon-orbit">
              <Euro />
            </div>
            <h1 className="bw-wrapped-title">{t('wrapped.spentTitle')}</h1>
            <strong className="bw-wrapped-money">
              {formatCurrency(animatedSpent, { fromCurrency: currency, toCurrency: currency })}
            </strong>
            <p className="bw-wrapped-copy">{wrappedCopy.spent}</p>
          </>
        )}

        {activeSlide.id === 'types' && (
          <>
            <span className="bw-wrapped-kicker">{t('wrapped.typesKicker')}</span>
            <div className="bw-wrapped-icon-orbit">
              <LocalDining />
            </div>
            <h1 className="bw-wrapped-title">{t('wrapped.typesTitle')}</h1>
            <div className="bw-wrapped-type-list">
              {typeRows.map((row, index) => (
                <div className="bw-wrapped-type-row" key={row.key} style={{ animationDelay: `${index * 120}ms` }}>
                  <img src={row.icon} alt="" className="bw-wrapped-type-icon" />
                  <span className="bw-wrapped-type-name">{row.label}</span>
                  <span className="bw-wrapped-type-bar">
                    <span style={{ width: `${Math.max((row.value / maxTypeCount) * 100, row.value ? 12 : 0)}%` }} />
                  </span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
            <p className="bw-wrapped-copy">{wrappedCopy.types}</p>
          </>
        )}

        {activeSlide.id === 'discovered' && (
          <>
            <span className="bw-wrapped-kicker">{t('wrapped.discoveredKicker')}</span>
            <div className="bw-wrapped-icon-orbit">
              <LocalDining />
            </div>
            <h1 className="bw-wrapped-title is-compact">{t('wrapped.discoveredTitle')}</h1>
            <strong className="bw-wrapped-number">{stats.discoveredRestaurants}</strong>
            <p className="bw-wrapped-copy">
              {t('wrapped.discoveredCopy', { count: stats.discoveredRestaurants })}
            </p>
          </>
        )}

        {activeSlide.id === 'origin' && (
          <>
            <span className="bw-wrapped-kicker">{t('wrapped.originKicker')}</span>
            <h1 className="bw-wrapped-title is-compact">{t('wrapped.originTitle')}</h1>
            <div className="bw-wrapped-origin-grid">
              <div>
                <span>{t('wrapped.originRestaurant')}</span>
                <strong>{stats.restaurantBurgers}</strong>
              </div>
              <div>
                <span>{t('wrapped.originHomemade')}</span>
                <strong>{stats.homemadeBurgers}</strong>
              </div>
            </div>
          </>
        )}

        {activeSlide.id === 'hall' && (
          <>
            <span className="bw-wrapped-kicker">{t('wrapped.hallKicker')}</span>
            <h1 className="bw-wrapped-title is-compact">{t('wrapped.hallTitle')}</h1>
            <ol className="bw-wrapped-hall-list">
              {summaryTopBurgers.length ? summaryTopBurgers.map((burger, index) => (
                <li key={burger.id}>
                  <span>{index + 1}</span>
                  <strong>{burger.name}</strong>
                </li>
              )) : (
                <li>
                  <span>-</span>
                  <strong>{t('wrapped.summaryNoBurgers')}</strong>
                </li>
              )}
            </ol>
          </>
        )}

        {activeSlide.id === 'summary' && (
          <article className="bw-wrapped-summary-card" aria-label={t('wrapped.summaryTitle', { year })}>
            <div className="bw-wrapped-summary-pattern" aria-hidden="true">
              <span>2026</span>
              <span>BURGERS</span>
            </div>
            <div className="bw-wrapped-summary-collage" aria-hidden="true">
              {summaryPhotos.length ? (
                summaryPhotos.map((photoUrl, index) => (
                  <img
                    key={`${photoUrl}-${index}`}
                    src={photoUrl}
                    alt=""
                    className={`bw-wrapped-summary-photo is-${index + 1}`}
                  />
                ))
              ) : (
                <div className="bw-wrapped-summary-photo is-empty">
                  <LunchDining />
                </div>
              )}
            </div>

            <div className="bw-wrapped-summary-content">
              <div className="bw-wrapped-summary-brand">
                <span>{t('wrapped.summaryEyebrow')}</span>
                <strong>{t('wrapped.summaryTitle', { year })}</strong>
              </div>

              <div className="bw-wrapped-summary-grid">
                <section>
                  <h2>{t('wrapped.summaryTopBurgers')}</h2>
                  <ol className="bw-wrapped-summary-list">
                    {summaryTopBurgers.length ? summaryTopBurgers.map((burger, index) => (
                      <li key={burger.id}>
                        <span>{index + 1}</span>
                        <strong>{burger.name}</strong>
                      </li>
                    )) : (
                      <li>
                        <span>-</span>
                        <strong>{t('wrapped.summaryNoBurgers')}</strong>
                      </li>
                    )}
                  </ol>
                </section>

                <section>
                  <h2>{t('wrapped.summaryNumbers')}</h2>
                  <div className="bw-wrapped-summary-metrics">
                    <div>
                      <span>{t('wrapped.summaryBurgers')}</span>
                      <strong>{stats.totalBurgers}</strong>
                    </div>
                    <div>
                      <span>{t('wrapped.summarySpent')}</span>
                      <strong>{summarySpent}</strong>
                    </div>
                    <div>
                      <span>{t('wrapped.summaryTopType')}</span>
                      <strong>{topType?.label ?? '-'}</strong>
                    </div>
                    <div>
                      <span>{t('wrapped.summaryRestaurants')}</span>
                      <strong>{stats.discoveredRestaurants}</strong>
                    </div>
                    <div>
                      <span>{t('wrapped.summaryOrigin')}</span>
                      <strong>{stats.restaurantBurgers}/{stats.homemadeBurgers}</strong>
                    </div>
                    <div>
                      <span>{t('wrapped.summaryFavorite')}</span>
                      <strong>{favoriteEntry ? favoriteName : '-'}</strong>
                    </div>
                  </div>
                </section>
              </div>

              <footer className="bw-wrapped-summary-footer">
                <span>BURGER-WRAPPED</span>
                <span>{t('wrapped.summaryShareHint')}</span>
              </footer>
            </div>
          </article>
        )}

        {loading && <p className="bw-wrapped-status">{t('wrapped.loading')}</p>}
        {error && <p className="bw-wrapped-status is-error">{t('wrapped.error')}</p>}
      </section>
    </main>
  );
}
