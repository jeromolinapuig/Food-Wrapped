import { useCallback, useEffect, useMemo, useState, startTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { EmojiEvents, Euro, House, LunchDining, Star } from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import { FeedTabs } from '../FeedTabs/FeedTabs';
import { AppShell } from '../common/AppShell';
import { BackButton } from '../common/BackButton';
import { PageHeader } from '../common/PageHeader';
import { StatCard } from '../StatCard/StatCard';
import { useRevalidateOnFocus } from '../../utils/useRevalidateOnFocus';
import { getCurrentMonthValue } from '../../utils/datetime';
import { whereNotDeleted } from '../../lib/whereNotDeleted';
import '../../styles/layout.css';
import '../../styles/shared.css';
import { useTranslation } from 'react-i18next';
import '../Dashboard/Dashboard.css';
import './UserDashboardPage.css';

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
  burger_origin: 'restaurant' | 'homemade' | null;
  meat_type: MeatType | null;
  restaurant_id: string | null;
  burger_id: string | null;
  restaurant: { name: string } | null;
  burger: { name: string | null; meat_type: MeatType | null } | null;
};

type UserDashboardPageProps = {
  session: Session | null;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onNavigate: (page: 'dashboard' | 'feed' | 'profile' | 'groups' | 'ranking') => void;
  userId: string;
  isAdminView?: boolean;
  onBack: () => void;
};

export function UserDashboardPage({ session, userId, isAdminView = false, onBack }: Readonly<UserDashboardPageProps>) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<DbEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [postsCount, setPostsCount] = useState(0);
  const [monthFilter, setMonthFilter] = useState<'all' | string>(() => getCurrentMonthValue());
  const [profile, setProfile] = useState<{
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    isPrivate?: boolean | null;
  } | null>(null);
  const [privacyBlocked, setPrivacyBlocked] = useState(false);
  const viewerId = session?.user.id ?? null;

  const loadProfile = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('username, display_name, avatar_url, is_private')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error loading profile', error);
      setProfile({ username: null, displayName: null, avatarUrl: null });
      return;
    }

    setProfile({
      username: (data as { username: string | null }).username,
      displayName: (data as { display_name: string | null }).display_name,
      avatarUrl: (data as { avatar_url: string | null }).avatar_url,
      isPrivate: (data as { is_private: boolean | null }).is_private,
    });
  }, [userId]);

  useEffect(() => {
    startTransition(() => {
      void loadProfile();
    });
  }, [loadProfile]);

  useEffect(() => {
    if (isAdminView) {
      startTransition(() => {
        setPrivacyBlocked(false);
      });
      return;
    }
    if (!profile) return;
    if (!profile.isPrivate) {
      startTransition(() => {
        setPrivacyBlocked(false);
      });
      return;
    }
    if (!viewerId) {
      startTransition(() => setPrivacyBlocked(true));
      return;
    }
    if (userId === viewerId) {
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
          .eq('follower_id', viewerId)
          .eq('following_id', userId)
          .limit(1),
        supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', viewerId)
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
  }, [isAdminView, profile, userId, viewerId]);

  const loadEntries = useCallback(async () => {
    if (privacyBlocked) {
      startTransition(() => {
        setEntries([]);
        setLoading(false);
        setError(null);
        setPostsCount(0);
      });
      return;
    }
    setLoading(true);
    setError(null);

    const from = '2026-01-01';
    const to = '2027-01-01';

    let query = supabase
      .from('entries')
      .select(
        `
          datetime,
          rating,
          price,
          is_burger,
          burger_origin,
          meat_type,
          restaurant:restaurants ( name ),
          burger:burgers ( name, meat_type )
        `
      )
      .gte('datetime', from)
      .lt('datetime', to)
      .eq('user_id', userId)
      .order('datetime', { ascending: false });

    query = whereNotDeleted(query);

    if (!isAdminView && viewerId !== userId) {
      query = query.eq('visibility', 'public');
    }

    const { data, error } = await query;

    if (error) {
      setError(error.message);
      setEntries([]);
    } else {
      setEntries((data ?? []) as unknown as DbEntryRow[]);
    }

    setLoading(false);
  }, [isAdminView, privacyBlocked, userId, viewerId]);

  useEffect(() => {
    startTransition(() => {
      void loadEntries();
    });
  }, [loadEntries]);

  useRevalidateOnFocus(
    () => {
      loadProfile();
      if (!privacyBlocked) {
        loadEntries();
      }
    },
    [loadEntries, loadProfile, privacyBlocked],
    { minIntervalMs: 180000, maxStaleMs: 900000, debounceMs: 500 }
  );

  const stats = useMemo(() => {
    if (!entries.length) {
      return {
        totalSpent: 0,
        totalBurgers: 0,
        averageRating: 0,
        favoriteRestaurant: '',
        homemadeBurgers: 0,
        burgerTypes: { beef: 0, chicken: 0, vegan: 0 } as BurgerTypeStats,
      };
    }

    let totalSpent = 0;
    let burgerCount = 0;
    let homemadeBurgers = 0;
    let ratingSum = 0;
    let ratingCount = 0;

    const restaurantCounter = new Map<string, number>();
    const restaurantRatings = new Map<string, { sum: number; count: number }>();
    const restaurantLastVisited = new Map<string, number>();
    const burgerTypes: BurgerTypeStats = { beef: 0, chicken: 0, vegan: 0 };

    for (const entry of entries) {
      if (entry.price != null) totalSpent += entry.price;
      if (entry.is_burger && entry.burger_origin === 'homemade') {
        homemadeBurgers++;
      }
      if (entry.is_burger && entry.burger_origin !== 'homemade') {
        burgerCount++;
      }

      if (entry.rating != null) {
        ratingSum += entry.rating;
        ratingCount++;
      }

      const restaurantName = entry.restaurant?.name;
      if (restaurantName) {
        restaurantCounter.set(restaurantName, (restaurantCounter.get(restaurantName) ?? 0) + 1);
        const visitTime = new Date(entry.datetime).getTime();
        const lastVisit = restaurantLastVisited.get(restaurantName) ?? -Infinity;
        if (visitTime > lastVisit) restaurantLastVisited.set(restaurantName, visitTime);
        if (entry.rating != null) {
          const current = restaurantRatings.get(restaurantName) ?? { sum: 0, count: 0 };
          current.sum += entry.rating;
          current.count++;
          restaurantRatings.set(restaurantName, current);
        }
      }

      if (entry.is_burger) {
        const meat = entry.meat_type ?? entry.burger?.meat_type;
        if (meat === 'beef') burgerTypes.beef++;
        if (meat === 'chicken') burgerTypes.chicken++;
        if (meat === 'vegan') burgerTypes.vegan++;
      }
    }

    let favoriteRestaurant = '';
    let bestAverage = -Infinity;
    restaurantRatings.forEach(({ sum, count }, name) => {
      if (!count) return;
      const avg = sum / count;
      const visitCount = restaurantCounter.get(name) ?? 0;
      const currentBestVisits = restaurantCounter.get(favoriteRestaurant) ?? 0;
      const lastVisit = restaurantLastVisited.get(name) ?? -Infinity;
      const currentBestLastVisit = restaurantLastVisited.get(favoriteRestaurant) ?? -Infinity;
      if (
        avg > bestAverage ||
        (avg === bestAverage && visitCount > currentBestVisits) ||
        (avg === bestAverage && visitCount === currentBestVisits && lastVisit > currentBestLastVisit)
      ) {
        bestAverage = avg;
        favoriteRestaurant = name;
      }
    });

    const averageRating = ratingCount ? ratingSum / ratingCount : 0;

    return {
      totalSpent,
      totalBurgers: burgerCount,
      averageRating,
      favoriteRestaurant,
      homemadeBurgers,
      burgerTypes,
    };
  }, [entries]);

  const titleHandle = profile?.username ?? profile?.displayName ?? 'usuario';
  const headerAvatar = profile?.avatarUrl ?? null;
  const headerAlt = profile?.displayName ?? profile?.username ?? 'Perfil';

  return (
    <AppShell>
        <PageHeader
          title="Burger Wrapped"
          subtitle={`Resumen de @${titleHandle}`}
          logoSrc={headerAvatar ?? undefined}
          logoAlt={headerAvatar ? headerAlt : 'Burger Wrapped'}
          logoVariant={headerAvatar ? 'avatar' : 'square'}
          leading={<BackButton onClick={onBack} ariaLabel="Volver" />}
        />

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
                    value={`${stats.totalSpent.toFixed(2)}\u20AC`}
                    label={t('dashboard.totalSpent')}
                  />
                    <StatCard icon={<LunchDining fontSize="small" />} value={`${stats.totalBurgers}`} label={t('dashboard.burgers')} />
                    <StatCard
                      icon={<Star fontSize="small" />}
                      value={stats.averageRating ? stats.averageRating.toFixed(1) : '-'}
                      label={t('dashboard.avgRating')}
                    />
                    <StatCard icon={<EmojiEvents fontSize="small" />} value={stats.favoriteRestaurant || '-'} label={t('dashboard.favorite')} />
                  </>
                )}
              </section>

              <section className="bw-dashboard-row">
                <div className="bw-card bw-burger-types">
                  <h2 className="bw-section-title">{t('dashboard.type')}</h2>
                  <div className="bw-burger-types-row">
                    <div className="bw-burger-type">
                      <span className="bw-burger-type-emoji">
                        <img src="/meat.png" alt={t('dashboard.beef')} className="bw-burger-type-icon" />
                      </span>
                      <span>{stats.burgerTypes.beef}</span>
                    </div>
                    <div className="bw-burger-type">
                      <span className="bw-burger-type-emoji">
                        <img src="/chicken-leg.png" alt={t('dashboard.chicken')} className="bw-burger-type-icon" />
                      </span>
                      <span>{stats.burgerTypes.chicken}</span>
                    </div>
                    <div className="bw-burger-type">
                      <span className="bw-burger-type-emoji">
                        <img src="/plant.png" alt={t('dashboard.vegan')} className="bw-burger-type-icon" />
                      </span>
                      <span>{stats.burgerTypes.vegan}</span>
                    </div>
                  </div>
                </div>
                <StatCard
                  icon={<House fontSize="small" />}
                  value={`${stats.homemadeBurgers}`}
                  label="Hamburguesas caseras"
                />
              </section>

              {error && <p style={{ color: 'red', fontSize: 12 }}>{error}</p>}

              <section className="bw-history">
                <div className="bw-section-header">
                  <h2 className="bw-section-title">{t('dashboard.posts')} ({postsCount})</h2>
                  <div className="bw-section-right">
                  <FeedTabs
                    currentUserId={viewerId}
                    isReadOnly={!viewerId}
                    adminMode={isAdminView}
                    focusUserId={userId}
                    ignorePrivacy={isAdminView}
                    headerOnly
                    monthFilter={monthFilter}
                    onMonthFilterChange={setMonthFilter}
                  />
                </div>
              </div>
              <FeedTabs
                currentUserId={viewerId}
                isReadOnly={!viewerId}
                adminMode={isAdminView}
                focusUserId={userId}
                ignorePrivacy={isAdminView}
                onCountChange={setPostsCount}
                hideHeader
                monthFilter={monthFilter}
                onMonthFilterChange={setMonthFilter}
                onOpenEntry={(entryId) => navigate(`/posts/${entryId}`, { state: { returnTo: `/users/${userId}` } })}
              />
            </section>
            </>
          )}
        </main>
    </AppShell>
  );
}
