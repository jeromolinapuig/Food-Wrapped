import { supabase } from './supabaseClient';

export type BurgerWishlistStatus = {
  wanted: boolean;
  tried: boolean;
  rating: number | null;
  canDeleteTried?: boolean;
  hasOwnPost?: boolean;
};

export type WishlistBurger = { restaurantId: string; burgerId: string };
export type WishlistSource = WishlistBurger & { id: string; photoUrl: string | null; currency?: string | null };

export async function loadBurgerWishlistStatuses(viewerId: string, burgers: WishlistBurger[]) {
  const pairs = burgers.map(burger => ({ ...burger, key: burger.restaurantId + ':' + burger.burgerId }));
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
    throw wishlistResponse.error ?? entriesResponse.error;
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

  return next;
}

// Shared by feed and detail; never writes to entries.
export async function setBurgerWanted(viewerId: string, source: WishlistSource, wanted: boolean) {
  const response = wanted
    ? await supabase.from('burger_wishlist').upsert({
        user_id: viewerId,
        restaurant_id: source.restaurantId,
        burger_id: source.burgerId,
        source_entry_id: source.id,
        status: 'want_to_try',
        rating: null,
        currency: source.currency ?? 'EUR',
        photo_url: source.photoUrl,
        tried_at: null,
      }, { onConflict: 'user_id,restaurant_id,burger_id' })
    : await supabase.from('burger_wishlist').delete().match({
        user_id: viewerId,
        restaurant_id: source.restaurantId,
        burger_id: source.burgerId,
        status: 'want_to_try',
      });
  if (response.error) throw response.error;
  window.dispatchEvent(new CustomEvent('bw-burger-wishlist-updated'));
}
