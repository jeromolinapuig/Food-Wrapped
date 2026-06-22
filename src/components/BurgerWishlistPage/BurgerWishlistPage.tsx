import { startTransition, useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Close } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabaseClient';
import { AppShell } from '../common/AppShell';
import { BackButton } from '../common/BackButton';
import { PageHeader } from '../common/PageHeader';
import { ZoomableImage } from '../common/ZoomableImage';
import { TriedBurgerModal } from '../FeedTabs/TriedBurgerModal';
import type { FeedEntry } from '../FeedTabs/types';
import '../../styles/layout.css';
import '../../styles/shared.css';
import './BurgerWishlistPage.css';

type BurgerWishlistPageProps = {
  session: Session | null;
  onBack: () => void;
};

type WishlistRow = {
  id: string;
  restaurant_id: string;
  burger_id: string;
  source_entry_id: string | null;
  currency: string | null;
  photo_url: string | null;
  created_at: string | null;
  restaurants: { name: string | null } | { name: string | null }[] | null;
  burgers: { name: string | null; meat_type: FeedEntry['meatType'] } | { name: string | null; meat_type: FeedEntry['meatType'] }[] | null;
};

type WishlistItem = {
  id: string;
  entry: FeedEntry;
  createdAt: string | null;
};

const firstRelation = <T,>(value: T | T[] | null): T | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

export function BurgerWishlistPage({ session, onBack }: Readonly<BurgerWishlistPageProps>) {
  const { t } = useTranslation();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triedEntry, setTriedEntry] = useState<FeedEntry | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<{ src: string; alt: string } | null>(null);

  const loadItems = useCallback(async () => {
    if (!session) {
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const { data, error: loadError } = await supabase
      .from('burger_wishlist')
      .select(`
        id,
        restaurant_id,
        burger_id,
        source_entry_id,
        currency,
        photo_url,
        created_at,
        restaurants ( name ),
        burgers ( name, meat_type )
      `)
      .eq('user_id', session.user.id)
      .eq('status', 'want_to_try')
      .order('created_at', { ascending: false });

    if (loadError) {
      setError(loadError.message);
      setItems([]);
      setLoading(false);
      return;
    }

    const mapped: WishlistItem[] = ((data ?? []) as WishlistRow[]).map((row) => {
      const restaurant = firstRelation(row.restaurants);
      const burger = firstRelation(row.burgers);
      return {
        id: row.id,
        createdAt: row.created_at,
        entry: {
          id: row.source_entry_id ?? '',
          userId: '',
          username: '',
          displayName: null,
          avatarUrl: null,
          avatarFrame: null,
          datetime: row.created_at ?? new Date().toISOString(),
          price: 0,
          currency: row.currency ?? 'EUR',
          rating: 0,
          isBurger: true,
          additionalNotes: null,
          restaurantId: row.restaurant_id,
          burgerId: row.burger_id,
          meatType: burger?.meat_type ?? null,
          restaurantName: restaurant?.name ?? t('burgerWishlist.unknownRestaurant'),
          burgerName: burger?.name ?? t('burgerWishlist.unknownBurger'),
          photoUrl: row.photo_url,
          burgerOrigin: 'restaurant' as const,
          ingredients: null,
        },
      };
    });

    setItems(mapped);
    setLoading(false);
  }, [session, t]);

  useEffect(() => {
    startTransition(() => {
      void loadItems();
    });
  }, [loadItems]);

  useEffect(() => {
    const handleUpdated = () => loadItems();
    window.addEventListener('bw-burger-wishlist-updated', handleUpdated);
    return () => window.removeEventListener('bw-burger-wishlist-updated', handleUpdated);
  }, [loadItems]);

  const handleRemove = async (item: WishlistItem) => {
    if (!session) return;
    const { error: removeError } = await supabase
      .from('burger_wishlist')
      .delete()
      .eq('user_id', session.user.id)
      .eq('restaurant_id', item.entry.restaurantId)
      .eq('burger_id', item.entry.burgerId)
      .eq('status', 'want_to_try');

    if (removeError) {
      setError(removeError.message);
      return;
    }

    window.dispatchEvent(new CustomEvent('bw-burger-wishlist-updated'));
    await loadItems();
  };

  const handleSaveTried = async (value: {
    entry: FeedEntry;
    rating: number;
  }) => {
    if (!session || !value.entry.restaurantId || !value.entry.burgerId) return;
    const { error: saveError } = await supabase
      .from('burger_wishlist')
      .upsert(
        {
          user_id: session.user.id,
          restaurant_id: value.entry.restaurantId,
          burger_id: value.entry.burgerId,
          source_entry_id: value.entry.id || null,
          status: 'tried',
          rating: value.rating,
          currency: value.entry.currency ?? 'EUR',
          photo_url: value.entry.photoUrl,
          tried_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,restaurant_id,burger_id' }
      );

    if (saveError) {
      setError(saveError.message);
      return;
    }

    window.dispatchEvent(new CustomEvent('bw-burger-wishlist-updated'));
    await loadItems();
  };

  return (
    <AppShell>
      <PageHeader
        title={t('burgerWishlist.pageTitle')}
        subtitle={t('burgerWishlist.pageSubtitle')}
        leading={<BackButton onClick={onBack} ariaLabel={t('common.back', { defaultValue: 'Back' })} />}
      />

      <main className="bw-main">
        {loading && <p className="bw-helper">{t('burgerWishlist.loading')}</p>}
        {error && <p className="bw-helper bw-error-text">{error}</p>}
        {!loading && !error && items.length === 0 && (
          <section className="bw-card">
            <p className="bw-helper">{t('burgerWishlist.empty')}</p>
          </section>
        )}
        {!loading && items.length > 0 && (
          <section className="bw-wishlist-list">
            {items.map((item) => (
              <article className="bw-card bw-wishlist-card" key={item.id}>
                <div className="bw-wishlist-card-header">
                  <div>
                    <h2 className="bw-wishlist-title">{item.entry.restaurantName}</h2>
                    <div className="bw-wishlist-burger">{item.entry.burgerName}</div>
                  </div>
                  {item.createdAt && (
                    <div className="bw-wishlist-meta">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
                {item.entry.photoUrl ? (
                  <button
                    type="button"
                    className="bw-wishlist-photo"
                    onClick={() => item.entry.photoUrl && setSelectedPhoto({
                      src: item.entry.photoUrl,
                      alt: item.entry.burgerName ?? item.entry.restaurantName ?? '',
                    })}
                    aria-label={t('common.viewPhoto')}
                  >
                    <img src={item.entry.photoUrl} alt={item.entry.burgerName ?? item.entry.restaurantName ?? ''} loading="lazy" />
                  </button>
                ) : (
                  <div className="bw-wishlist-photo is-empty">
                    {t('myTopBurgers.noPhoto', { defaultValue: 'No photo' })}
                  </div>
                )}
                <div className="bw-wishlist-actions">
                  <button type="button" className="bw-btn bw-btn-ghost" onClick={() => void handleRemove(item)}>
                    {t('burgerWishlist.remove')}
                  </button>
                  <button type="button" className="bw-btn bw-btn-primary" onClick={() => setTriedEntry(item.entry)}>
                    {t('burgerWishlist.triedAction')}
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>

      <TriedBurgerModal
        open={Boolean(triedEntry)}
        entry={triedEntry}
        onClose={() => setTriedEntry(null)}
        onSave={handleSaveTried}
      />

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
              <Close fontSize="small" />
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
