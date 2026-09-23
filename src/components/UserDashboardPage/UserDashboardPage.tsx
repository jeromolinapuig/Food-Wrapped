import { useCallback, useEffect, useMemo, useState, startTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { EmojiEvents, Euro, House, LunchDining, Star } from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import { FeedTabs } from '../FeedTabs/FeedTabs';
import type { FeedPriceFilter, FeedPriceFilterRange } from '../FeedTabs/types';
import { AppShell } from '../common/AppShell';
import { BackButton } from '../common/BackButton';
import { PageHeader } from '../common/PageHeader';
import { TopMenu } from '../TopMenu/TopMenu';
import { Avatar } from '../common/Avatar';
import { FollowListModal } from '../FollowListModal/FollowListModal';
import {
  loadFollowListItems,
  type FollowListItem,
  type FollowListMode,
} from '../FollowListModal/followListData';
import { StatCard } from '../StatCard/StatCard';
import { useRevalidateOnFocus } from '../../utils/useRevalidateOnFocus';
import { getCurrentMonthValue } from '../../utils/datetime';
import { whereNotDeleted } from '../../lib/whereNotDeleted';
import '../../styles/layout.css';
import '../../styles/shared.css';
import { useTranslation } from 'react-i18next';
import {
  DashboardMultiSelect,
  type MultiSelectOption,
} from '../Dashboard/DashboardFilters';
import {
  burgerTypeFilterOptions,
  getCurrencySymbol,
  getPriceFiltersForCurrency,
} from '../Dashboard/DashboardFilterOptions';
import type { MeatType } from '../Dashboard/Dashboard';
import { usePreferences } from '../../context/PreferencesContext';
import '../Dashboard/Dashboard.css';
import './UserDashboardPage.css';

type BurgerTypeStats = {
  beef: number;
  chicken: number;
  vegan: number;
};

type DbEntryRow = {
  id: string;
  datetime: string;
  rating: number | null;
  price: number | null;
  currency?: string | null;
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
  onBack?: () => void;
  isOwnProfile?: boolean;
  onOpenSettings?: () => void;
};

export function UserDashboardPage({
  session,
  userId,
  theme,
  onToggleTheme,
  isAdminView = false,
  onBack,
  isOwnProfile = false,
  onOpenSettings,
}: Readonly<UserDashboardPageProps>) {
  const { t } = useTranslation();
  const { currency: viewerCurrency, convertAmount, formatCurrency } = usePreferences();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<DbEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [postsCount, setPostsCount] = useState(0);
  const [monthFilter, setMonthFilter] = useState<string[]>(['all']);
  const [priceFilter, setPriceFilter] = useState<FeedPriceFilter[]>(['all']);
  const [meatTypeFilter, setMeatTypeFilter] = useState<(MeatType | 'all')[]>(['all']);
  const [openFilterCount, setOpenFilterCount] = useState(0);
  const [profile, setProfile] = useState<{
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    avatarFrame: 'gold' | 'silver' | 'bronze' | null;
    isPrivate?: boolean | null;
    bio?: string | null;
    favoriteBurgerType?: string | null;
    favoriteSauce?: string | null;
    favoriteDoneness?: string | null;
    favoriteBread?: string | null;
  } | null>(null);
  const [privacyBlocked, setPrivacyBlocked] = useState(false);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [followLists, setFollowLists] = useState<Record<FollowListMode, FollowListItem[]>>({
    followers: [],
    following: [],
  });
  const [followListsLoading, setFollowListsLoading] = useState(false);
  const [followListMode, setFollowListMode] = useState<FollowListMode | null>(null);
  const viewerId = session?.user.id ?? null;

  const loadProfileFollowLists = useCallback(async () => {
    if (!isOwnProfile) return;
    setFollowListsLoading(true);
    const [followersResult, followingResult] = await Promise.all([
      loadFollowListItems(userId, 'followers'),
      loadFollowListItems(userId, 'following'),
    ]);

    if (followersResult.error) {
      console.error('Error loading profile followers list', followersResult.error);
    }
    if (followingResult.error) {
      console.error('Error loading profile following list', followingResult.error);
    }

    setFollowLists({
      followers: followersResult.items,
      following: followingResult.items,
    });
    setFollowCounts({
      followers: followersResult.count,
      following: followingResult.count,
    });
    setFollowListsLoading(false);
  }, [isOwnProfile, userId]);

  useEffect(() => {
    startTransition(() => {
      void loadProfileFollowLists();
    });
  }, [loadProfileFollowLists]);

  useEffect(() => {
    if (!isOwnProfile) return;
    const channel = supabase
      .channel(`own-profile-follow-lists-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follows', filter: `following_id=eq.${userId}` },
        () => {
          void loadProfileFollowLists();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follows', filter: `follower_id=eq.${userId}` },
        () => {
          void loadProfileFollowLists();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOwnProfile, loadProfileFollowLists, userId]);

  const loadProfile = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('username, display_name, avatar_url, equipped_frame, is_private, bio, favorite_burger_type, favorite_sauce, favorite_doneness, favorite_bread')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error loading profile', error);
      setProfile({ username: null, displayName: null, avatarUrl: null, avatarFrame: null });
      return;
    }

    setProfile({
      username: (data as { username: string | null }).username,
      displayName: (data as { display_name: string | null }).display_name,
      avatarUrl: (data as { avatar_url: string | null }).avatar_url,
      avatarFrame: ((data as { equipped_frame?: 'gold' | 'silver' | 'bronze' | null }).equipped_frame ?? null),
      isPrivate: (data as { is_private: boolean | null }).is_private,
      bio: (data as { bio?: string | null }).bio ?? null,
      favoriteBurgerType: (data as { favorite_burger_type?: string | null }).favorite_burger_type ?? null,
      favoriteSauce: (data as { favorite_sauce?: string | null }).favorite_sauce ?? null,
      favoriteDoneness: (data as { favorite_doneness?: string | null }).favorite_doneness ?? null,
      favoriteBread: (data as { favorite_bread?: string | null }).favorite_bread ?? null,
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
    if (isOwnProfile) {
      startTransition(() => {
        setEntries([]);
        setLoading(false);
        setError(null);
        setPostsCount(0);
      });
      return;
    }
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
          currency,
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
  }, [isAdminView, isOwnProfile, privacyBlocked, userId, viewerId]);

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
  const headerAvatarFrame = profile?.avatarFrame ?? null;
  const headerAlt = profile?.displayName ?? profile?.username ?? 'Perfil';
  const preferenceChips = [
    profile?.favoriteBurgerType ? t(`profile.burgerPreferences.types.${profile.favoriteBurgerType}`) : null,
    profile?.favoriteSauce ? t(`profile.burgerPreferences.sauces.${profile.favoriteSauce}`) : null,
    profile?.favoriteDoneness ? t(`profile.burgerPreferences.doneness.${profile.favoriteDoneness}`) : null,
    profile?.favoriteBread ? t(`profile.burgerPreferences.breads.${profile.favoriteBread}`) : null,
  ].filter((value): value is string => Boolean(value));
  const monthOptions = useMemo<MultiSelectOption<string>[]>(() => {
    const values = new Set<string>();
    entries.forEach((entry) => {
      const date = new Date(entry.datetime);
      if (Number.isNaN(date.getTime())) return;
      values.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    });
    const currentValue = getCurrentMonthValue();
    values.add(currentValue);

    const locale = typeof navigator !== 'undefined' ? navigator.language : undefined;
    const currentYear = new Date().getFullYear();
    return [
      { value: 'all', label: t('feedTabs.all') },
      ...Array.from(values)
        .sort((a, b) => b.localeCompare(a))
        .map((value) => {
          const [yearStr, monthStr] = value.split('-');
          const year = Number(yearStr);
          const month = Number(monthStr);
          const date = new Date(year, month - 1, 1);
          const label = year === currentYear
            ? date.toLocaleString(locale, { month: 'long' })
            : date.toLocaleString(locale, { month: 'long', year: 'numeric' });
          return { value, label: label.charAt(0).toUpperCase() + label.slice(1) };
        }),
    ];
  }, [entries, t]);
  const priceFilterOptions = useMemo<MultiSelectOption<FeedPriceFilter>[]>(() => {
    const symbol = getCurrencySymbol(viewerCurrency);
    return getPriceFiltersForCurrency(viewerCurrency).map((filter) => ({
      value: filter.value,
      label: filter.value === 'all'
        ? t('feedTabs.all')
        : filter.value === 'free'
          ? t('dashboard.free')
          : filter.label.startsWith('Más de ')
            ? t('dashboard.priceAbove', { amount: filter.label.slice(7), symbol })
            : t('dashboard.priceRange', { min: filter.label.split(' a ')[0], max: filter.label.split(' a ')[1], symbol }),
    }));
  }, [t, viewerCurrency]);
  const priceFilterRanges = useMemo<Record<Exclude<FeedPriceFilter, 'all'>, FeedPriceFilterRange>>(() => {
    const ranges = {} as Record<Exclude<FeedPriceFilter, 'all'>, FeedPriceFilterRange>;
    getPriceFiltersForCurrency(viewerCurrency).forEach((filter) => {
      if (filter.value === 'all' || !filter.range) return;
      ranges[filter.value] = filter.range;
    });
    return ranges;
  }, [viewerCurrency]);
  const meatTypeFilterOptions = useMemo<MultiSelectOption<MeatType | 'all'>[]>(
    () =>
      burgerTypeFilterOptions.map((filter) => ({
        value: filter.value,
        label: filter.labelKey ? t(filter.labelKey) : filter.label ?? filter.value,
        icon: filter.icon,
      })),
    [t]
  );
  const handleFilterOpenChange = useCallback((open: boolean) => {
    setOpenFilterCount((prev) => Math.max(0, prev + (open ? 1 : -1)));
  }, []);
  const handleFollowListClose = useCallback(() => {
    setFollowListMode(null);
  }, []);
  const handleFollowingDelta = useCallback((delta: number) => {
    setFollowCounts((current) => ({
      ...current,
      following: Math.max(0, current.following + delta),
    }));
  }, []);
  const handleFollowListCount = useCallback((mode: FollowListMode, count: number) => {
    setFollowCounts((current) => {
      if (current[mode] === count) return current;
      return {
        ...current,
        [mode]: count,
      };
    });
  }, []);
  const handleViewFollowPosts = useCallback((user: { id: string; username: string | null; displayName: string | null }) => {
    setFollowListMode(null);
    navigate(`/users/${user.id}`, { state: { returnTo: '/profile' } });
  }, [navigate]);

  return (
    <AppShell>
        <PageHeader
          title={isOwnProfile ? t('profile.title') : 'Burger Wrapped'}
          subtitle={isOwnProfile ? `@${titleHandle}` : t('dashboard.userSummary', { user: titleHandle })}
          logoSrc={isOwnProfile ? undefined : headerAvatar ?? undefined}
          logoAlt={headerAvatar ? headerAlt : 'Burger Wrapped'}
          logoVariant={!isOwnProfile && headerAvatar ? 'avatar' : 'square'}
          logoFrameKey={isOwnProfile ? null : headerAvatarFrame}
          leading={onBack ? <BackButton onClick={onBack} ariaLabel="Volver" /> : undefined}
          actions={isOwnProfile ? (
            <div className="bw-profile-header-actions">
              <button
                type="button"
                className="bw-icon-button"
                onClick={onOpenSettings}
                aria-label={t('profile.openSettings')}
                title={t('profile.settingsTitle')}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
                </svg>
              </button>
              <TopMenu theme={theme} onToggleTheme={onToggleTheme} />
            </div>
          ) : undefined}
        />

        <main className="bw-main">
          {privacyBlocked ? (
            <div className="bw-card bw-private-card">
              Este perfil es privado.
            </div>
          ) : (
            <>
              {isOwnProfile ? (
                <section className="bw-own-profile">
                  <div className="bw-own-profile-hero">
                    <Avatar
                      url={headerAvatar}
                      alt={headerAlt}
                      initial={titleHandle.charAt(0).toUpperCase()}
                      frameKey={headerAvatarFrame}
                      className="bw-own-profile-avatar"
                    />
                    <div className="bw-own-profile-identity">
                      <h2>{profile?.displayName ?? titleHandle}</h2>
                      <p>@{titleHandle}</p>
                    </div>
                  </div>

                  <div className="bw-own-profile-follows" aria-label={t('profile.socialStats')}>
                    <button type="button" onClick={() => setFollowListMode('followers')}>
                      <strong>{followCounts.followers}</strong>
                      <span>{t('common.followers')}</span>
                    </button>
                    <span className="bw-own-profile-follow-divider" aria-hidden="true" />
                    <button type="button" onClick={() => setFollowListMode('following')}>
                      <strong>{followCounts.following}</strong>
                      <span>{t('common.following')}</span>
                    </button>
                  </div>

                  <div className="bw-own-profile-section">
                    <h3>{t('profile.aboutTitle')}</h3>
                    <p className={`bw-user-profile-bio ${profile?.bio ? '' : 'is-empty'}`}>
                      {profile?.bio || t('profile.noBio')}
                    </p>
                    <dl className="bw-own-profile-meta">
                      {session?.user.email ? (
                        <div>
                          <dt>{t('profile.emailLabel')}</dt>
                          <dd>{session.user.email}</dd>
                        </div>
                      ) : null}
                      <div>
                        <dt>{t('profile.visibilityLabel')}</dt>
                        <dd>
                          {profile?.isPrivate
                            ? t('profile.visibilityPrivate')
                            : t('profile.visibilityPublic')}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="bw-own-profile-section">
                    <h3>{t('profile.burgerPreferences.title')}</h3>
                    {preferenceChips.length > 0 ? (
                      <div className="bw-user-profile-preference-list">
                        {preferenceChips.map((preference) => <span key={preference}>{preference}</span>)}
                      </div>
                    ) : (
                      <p className="bw-user-profile-bio is-empty">
                        {t('profile.noPreferences')}
                      </p>
                    )}
                  </div>

                  <div className="bw-own-profile-links">
                    <button type="button" onClick={() => navigate('/my-top-burgers')}>
                      <span className="bw-own-profile-link-icon" aria-hidden="true">
                        <EmojiEvents fontSize="small" />
                      </span>
                      <span>{t('profile.myTopBurgers')}</span>
                      <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
                    </button>
                    <button type="button" onClick={() => navigate('/burger-wishlist')}>
                      <span className="bw-own-profile-link-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></svg>
                      </span>
                      <span>{t('profile.burgerWishlist')}</span>
                      <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
                    </button>
                    <button type="button" onClick={() => navigate('/saved')}>
                      <span className="bw-own-profile-link-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" /></svg>
                      </span>
                      <span>{t('profile.savedPosts')}</span>
                      <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
                    </button>
                  </div>
                </section>
              ) : (
              <section className="bw-card bw-user-profile-intro">
                <div>
                  <h2 className="bw-user-profile-name">{profile?.displayName ?? `@${titleHandle}`}</h2>
                  {profile?.displayName ? <p className="bw-user-profile-handle">@{titleHandle}</p> : null}
                </div>
                <p className={`bw-user-profile-bio ${profile?.bio ? '' : 'is-empty'}`}>
                  {profile?.bio || t('profile.noBio')}
                </p>
                {preferenceChips.length > 0 ? (
                  <div className="bw-user-profile-preference-list">
                    {preferenceChips.map((preference) => <span key={preference}>{preference}</span>)}
                  </div>
                ) : null}
              </section>
              )}

              {!isOwnProfile ? (
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
                    value={formatCurrency(stats.totalSpent, { fromCurrency: 'EUR', toCurrency: viewerCurrency })}
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
                        <img src="/meat.webp" alt={t('dashboard.beef')} className="bw-burger-type-icon" />
                      </span>
                      <span>{stats.burgerTypes.beef}</span>
                    </div>
                    <div className="bw-burger-type">
                      <span className="bw-burger-type-emoji">
                        <img src="/chicken-leg.webp" alt={t('dashboard.chicken')} className="bw-burger-type-icon" />
                      </span>
                      <span>{stats.burgerTypes.chicken}</span>
                    </div>
                    <div className="bw-burger-type">
                      <span className="bw-burger-type-emoji">
                        <img src="/plant.webp" alt={t('dashboard.vegan')} className="bw-burger-type-icon" />
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
                </div>
                <div
                  className={`bw-dashboard-filter-carousel ${openFilterCount > 0 ? 'is-locked' : ''}`}
                  aria-label={t('dashboard.filters')}
                >
                  <DashboardMultiSelect
                    label={t('dashboard.dateFilter')}
                    options={monthOptions}
                    selected={monthFilter}
                    onChange={setMonthFilter}
                    onOpenChange={handleFilterOpenChange}
                  />
                  <DashboardMultiSelect
                    label={t('dashboard.priceFilter')}
                    options={priceFilterOptions}
                    selected={priceFilter}
                    onChange={setPriceFilter}
                    onOpenChange={handleFilterOpenChange}
                  />
                  <DashboardMultiSelect
                    label={t('dashboard.type')}
                    options={meatTypeFilterOptions}
                    selected={meatTypeFilter}
                    onChange={setMeatTypeFilter}
                    onOpenChange={handleFilterOpenChange}
                  />
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
                priceFilter={priceFilter}
                priceFilterRanges={priceFilterRanges}
                priceFilterCurrency={viewerCurrency}
                convertPriceAmount={convertAmount}
                meatTypeFilter={meatTypeFilter}
                onOpenEntry={(entryId) => navigate(`/posts/${entryId}`, { state: { returnTo: `/users/${userId}` } })}
              />
            </section>
                </>
              ) : null}
            </>
          )}
        </main>
        {isOwnProfile && session ? (
          <FollowListModal
            open={Boolean(followListMode)}
            mode={followListMode}
            currentUserId={session.user.id}
            onClose={handleFollowListClose}
            onFollowingDelta={handleFollowingDelta}
            onListCount={handleFollowListCount}
            preloadedItems={followListMode ? followLists[followListMode] : []}
            preloadedLoading={followListsLoading}
            onRequestRefresh={loadProfileFollowLists}
            onViewPosts={handleViewFollowPosts}
          />
        ) : null}
    </AppShell>
  );
}
