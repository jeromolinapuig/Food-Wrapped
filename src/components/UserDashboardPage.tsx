import { useEffect, useMemo, useState, startTransition } from 'react';
import type { Session } from '@supabase/supabase-js';
import { EmojiEvents, Euro, LunchDining, Star } from '@mui/icons-material';
import { supabase } from '../lib/supabaseClient';
import { FeedTabs } from './FeedTabs';
import { StatCard } from './StatCard';
import '../styles/layout.css';
import '../styles/shared.css';
import '../styles/Dashboard.css';
import '../styles/user-dashboard-page.css';

type BurgerTypeStats = {
  beef: number;
  chicken: number;
  vegan: number;
};

type MeatType = 'beef' | 'chicken' | 'vegan' | 'other';

type DbEntryRow = {
  id: string;
  datetime: string;
  rating: number | null;
  price: number | null;
  is_burger: boolean;
  restaurant_id: string | null;
  burger_id: string | null;
  restaurant: { name: string } | null;
  burger: { name: string | null; meat_type: MeatType | null } | null;
};

type UserDashboardPageProps = {
  session: Session;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onNavigate: (page: 'dashboard' | 'feed' | 'profile' | 'groups') => void;
  userId: string;
  onBack: () => void;
};

export function UserDashboardPage({ session, userId, onBack }: Readonly<UserDashboardPageProps>) {
  const [entries, setEntries] = useState<DbEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [postsCount, setPostsCount] = useState(0);
  const [monthFilter, setMonthFilter] = useState<'all' | string>('all');
  const [profile, setProfile] = useState<{ username: string | null; displayName: string | null; isPrivate?: boolean | null } | null>(null);
  const [privacyBlocked, setPrivacyBlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, display_name, is_private')
        .eq('id', userId)
        .single();

      if (cancelled) return;

      if (error) {
        console.error('Error loading profile', error);
        setProfile({ username: null, displayName: null });
        return;
      }

      setProfile({
        username: (data as { username: string | null }).username,
        displayName: (data as { display_name: string | null }).display_name,
        isPrivate: (data as { is_private: boolean | null }).is_private,
      });
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!profile) return;
    if (userId === session.user.id) {
      startTransition(() => {
        setPrivacyBlocked(false);
      });
      return;
    }
    if (!profile.isPrivate) {
      startTransition(() => {
        setPrivacyBlocked(false);
      });
      return;
    }
    let cancelled = false;
    const checkMutual = async () => {
      const [{ data: outgoing }, { data: incoming }] = await Promise.all([
        supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', session.user.id)
          .eq('following_id', userId)
          .limit(1),
        supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', session.user.id)
          .eq('follower_id', userId)
          .limit(1),
      ]);
      if (cancelled) return;
      const isMutual = Boolean((outgoing ?? []).length && (incoming ?? []).length);
      setPrivacyBlocked(!isMutual);
    };
    checkMutual();
    return () => {
      cancelled = true;
    };
  }, [profile, session.user.id, userId]);

  useEffect(() => {
    if (privacyBlocked) {
      startTransition(() => {
        setEntries([]);
        setLoading(false);
        setError(null);
        setPostsCount(0);
      });
      return;
    }
    const loadEntries = async () => {
      setLoading(true);
      setError(null);

      const from = '2026-01-01';
      const to = '2027-01-01';

      const { data, error } = await supabase
        .from('entries')
        .select(
          `
          id,
          datetime,
          rating,
          price,
          is_burger,
          restaurant_id,
          burger_id,
          restaurant:restaurants ( name ),
          burger:burgers ( name, meat_type )
        `
        )
        .gte('datetime', from)
        .lt('datetime', to)
        .eq('user_id', userId)
        .order('datetime', { ascending: false });

      if (error) {
        setError(error.message);
        setEntries([]);
      } else {
        setEntries((data ?? []) as unknown as DbEntryRow[]);
      }

      setLoading(false);
    };

    loadEntries();
  }, [privacyBlocked, userId]);

  const stats = useMemo(() => {
    if (!entries.length) {
      return {
        totalSpent: 0,
        totalBurgers: 0,
        averageRating: 0,
        favoriteRestaurant: '',
        burgerTypes: { beef: 0, chicken: 0, vegan: 0 } as BurgerTypeStats,
      };
    }

    let totalSpent = 0;
    let burgerCount = 0;
    let ratingSum = 0;
    let ratingCount = 0;

    const restaurantCounter = new Map<string, number>();
    const burgerTypes: BurgerTypeStats = { beef: 0, chicken: 0, vegan: 0 };

    for (const entry of entries) {
      if (entry.price != null) totalSpent += entry.price;
      if (entry.is_burger) burgerCount++;

      if (entry.rating != null) {
        ratingSum += entry.rating;
        ratingCount++;
      }

      const restaurantName = entry.restaurant?.name;
      if (restaurantName) {
        restaurantCounter.set(restaurantName, (restaurantCounter.get(restaurantName) ?? 0) + 1);
      }

      const meat = entry.burger?.meat_type;
      if (meat === 'beef') burgerTypes.beef++;
      if (meat === 'chicken') burgerTypes.chicken++;
      if (meat === 'vegan') burgerTypes.vegan++;
    }

    let favoriteRestaurant = '';
    let maxCount = 0;
    restaurantCounter.forEach((count, name) => {
      if (count > maxCount) {
        maxCount = count;
        favoriteRestaurant = name;
      }
    });

    const averageRating = ratingCount ? ratingSum / ratingCount : 0;

    return {
      totalSpent,
      totalBurgers: burgerCount,
      averageRating,
      favoriteRestaurant,
      burgerTypes,
    };
  }, [entries]);

  const titleHandle = profile?.username ?? profile?.displayName ?? 'usuario';

  return (
    <div className="bw-app-root">
      <div className="bw-shell">
        <header className="bw-header">
          <button type="button" className="bw-back-button" onClick={onBack} aria-label="Volver">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M15.41 16.59 10.83 12l4.58-4.59L14 6l-6 6 6 6z" />
            </svg>
          </button>
          <div className="bw-header-icon">
            <img src="/logo.png" alt="Burger Wrapped" />
          </div>
          <div style={{ flex: 1 }}>
            <h1 className="bw-title">Burger Wrapped</h1>
            <p className="bw-subtitle">Resumen de @{titleHandle}</p>
          </div>

        </header>

        <main className="bw-main">
          {privacyBlocked ? (
            <div className="bw-card bw-private-card">
              Este perfil es privado.
            </div>
          ) : (
            <>
              <section className="bw-stats-grid">
                {loading ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <div className="bw-stat-card bw-skeleton" key={idx}>
                      <div className="bw-skeleton-line bw-skeleton-short" />
                      <div className="bw-skeleton-line" />
                      <div className="bw-skeleton-line bw-skeleton-short" />
                    </div>
                  ))
                ) : (
                  <>
                    <StatCard
                      icon={<Euro fontSize="small" />}
                      value={`${stats.totalSpent.toFixed(2)}€`}
                      label="Total gastado"
                    />
                    <StatCard icon={<LunchDining fontSize="small" />} value={`${stats.totalBurgers}`} label="Hamburguesas" />
                    <StatCard
                      icon={<Star fontSize="small" />}
                      value={stats.averageRating ? stats.averageRating.toFixed(1) : '-'}
                      label="Nota media"
                    />
                    <StatCard icon={<EmojiEvents fontSize="small" />} value={stats.favoriteRestaurant || '-'} label="Favorito" />
                  </>
                )}
              </section>

              <section className="bw-card bw-burger-types">
                <h2 className="bw-section-title">Tipos de hamburguesa</h2>
                <div className="bw-burger-types-row">
                  <div className="bw-burger-type">
                    <span className="bw-burger-type-emoji">
                      <img src="/meat.png" alt="Carne" className="bw-burger-type-icon" />
                    </span>
                    <span>{stats.burgerTypes.beef}</span>
                  </div>
                  <div className="bw-burger-type">
                    <span className="bw-burger-type-emoji">
                      <img src="/chicken-leg.png" alt="Pollo" className="bw-burger-type-icon" />
                    </span>
                    <span>{stats.burgerTypes.chicken}</span>
                  </div>
                  <div className="bw-burger-type">
                    <span className="bw-burger-type-emoji">
                      <img src="/plant.png" alt="Vegana" className="bw-burger-type-icon" />
                    </span>
                    <span>{stats.burgerTypes.vegan}</span>
                  </div>
                </div>
              </section>

              {error && <p style={{ color: 'red', fontSize: 12 }}>{error}</p>}

              <section className="bw-history">
                <div className="bw-section-header">
                  <h2 className="bw-section-title">Posts ({postsCount})</h2>
                  <div className="bw-section-right">
                  <FeedTabs
                    currentUserId={session.user.id}
                    focusUserId={userId}
                    onCountChange={setPostsCount}
                    headerOnly
                    monthFilter={monthFilter}
                    onMonthFilterChange={setMonthFilter}
                  />
                </div>
              </div>
              <FeedTabs
                currentUserId={session.user.id}
                focusUserId={userId}
                onCountChange={setPostsCount}
                hideHeader
                monthFilter={monthFilter}
                onMonthFilterChange={setMonthFilter}
              />
            </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
