import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Euro, Star } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabaseClient';
import { AppShell } from '../common/AppShell';
import { PageHeader } from '../common/PageHeader';
import { ZoomableImage } from '../common/ZoomableImage';
import '../../styles/layout.css';
import '../../styles/shared.css';
import './MyTopBurgersPage.css';

type SortBy = 'rating' | 'price';
type SortDirection = 'asc' | 'desc';

type BurgerRow = {
  id: string;
  datetime: string;
  rating: number | null;
  price: number | null;
  currency?: string | null;
  photo_url: string | null;
  restaurant: { name: string | null } | null;
  burger: { name: string | null } | null;
};

type RawBurgerRow = {
  id: string;
  datetime: string;
  rating: number | null;
  price: number | null;
  currency?: string | null;
  photo_url: string | null;
  restaurant: { name: string | null } | { name: string | null }[] | null;
  burger: { name: string | null } | { name: string | null }[] | null;
};

type BurgerSummary = {
  key: string;
  burgerName: string;
  count: number;
  lastDatetime: string;
  rating: number | null;
  price: number | null;
  currency: string | null;
  photoUrl: string | null;
};

type RestaurantGroup = {
  restaurantName: string;
  burgers: BurgerSummary[];
};

type MyTopBurgersPageProps = {
  session: Session;
};

const formatPrice = (value: number | null, currency: string | null | undefined) => {
  if (value == null) return '-';
  const safeCurrency = currency ?? 'EUR';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: safeCurrency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${safeCurrency}`;
  }
};

const firstRelation = <T,>(value: T | T[] | null): T | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

const sortMetricValue = (burger: BurgerSummary, sortBy: SortBy) =>
  sortBy === 'rating' ? burger.rating : burger.price;

export function MyTopBurgersPage({ session }: Readonly<MyTopBurgersPageProps>) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('rating');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [rows, setRows] = useState<BurgerRow[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('entries')
        .select(
          `
            id,
            datetime,
            rating,
            price,
            currency,
            photo_url,
            restaurant:restaurants ( name ),
            burger:burgers ( name )
          `
        )
        .eq('user_id', session.user.id)
        .eq('is_burger', true)
        .eq('burger_origin', 'restaurant')
        .not('restaurant_id', 'is', null);

      if (cancelled) return;

      if (error) {
        setError(error.message);
        setRows([]);
      } else {
        const normalized = ((data ?? []) as RawBurgerRow[]).map((row) => ({
          id: row.id,
          datetime: row.datetime,
          rating: row.rating,
          price: row.price,
          currency: row.currency ?? null,
          photo_url: row.photo_url,
          restaurant: firstRelation(row.restaurant),
          burger: firstRelation(row.burger),
        }));
        setRows(normalized);
      }

      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [session.user.id]);

  useEffect(() => {
    if (!selectedPhoto) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedPhoto(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedPhoto]);

  const grouped = useMemo(() => {
    const byRestaurant = new Map<string, BurgerRow[]>();
    const compareMetric = (aValue: number | null, bValue: number | null) => {
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    };

    rows.forEach((row) => {
      const restaurantName = row.restaurant?.name?.trim() || t('myTopBurgers.unknownRestaurant');
      const bucket = byRestaurant.get(restaurantName) ?? [];
      bucket.push(row);
      byRestaurant.set(restaurantName, bucket);
    });

    const groups: RestaurantGroup[] = Array.from(byRestaurant.entries()).map(([restaurantName, burgers]) => {
      const byBurger = new Map<
        string,
        {
          burgerName: string;
          count: number;
          lastTs: number;
          lastDatetime: string;
          ratingSum: number;
          ratingCount: number;
          priceSum: number;
          priceCount: number;
          currency: string | null;
          photoUrl: string | null;
          photoTs: number;
        }
      >();

      burgers.forEach((entry) => {
        const burgerName = entry.burger?.name?.trim() || t('myTopBurgers.unknownBurger');
        const key = burgerName.toLowerCase();
        const ts = new Date(entry.datetime).getTime();

        const current = byBurger.get(key) ?? {
          burgerName,
          count: 0,
          lastTs: -Infinity,
          lastDatetime: entry.datetime,
          ratingSum: 0,
          ratingCount: 0,
          priceSum: 0,
          priceCount: 0,
          currency: entry.currency ?? null,
          photoUrl: null,
          photoTs: -Infinity,
        };

        current.count += 1;
        if (entry.rating != null) {
          current.ratingSum += entry.rating;
          current.ratingCount += 1;
        }
        if (entry.price != null) {
          current.priceSum += entry.price;
          current.priceCount += 1;
          current.currency = entry.currency ?? current.currency;
        }
        if (ts >= current.lastTs) {
          current.lastTs = ts;
          current.lastDatetime = entry.datetime;
        }
        if (entry.photo_url && ts >= current.photoTs) {
          current.photoTs = ts;
          current.photoUrl = entry.photo_url;
        }

        byBurger.set(key, current);
      });

      const summarized: BurgerSummary[] = Array.from(byBurger.entries()).map(([key, value]) => ({
        key,
        burgerName: value.burgerName,
        count: value.count,
        lastDatetime: value.lastDatetime,
        rating: value.ratingCount ? value.ratingSum / value.ratingCount : null,
        price: value.priceCount ? value.priceSum / value.priceCount : null,
        currency: value.currency,
        photoUrl: value.photoUrl,
      }));

      summarized.sort((a, b) => {
        const diff = compareMetric(sortMetricValue(a, sortBy), sortMetricValue(b, sortBy));
        if (diff !== 0) return diff;
        return new Date(b.lastDatetime).getTime() - new Date(a.lastDatetime).getTime();
      });

      return { restaurantName, burgers: summarized };
    });

    return groups.sort((a, b) => {
      const aTop = a.burgers[0] ? sortMetricValue(a.burgers[0], sortBy) : null;
      const bTop = b.burgers[0] ? sortMetricValue(b.burgers[0], sortBy) : null;
      const diff = compareMetric(aTop, bTop);
      if (diff !== 0) return diff;
      return a.restaurantName.localeCompare(b.restaurantName);
    });
  }, [rows, sortBy, sortDirection, t]);

  const handleSortSelect = (next: SortBy) => {
    if (sortBy === next) {
      setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setSortBy(next);
    setSortDirection('desc');
  };

  return (
    <AppShell>
      <PageHeader
        title={t('myTopBurgers.title')}
        subtitle={t('myTopBurgers.subtitle')}
      />

      <main className="bw-main">
        <section className="bw-top-burgers-sort-grid" aria-label={t('myTopBurgers.sortLabel')}>
          <button
            type="button"
            className={`bw-top-burgers-sort-card ${sortBy === 'rating' ? 'is-active' : ''}`}
            onClick={() => handleSortSelect('rating')}
          >
            <Star fontSize="small" />
            <span>{t('myTopBurgers.sortRating')}</span>
            {sortBy === 'rating' && (
              <span className="bw-top-burgers-sort-arrow" aria-hidden="true">{sortDirection === 'desc' ? '↓' : '↑'}</span>
            )}
          </button>
          <button
            type="button"
            className={`bw-top-burgers-sort-card ${sortBy === 'price' ? 'is-active' : ''}`}
            onClick={() => handleSortSelect('price')}
          >
            <Euro fontSize="small" />
            <span>{t('myTopBurgers.sortPrice')}</span>
            {sortBy === 'price' && (
              <span className="bw-top-burgers-sort-arrow" aria-hidden="true">{sortDirection === 'desc' ? '↓' : '↑'}</span>
            )}
          </button>
        </section>

        {loading && <p className="bw-helper">{t('myTopBurgers.loading')}</p>}
        {error && <p className="bw-top-burgers-error">{error}</p>}

        {!loading && !error && grouped.length === 0 && (
          <section className="bw-card">
            <p className="bw-helper">{t('myTopBurgers.empty')}</p>
          </section>
        )}

        {!loading && !error && grouped.length > 0 && (
          <section className="bw-top-burgers-list">
            {grouped.map((group) => (
              <article className="bw-card bw-top-burgers-group" key={group.restaurantName}>
                <div className="bw-top-burgers-group-header">
                  <h2 className="bw-top-burgers-restaurant">{group.restaurantName}</h2>
                </div>

                <div className="bw-top-burgers-grid">
                  {group.burgers.map((burger) => {
                    const hasPhoto = Boolean(burger.photoUrl);
                    const eatenTimesText = burger.count === 1
                      ? t('myTopBurgers.eatenOneTime')
                      : t('myTopBurgers.eatenManyTimes', { count: burger.count });
                    const lastDateText = t('myTopBurgers.lastEaten', {
                      date: new Date(burger.lastDatetime).toLocaleDateString(),
                    });

                    return (
                      <button
                        type="button"
                        key={burger.key}
                        className={`bw-top-burgers-item ${hasPhoto ? 'is-clickable' : 'is-disabled'}`}
                        disabled={!hasPhoto}
                        onClick={() => {
                          if (!burger.photoUrl) return;
                          setSelectedPhoto({ src: burger.photoUrl, alt: burger.burgerName });
                        }}
                      >
                        <div className={`bw-top-burgers-item-main ${hasPhoto ? 'has-thumb' : 'no-thumb'}`}>
                          {hasPhoto && (
                            <div className="bw-top-burgers-thumb">
                              <img src={burger.photoUrl ?? ''} alt={burger.burgerName} />
                            </div>
                          )}

                          <div className="bw-top-burgers-item-content">
                            <div className="bw-top-burgers-item-title">{burger.burgerName}</div>
                            <div className="bw-top-burgers-item-meta">
                              <span>{t('myTopBurgers.rating')}: {burger.rating != null ? burger.rating.toFixed(1) : '-'}</span>
                              <span>{t('myTopBurgers.price')}: {formatPrice(burger.price, burger.currency)}</span>
                            </div>
                            <div className="bw-top-burgers-item-date">{lastDateText}</div>
                            <div className="bw-top-burgers-item-times">{eatenTimesText}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </article>
            ))}
          </section>
        )}
      </main>

      {selectedPhoto && (
        <div className="bw-photo-viewer-backdrop" onClick={() => setSelectedPhoto(null)}>
          <div className="bw-photo-viewer" onClick={(event) => event.stopPropagation()}>
            <ZoomableImage src={selectedPhoto.src} alt={selectedPhoto.alt} />
            <button
              type="button"
              className="bw-photo-viewer-close"
              aria-label={t('common.close')}
              onClick={() => setSelectedPhoto(null)}
            >
              x
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
