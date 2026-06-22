import { useCallback, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { FeedEntry } from './types';

export type BurgerWishlistStatus = {
  wanted: boolean;
  tried: boolean;
  rating: number | null;
  canDeleteTried?: boolean;
  hasOwnPost?: boolean;
};

export type TriedBurgerInput = {
  entry: FeedEntry;
  rating: number;
};

type UseBurgerWishlistOptions = {
  viewerId: string | null;
  isReadOnly: boolean;
  onRequireLogin?: () => void;
};

type UseBurgerWishlistResult = {
  burgerStatuses: Record<string, BurgerWishlistStatus>;
  pendingBurgerKeys: Record<string, boolean>;
  getBurgerKey: (entry: FeedEntry) => string | null;
  loadBurgerStatuses: (entries: FeedEntry[]) => Promise<void>;
  toggleWantToTry: (entry: FeedEntry) => Promise<void>;
  saveTriedBurger: (input: TriedBurgerInput) => Promise<void>;
  deleteTriedBurger: (entry: FeedEntry) => Promise<void>;
};

export const getFeedEntryBurgerKey = (entry: FeedEntry) => {
  if (entry.burgerOrigin !== 'restaurant') return null;
  if (!entry.restaurantId || !entry.burgerId) return null;
  return `${entry.restaurantId}:${entry.burgerId}`;
};

export function useBurgerWishlist({
  viewerId,
  isReadOnly,
  onRequireLogin,
}: UseBurgerWishlistOptions): UseBurgerWishlistResult {
  const [burgerStatuses, setBurgerStatuses] = useState<Record<string, BurgerWishlistStatus>>({});
  const [pendingBurgerKeys, setPendingBurgerKeys] = useState<Record<string, boolean>>({});

  const loadBurgerStatuses = useCallback(async (entries: FeedEntry[]) => {
    if (!viewerId) {
      setBurgerStatuses({});
      return;
    }

    const pairs = entries
      .filter((entry) => entry.userId !== viewerId)
      .map((entry) => ({
        key: getFeedEntryBurgerKey(entry),
        restaurantId: entry.restaurantId,
        burgerId: entry.burgerId,
      }))
      .filter((item): item is { key: string; restaurantId: string; burgerId: string } =>
        Boolean(item.key && item.restaurantId && item.burgerId)
      );

    if (!pairs.length) {
      setBurgerStatuses({});
      return;
    }

    const restaurantIds = Array.from(new Set(pairs.map((pair) => pair.restaurantId)));
    const burgerIds = Array.from(new Set(pairs.map((pair) => pair.burgerId)));

    const [wishlistResponse, entriesResponse] = await Promise.all([
      supabase
        .from('burger_wishlist')
        .select('restaurant_id, burger_id, status, rating')
        .eq('user_id', viewerId)
        .in('restaurant_id', restaurantIds)
        .in('burger_id', burgerIds),
      supabase
        .from('entries')
        .select('restaurant_id, burger_id, rating')
        .eq('user_id', viewerId)
        .eq('is_burger', true)
        .eq('burger_origin', 'restaurant')
        .in('restaurant_id', restaurantIds)
        .in('burger_id', burgerIds)
        .is('deleted_at', null),
    ]);

    if (wishlistResponse.error || entriesResponse.error) {
      console.error('Error loading burger wishlist status', wishlistResponse.error ?? entriesResponse.error);
      return;
    }

    const next: Record<string, BurgerWishlistStatus> = {};
    pairs.forEach((pair) => {
      next[pair.key] = { wanted: false, tried: false, rating: null, canDeleteTried: false, hasOwnPost: false };
    });

    (entriesResponse.data ?? []).forEach((row) => {
      const typed = row as {
        restaurant_id: string | null;
        burger_id: string | null;
        rating: number | null;
      };
      if (!typed.restaurant_id || !typed.burger_id) return;
      const key = `${typed.restaurant_id}:${typed.burger_id}`;
      const current = next[key] ?? {
        wanted: false,
        tried: false,
        rating: null,
        canDeleteTried: false,
        hasOwnPost: false,
      };
      next[key] = {
        ...current,
        tried: true,
        rating: current.rating ?? typed.rating ?? null,
        hasOwnPost: true,
      };
    });

    (wishlistResponse.data ?? []).forEach((row) => {
      const typed = row as {
        restaurant_id: string | null;
        burger_id: string | null;
        status: 'want_to_try' | 'tried' | null;
        rating: number | null;
      };
      if (!typed.restaurant_id || !typed.burger_id) return;
      const key = `${typed.restaurant_id}:${typed.burger_id}`;
      const current = next[key] ?? {
        wanted: false,
        tried: false,
        rating: null,
        canDeleteTried: false,
        hasOwnPost: false,
      };
      next[key] = {
        wanted: typed.status === 'want_to_try',
        tried: current.tried || typed.status === 'tried',
        rating: typed.rating ?? current.rating,
        canDeleteTried: typed.status === 'tried',
        hasOwnPost: current.hasOwnPost,
      };
    });

    setBurgerStatuses(next);
  }, [viewerId]);

  const toggleWantToTry = useCallback(async (entry: FeedEntry) => {
    if (isReadOnly || !viewerId) {
      onRequireLogin?.();
      return;
    }
    const key = getFeedEntryBurgerKey(entry);
    if (!key || !entry.restaurantId || !entry.burgerId || pendingBurgerKeys[key]) return;

    const current = burgerStatuses[key] ?? {
      wanted: false,
      tried: false,
      rating: null,
      canDeleteTried: false,
      hasOwnPost: false,
    };
    if (current.tried) return;
    const nextWanted = !current.wanted;

    setBurgerStatuses((prev) => ({
      ...prev,
      [key]: { ...current, wanted: nextWanted },
    }));
    setPendingBurgerKeys((prev) => ({ ...prev, [key]: true }));

    const response = nextWanted
      ? await supabase
          .from('burger_wishlist')
          .upsert(
            {
              user_id: viewerId,
              restaurant_id: entry.restaurantId,
              burger_id: entry.burgerId,
              source_entry_id: entry.id,
              status: 'want_to_try',
              rating: null,
              currency: entry.currency ?? 'EUR',
              photo_url: entry.photoUrl,
              tried_at: null,
            },
            { onConflict: 'user_id,restaurant_id,burger_id' }
          )
      : await supabase
          .from('burger_wishlist')
          .delete()
          .match({
            user_id: viewerId,
            restaurant_id: entry.restaurantId,
            burger_id: entry.burgerId,
            status: 'want_to_try',
          });

    if (response.error) {
      console.error('Error toggling burger wishlist', response.error);
      setBurgerStatuses((prev) => ({ ...prev, [key]: current }));
    } else {
      window.dispatchEvent(new CustomEvent('bw-burger-wishlist-updated'));
    }

    setPendingBurgerKeys((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  }, [burgerStatuses, isReadOnly, onRequireLogin, pendingBurgerKeys, viewerId]);

  const saveTriedBurger = useCallback(async ({
    entry,
    rating,
  }: TriedBurgerInput) => {
    if (isReadOnly || !viewerId) {
      onRequireLogin?.();
      return;
    }
    const key = getFeedEntryBurgerKey(entry);
    if (!key || !entry.restaurantId || !entry.burgerId || pendingBurgerKeys[key]) return;

    setPendingBurgerKeys((prev) => ({ ...prev, [key]: true }));

    const { error } = await supabase
      .from('burger_wishlist')
      .upsert(
        {
          user_id: viewerId,
          restaurant_id: entry.restaurantId,
          burger_id: entry.burgerId,
          source_entry_id: entry.id,
          status: 'tried',
          rating,
          currency: entry.currency ?? 'EUR',
          photo_url: entry.photoUrl,
          tried_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,restaurant_id,burger_id' }
      );

    if (error) {
      console.error('Error saving tried burger', error);
    } else {
      setBurgerStatuses((prev) => ({
        ...prev,
        [key]: { wanted: false, tried: true, rating, canDeleteTried: true, hasOwnPost: false },
      }));
      window.dispatchEvent(new CustomEvent('bw-burger-wishlist-updated'));
    }

    setPendingBurgerKeys((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  }, [isReadOnly, onRequireLogin, pendingBurgerKeys, viewerId]);

  const deleteTriedBurger = useCallback(async (entry: FeedEntry) => {
    if (isReadOnly || !viewerId) {
      onRequireLogin?.();
      return;
    }
    const key = getFeedEntryBurgerKey(entry);
    if (!key || !entry.restaurantId || !entry.burgerId || pendingBurgerKeys[key]) return;

    setPendingBurgerKeys((prev) => ({ ...prev, [key]: true }));
    const { error } = await supabase
      .from('burger_wishlist')
      .delete()
      .match({
        user_id: viewerId,
        restaurant_id: entry.restaurantId,
        burger_id: entry.burgerId,
        status: 'tried',
      });

    if (error) {
      console.error('Error deleting tried burger', error);
    } else {
      setBurgerStatuses((prev) => ({
        ...prev,
        [key]: { wanted: false, tried: false, rating: null, canDeleteTried: false, hasOwnPost: false },
      }));
      window.dispatchEvent(new CustomEvent('bw-burger-wishlist-updated'));
    }

    setPendingBurgerKeys((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  }, [isReadOnly, onRequireLogin, pendingBurgerKeys, viewerId]);

  return {
    burgerStatuses,
    pendingBurgerKeys,
    getBurgerKey: getFeedEntryBurgerKey,
    loadBurgerStatuses,
    toggleWantToTry,
    saveTriedBurger,
    deleteTriedBurger,
  };
}
