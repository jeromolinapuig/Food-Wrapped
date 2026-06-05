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
  restaurant: { name: string } | null;
  burger: { name: string | null; meat_type: MeatType | null } | null;
};

type WrappedStats = {
  totalBurgers: number;
  totalSpent: number;
  types: Record<MeatType, number>;
  favoriteEntry: WrappedEntryRow | null;
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
  types: {
    beef: 0,
    chicken: 0,
    vegan: 0,
    other: 0,
  },
};

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
  const stats = entries.reduce<WrappedStats>((acc, entry) => {
    if (entry.price != null) {
      acc.totalSpent += convertAmount(entry.price, entry.currency ?? 'EUR', targetCurrency);
    }

    if (!entry.is_burger) return acc;

    acc.totalBurgers += 1;
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
    types: {
      beef: 0,
      chicken: 0,
      vegan: 0,
      other: 0,
    },
  });

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

export function WrappedPreviewPage({ session }: Readonly<WrappedPreviewPageProps>) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currency, formatCurrency, convertAmount } = usePreferences();
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
  }, [currency, formatCurrency, stats.favoriteEntry, stats.totalBurgers, stats.totalSpent, t, typeRows, year]);

  const favoriteEntry = stats.favoriteEntry;
  const favoriteName = favoriteEntry?.burger?.name ?? favoriteEntry?.restaurant?.name ?? t('wrapped.favoriteUnknown');
  const favoriteRestaurant = favoriteEntry?.burger_origin === 'homemade'
    ? t('wrapped.favoriteHomemade')
    : favoriteEntry?.restaurant?.name ?? t('wrapped.favoriteUnknownRestaurant');
  const favoriteDate = favoriteEntry
    ? new Date(favoriteEntry.datetime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const slides = useMemo(
    () => [
      { id: 'burgers', tone: 'coral' },
      { id: 'favorite', tone: 'gold' },
      { id: 'spent', tone: 'mint' },
      { id: 'types', tone: 'ink' },
    ],
    []
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, SLIDE_DURATION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [activeIndex, slides.length]);

  const goPrevious = () => setActiveIndex((current) => current === 0 ? slides.length - 1 : current - 1);
  const goNext = () => setActiveIndex((current) => (current + 1) % slides.length);
  const activeSlide = slides[activeIndex];
  const animatedSpent = useAnimatedNumber(stats.totalSpent);
  const maxTypeCount = Math.max(...typeRows.map((row) => row.value), 1);

  return (
    <main className={`bw-wrapped-page bw-wrapped-tone-${activeSlide.tone}`}>
      <div className="bw-wrapped-progress" aria-hidden="true">
        {slides.map((slide, index) => (
          <span key={slide.id} className="bw-wrapped-progress-track">
            <span
              className={`bw-wrapped-progress-fill ${index < activeIndex ? 'is-complete' : ''} ${index === activeIndex ? 'is-active' : ''}`}
              style={index === activeIndex ? { animationDuration: `${SLIDE_DURATION_MS}ms` } : undefined}
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
                  <button type="button" className="bw-wrapped-post-button" onClick={() => navigate(`/posts/${favoriteEntry.id}`, { state: { returnTo: '/wrapped' } })}>
                    {t('wrapped.favoriteOpenPost')}
                  </button>
                </div>
              </article>
            ) : (
              <p className="bw-wrapped-copy">{t('wrapped.favoriteEmpty')}</p>
            )}
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

        {loading && <p className="bw-wrapped-status">{t('wrapped.loading')}</p>}
        {error && <p className="bw-wrapped-status is-error">{t('wrapped.error')}</p>}
      </section>
    </main>
  );
}
