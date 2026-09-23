import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ADD_ENTRY_NOTIFICATION_TARGET } from '../../constants/notificationTargets';
import type { Session } from '@supabase/supabase-js';
import { EmojiEvents, Euro, House, LunchDining, Notifications, Star } from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import { AddEntryModal } from '../AddEntryModal/AddEntryModal';
import { FeedTabs } from '../FeedTabs/FeedTabs';
import type { FeedPriceFilter, FeedPriceFilterRange } from '../FeedTabs/types';
import type { GroupInvite } from '../../types/groups';
import { GroupInvitesModal } from '../GroupInvitesModal/GroupInvitesModal';
import { NotificationsDrawer } from '../NotificationsDrawer/NotificationsDrawer';
import { StatCard } from '../StatCard/StatCard';
import { UserProfileModal } from '../UserProfileModal/UserProfileModal';
import { lockBodyScroll } from '../../utils/scrollLock';
import { useRevalidateOnFocus } from '../../utils/useRevalidateOnFocus';
import { AppShell } from '../common/AppShell';
import { PageHeader } from '../common/PageHeader';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { usePreferences } from '../../context/PreferencesContext';
import { useTranslation } from 'react-i18next';
import { getCurrentMonthValue } from '../../utils/datetime';
import { whereNotDeleted } from '../../lib/whereNotDeleted';
import {
  DashboardMultiSelect,
  type MultiSelectOption,
} from './DashboardFilters';
import {
  burgerTypeFilterOptions,
  getCurrencySymbol,
  getPriceFiltersForCurrency,
} from './DashboardFilterOptions';
import { AnnualSummaryCollapse } from './AnnualSummaryCollapse';
import { BurgerCalendarHomeCard } from './BurgerCalendarHomeCard';
import { getDateKey } from '../BurgerCalendarPage/utils';
import '../../styles/layout.css';
import '../../styles/shared.css';
import './Dashboard.css';

type DashboardProps = {
  session: Session;
  theme: 'light' | 'dark';
  onToggleTheme?: () => void;
  onNavigate?: (page: 'feed' | 'groups' | 'profile' | 'dashboard') => void;
};

type BurgerTypeStats = {
  beef: number;
  chicken: number;
  vegan: number;
};

export type MeatType = 'beef' | 'chicken' | 'vegan' | 'other';

type DashboardProfile = {
  username: string | null;
  display_name: string | null;
};

const FIRST_ENTRY_YEAR = 2026;

type DbEntryRow = {
  id: string;
  datetime: string;
  rating: number | null;
  price: number | null;
  currency?: string | null;
  is_burger: boolean;
  burger_origin: 'restaurant' | 'homemade' | null;
  meat_type: MeatType | null;
  additional_notes: string | null;
  restaurant_id: string | null;
  burger_id: string | null;
  photo_url: string | null;
  restaurant: { name: string } | null;
  burger: { name: string | null; meat_type: MeatType | null } | null;
};

type EditEntry = {
  id: string;
  datetime: string;
  rating: number | null;
  price: number | null;
  currency?: string | null;
  is_burger: boolean;
  additionalNotes?: string | null;
  restaurantId?: string | null;
  restaurantName?: string | null;
  burgerId?: string | null;
  burgerName?: string | null;
  meatType?: MeatType | null;
  photoUrl?: string | null;
  burgerOrigin?: 'restaurant' | 'homemade' | null;
  ingredients?: string | null;
};

function computeStats(entries: DbEntryRow[]) {
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

  const init = {
    totalSpent: 0,
    burgerCount: 0,
    homemadeBurgers: 0,
    ratingSum: 0,
    ratingCount: 0,
    restaurantCounter: new Map<string, number>(),
    restaurantLastVisited: new Map<string, number>(),
    restaurantRatings: new Map<string, { sum: number; count: number }>(),
    burgerTypes: { beef: 0, chicken: 0, vegan: 0 } as BurgerTypeStats,
  };

  const acc = entries.reduce((a, e) => {
    if (e.price != null) a.totalSpent += e.price;
    if (e.is_burger) {
      if (e.burger_origin === 'homemade') a.homemadeBurgers++;
      else a.burgerCount++;
      const meat = e.meat_type ?? e.burger?.meat_type;
      if (meat === 'beef') a.burgerTypes.beef++;
      if (meat === 'chicken') a.burgerTypes.chicken++;
      if (meat === 'vegan') a.burgerTypes.vegan++;
    }
    if (e.rating != null) {
      a.ratingSum += e.rating;
      a.ratingCount++;
    }
    const rn = e.restaurant?.name;
    if (rn) {
      a.restaurantCounter.set(rn, (a.restaurantCounter.get(rn) ?? 0) + 1);
      const visitTime = new Date(e.datetime).getTime();
      const lastVisit = a.restaurantLastVisited.get(rn) ?? -Infinity;
      if (visitTime > lastVisit) a.restaurantLastVisited.set(rn, visitTime);
      if (e.rating != null) {
        const current = a.restaurantRatings.get(rn) ?? { sum: 0, count: 0 };
        current.sum += e.rating;
        current.count++;
        a.restaurantRatings.set(rn, current);
      }
    }
    return a;
  }, init);

  let favoriteRestaurant = '';
  let bestAverage = -Infinity;
  acc.restaurantRatings.forEach(({ sum, count }, name) => {
    if (!count) return;
    const avg = sum / count;
    const visitCount = acc.restaurantCounter.get(name) ?? 0;
    const currentBestVisits = acc.restaurantCounter.get(favoriteRestaurant) ?? 0;
    const lastVisit = acc.restaurantLastVisited.get(name) ?? -Infinity;
    const currentBestLastVisit = acc.restaurantLastVisited.get(favoriteRestaurant) ?? -Infinity;
    if (
      avg > bestAverage ||
      (avg === bestAverage && visitCount > currentBestVisits) ||
      (avg === bestAverage && visitCount === currentBestVisits && lastVisit > currentBestLastVisit)
    ) {
      bestAverage = avg;
      favoriteRestaurant = name;
    }
  });

  const averageRating = acc.ratingCount ? acc.ratingSum / acc.ratingCount : 0;

  return {
    totalSpent: acc.totalSpent,
    totalBurgers: acc.burgerCount,
    averageRating,
    favoriteRestaurant,
    homemadeBurgers: acc.homemadeBurgers,
    burgerTypes: acc.burgerTypes,
  };
}

function DashboardStatSkeleton() {
  return (
    <article className="bw-stat-card bw-stat-card-skeleton bw-skeleton" aria-hidden="true">
      <div className="bw-stat-icon bw-stat-skeleton-icon" />
      <div className="bw-stat-value bw-stat-skeleton-value" />
      <div className="bw-stat-label bw-stat-skeleton-label" />
    </article>
  );
}

export function Dashboard({ session, theme }: Readonly<DashboardProps>) {
  const navigate = useNavigate();
  const location = useLocation();
  const lastSeenKey = `bw-notify-last-seen-${session.user.id}`;
  const username = (session.user.user_metadata as { username?: string } | null)?.username;
  const profileCacheKey = `bw-profile-${session.user.id}`;
  const [headerUsername, setHeaderUsername] = useState<string | null>(null);
  const [entries, setEntries] = useState<DbEntryRow[]>([]);
  const [activeYear, setActiveYear] = useState(() => new Date().getFullYear());
  const [entriesYear, setEntriesYear] = useState(() => new Date().getFullYear());
  const [historicalAvailability, setHistoricalAvailability] = useState<{ userId: string; earliestYear: number | null } | null>(null);
  const earliestYear = historicalAvailability?.userId === session.user.id ? historicalAvailability.earliestYear : null;
  const entriesRequestRef = useRef(0);
  const historicalRequestRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState<string[]>(['all']);
  const [priceFilter, setPriceFilter] = useState<FeedPriceFilter[]>(['all']);
  const [meatTypeFilter, setMeatTypeFilter] = useState<(MeatType | 'all')[]>(['all']);
  const [openFilterCount, setOpenFilterCount] = useState(0);
  const [refreshFeedKey, setRefreshFeedKey] = useState(0);
  const [mutating, setMutating] = useState(false);
  const [editingEntry, setEditingEntry] = useState<EditEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<EditEntry | null>(null);
  const lastRealtimeRef = useRef(0);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLatest, setNotificationsLatest] = useState<string | null>(null);
  const [notificationsLastSeen, setNotificationsLastSeen] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(lastSeenKey);
  });
  const { formatCurrency, currency: viewerCurrency, convertAmount } = usePreferences(); const { t } = useTranslation();
  const [profileModalUserId, setProfileModalUserId] = useState<string | null>(null);
  const [isInvitesOpen, setIsInvitesOpen] = useState(false);
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [invitesError, setInvitesError] = useState<string | null>(null);
  const [groupCount, setGroupCount] = useState(0);
  const maxGroups = 6;

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<unknown>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const cacheKey = `bw-dashboard-entries-${session.user.id}-${activeYear}`;
  const changeYear = (year: number) => {
    if (year > new Date().getFullYear() || earliestYear === null || year < Math.max(FIRST_ENTRY_YEAR, earliestYear) || year === activeYear) return;
    entriesRequestRef.current += 1;
    setActiveYear(year);
    setEntries([]);
    setLoading(true);
    setError(null);
    setMonthFilter(['all']);
  };
  const openAddModal = () => {
    setEditingEntry(null);
    setIsAddModalOpen(true);
  };
  const closeAddModal = () => {
    setIsAddModalOpen(false);
    setEditingEntry(null);
  };

  useEffect(() => {
    const targetQuery = ADD_ENTRY_NOTIFICATION_TARGET.split('?')[1];
    if (!targetQuery || location.search !== `?${targetQuery}`) return;

    setEditingEntry(null);
    setIsAddModalOpen(true);
    navigate(location.pathname, { replace: true });
  }, [location.pathname, location.search, navigate]);

  // Cargar las entradas del año seleccionado.
  const loadEntries = useCallback(async (options?: { showLoading?: boolean }) => {
    const requestId = ++entriesRequestRef.current;
    const showLoading = options?.showLoading ?? true;
    if (showLoading) setLoading(true);
    setError(null);

    const from = `${activeYear}-01-01`;
    const to = `${activeYear + 1}-01-01`;

    const statsQuery = whereNotDeleted(
      supabase
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
      .eq('user_id', session.user.id)
      .order('datetime', { ascending: false })
    );
    const { data, error } = await statsQuery;
    if (requestId !== entriesRequestRef.current) return;

    if (error) {
      setError(error.message);
      setEntries([]);
      setEntriesYear(activeYear);
    } else {
      const nextEntries = (data ?? []) as unknown as DbEntryRow[];
      setEntries(nextEntries);
      setEntriesYear(activeYear);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(nextEntries));
      } catch {
        // Ignore cache write errors (private mode, quota, etc.).
      }
    }

    setLoading(false);
  }, [activeYear, cacheKey, session.user.id]);

  const loadHistoricalYear = useCallback(async () => {
    const requestId = ++historicalRequestRef.current;
    const currentYear = new Date().getFullYear();
    if (currentYear <= FIRST_ENTRY_YEAR) return;

    const query = whereNotDeleted(
      supabase.from('entries')
        .select('datetime')
        .eq('user_id', session.user.id)
        .gte('datetime', `${FIRST_ENTRY_YEAR}-01-01`)
        .lt('datetime', `${currentYear}-01-01`)
        .order('datetime', { ascending: true })
        .limit(1)
    );
    const { data, error } = await query;
    if (requestId !== historicalRequestRef.current) return;
    if (error) return;
    const parsedYear = data?.[0] ? Number((data[0] as { datetime: string }).datetime.slice(0, 4)) : null;
    const firstYear = parsedYear !== null && Number.isInteger(parsedYear) && parsedYear >= FIRST_ENTRY_YEAR && parsedYear < currentYear
      ? parsedYear
      : null;
    setHistoricalAvailability({ userId: session.user.id, earliestYear: firstYear });
    if (firstYear === null) setActiveYear(currentYear);
  }, [session.user.id]);

  const loadSavedEntries = useCallback(async () => {
    const { error: savedError } = await supabase
      .from('entry_bookmarks')
      .select('entry_id')
      .eq('user_id', session.user.id)
      .limit(1);

    if (savedError) {
      setSavedError(savedError.message);
      return;
    }
    setSavedError(null);
  }, [session.user.id]);

  const loadInvites = useCallback(async () => {
    setInvitesLoading(true);
    setInvitesError(null);

    const { data: inviteRows, error: inviteError } = await supabase
      .from('group_invitations')
      .select('id, group_id, inviter_id')
      .eq('invitee_id', session.user.id);

    if (inviteError) {
      setInvitesError(t('dashboard.invitesError'));
      setInvites([]);
      setInvitesLoading(false);
      return;
    }

    const baseInvites = (inviteRows ?? []) as { id: string; group_id: string; inviter_id: string }[];

    if (!baseInvites.length) {
      setInvites([]);
      setInvitesLoading(false);
      return;
    }

    const groupIds = Array.from(new Set(baseInvites.map((row) => row.group_id)));
    const inviterIds = Array.from(new Set(baseInvites.map((row) => row.inviter_id)));

    const [{ data: groupsData, error: groupsError }, { data: profilesData, error: profilesError }] = await Promise.all([
      supabase.from('groups').select('id, name').in('id', groupIds),
      supabase.from('profiles').select('id, username, display_name').in('id', inviterIds),
    ]);

    if (groupsError || profilesError) {
      setInvitesError(t('dashboard.invitesError'));
      setInvitesLoading(false);
      return;
    }

    const groupMap = new Map<string, string>();
    (groupsData ?? []).forEach((group) => {
      groupMap.set((group as { id: string }).id, (group as { name: string }).name);
    });

    const inviterMap = new Map<string, { username: string | null; displayName: string | null }>();
    (profilesData ?? []).forEach((profile) => {
      inviterMap.set((profile as { id: string }).id, {
        username: (profile as { username: string | null }).username,
        displayName: (profile as { display_name: string | null }).display_name,
      });
    });

    const mapped = baseInvites.map((row) => {
      const inviter = inviterMap.get(row.inviter_id);
      return {
        id: row.id,
        groupId: row.group_id,
        groupName: groupMap.get(row.group_id) ?? null,
        inviterId: row.inviter_id,
        inviterUsername: inviter?.username ?? null,
        inviterDisplayName: inviter?.displayName ?? null,
      };
    });

    setInvites(mapped);
    setInvitesLoading(false);
  }, [session.user.id, t]);

  const loadGroupCount = useCallback(async () => {
    const [{ data: ownedGroups }, { data: memberRows }] = await Promise.all([
      supabase.from('groups').select('id').eq('owner_id', session.user.id),
      supabase.from('group_members').select('group_id').eq('user_id', session.user.id),
    ]);
    const ownedIds = (ownedGroups ?? []).map((row) => (row as { id: string }).id);
    const memberIds = (memberRows ?? []).map((row) => (row as { group_id: string }).group_id);
    const unique = new Set([...ownedIds, ...memberIds]);
    setGroupCount(unique.size);
  }, [session.user.id]);

  const loadNotificationsMeta = useCallback(async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error loading notification metadata', error);
      return;
    }
    setNotificationsLatest((data?.[0] as { created_at?: string | null } | undefined)?.created_at ?? null);
  }, [session.user.id]);

  const loadHeaderUsername = useCallback(async () => {
    // 1) Intentar user_metadata fresca (no depende de perfiles ni cache)
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (!authErr) {
      const authUser = authData.user;
      const authUsername =
        (authUser?.user_metadata as { username?: string; display_name?: string } | null)?.username ??
        (authUser?.user_metadata as { display_name?: string } | null)?.display_name ??
        null;
      if (authUsername) {
        setHeaderUsername(authUsername);
      }
    } else {
      console.warn('No se pudo leer user_metadata para header', authErr);
    }

    // 2) Canon: perfil en tabla
    let { data, error } = await supabase
      .from('profiles')
      .select('username, display_name, avatar_url, bio, favorite_burger_type, favorite_sauce, favorite_doneness, favorite_bread')
      .eq('id', session.user.id)
      .single();

    if (error && (error as { code?: string }).code === '42703') {
      ({ data, error } = await supabase
        .from('profiles')
        .select('username, display_name')
        .eq('id', session.user.id)
        .single());
    }

    if (error || !data) {
      console.warn('No se pudo cargar username del header', error);
      return;
    }

    const profile = data as DashboardProfile;
    setHeaderUsername(profile.username ?? profile.display_name ?? null);
  }, [session.user.id]);

  useEffect(() => {
    // Primer intento: cache guardada por ProfilePage
    const cached = sessionStorage.getItem(profileCacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as DashboardProfile;
        const fromCache = parsed.username ?? parsed.display_name ?? null;
        if (fromCache) setHeaderUsername(fromCache);
      } catch {
        // ignorar parseo
      }
    }

    loadHeaderUsername();
  }, [loadHeaderUsername, profileCacheKey]);

  // Escucha actualizaciones emitidas desde ProfilePage para refrescar al instante
  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ username?: string | null; displayName?: string | null }>;
      const next = custom.detail?.username ?? custom.detail?.displayName ?? null;
      if (next) setHeaderUsername(next);
    };
    window.addEventListener('bw-profile-updated', handler);
    return () => window.removeEventListener('bw-profile-updated', handler);
  }, []);

  useEffect(() => {
    entriesRequestRef.current += 1;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as DbEntryRow[];
        if (Array.isArray(parsed)) {
          setEntries(parsed);
          setEntriesYear(activeYear);
          setLoading(false);
          setError(null);
        } else {
          void loadEntries();
        }
      } catch {
        void loadEntries();
      }
    } else {
      void loadEntries();
    }

    // Suscripción a cambios en la tabla de entries para refrescar el feed en tiempo real
    const channel = supabase
      .channel('entries-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'entries' },
        () => {
          if (document.visibilityState !== 'visible') return;
          const now = Date.now();
          if (now - lastRealtimeRef.current < 60000) return;
          lastRealtimeRef.current = now;
          loadEntries({ showLoading: false });
          void loadHistoricalYear();
        }
      )
      .subscribe();

    return () => {
      entriesRequestRef.current += 1;
      supabase.removeChannel(channel);
    };
  }, [activeYear, cacheKey, loadEntries, loadHistoricalYear, session.user.id]);

  useEffect(() => {
    if (new Date().getFullYear() <= FIRST_ENTRY_YEAR) return;
    void loadHistoricalYear();
    return () => { historicalRequestRef.current += 1; };
  }, [loadHistoricalYear]);

  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (!isMobile) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e);
      setTimeout(() => setShowInstallBanner(true), 2000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useRevalidateOnFocus(
    () => {
      loadEntries({ showLoading: false });
      void loadHistoricalYear();
      loadInvites();
      loadGroupCount();
      loadNotificationsMeta();
      loadHeaderUsername();
    },
    [loadEntries, loadGroupCount, loadInvites, loadNotificationsMeta, loadHeaderUsername, loadHistoricalYear],
    { minIntervalMs: 300000, maxStaleMs: 1200000, debounceMs: 500 }
  );

  useEffect(() => {
    loadSavedEntries();
  }, [loadSavedEntries]);

  useEffect(() => {
    const handleInvitesUpdated = () => {
      loadInvites();
      loadGroupCount();
    };
    window.addEventListener('bw-invites-updated', handleInvitesUpdated);
    return () => window.removeEventListener('bw-invites-updated', handleInvitesUpdated);
  }, [loadGroupCount, loadInvites]);

  useEffect(() => {
    if (!showInstallBanner && !deleteEntry) return;
    return lockBodyScroll();
  }, [deleteEntry, showInstallBanner]);

  useEffect(() => {
    if (!isInvitesOpen) return;
    loadInvites();
    loadGroupCount();
  }, [isInvitesOpen, loadGroupCount, loadInvites]);

  useEffect(() => {
    loadNotificationsMeta();
  }, [loadNotificationsMeta]);

  useEffect(() => {
    const channel = supabase
      .channel(`dashboard-notifications-${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${session.user.id}`,
        },
        () => void loadNotificationsMeta()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadNotificationsMeta, session.user.id]);

  useEffect(() => {
    if (!notificationsOpen) return;
    const nextSeen = notificationsLatest ?? new Date().toISOString();
      setNotificationsLastSeen(nextSeen);
    window.localStorage.setItem(lastSeenKey, nextSeen);
  }, [lastSeenKey, notificationsLatest, notificationsOpen]);


  const handleInstallClick = async () => {
    if (installPromptEvent) {
      const promptEvent = installPromptEvent as { prompt: () => Promise<void>; userChoice?: Promise<{ outcome: string }> };
      await promptEvent.prompt?.();
    }
    setShowInstallBanner(false);
    setInstallPromptEvent(null);
  };

  // --- Stats calculadas ---
  const annualEntries = useMemo(() => entriesYear === activeYear ? entries : [], [activeYear, entries, entriesYear]);
  const annualLoading = loading || entriesYear !== activeYear;
  const stats = useMemo(() => computeStats(annualEntries), [annualEntries]);
  const monthOptions = useMemo(() => {
    const currentMonthValue = getCurrentMonthValue();
    const values = new Set<string>(activeYear === new Date().getFullYear() ? [currentMonthValue] : []);
    annualEntries.forEach((entry) => {
      const date = new Date(entry.datetime);
      if (Number.isNaN(date.getTime())) return;
      values.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    });
    const currentYear = activeYear;
    const locale = typeof navigator !== 'undefined' ? navigator.language : undefined;
    return [
      { value: 'all', label: t('feedTabs.all') },
      ...Array.from(values)
        .sort((a, b) => a.localeCompare(b))
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
  }, [activeYear, annualEntries, t]);
  const priceFilterOptions = useMemo<MultiSelectOption<FeedPriceFilter>[]>(
    () => {
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
    },
    [t, viewerCurrency]
  );
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

  const activeHistoryError = error ?? savedError;
  const totalSpentLabel = formatCurrency(stats.totalSpent, { fromCurrency: 'EUR', toCurrency: viewerCurrency });
  const burgerDaysThisMonth = useMemo(() => {
    const now = new Date();
    const currentMonthKeys = new Set<string>();
    annualEntries.forEach((entry) => {
      if (!entry.is_burger) return;
      const date = new Date(entry.datetime);
      if (Number.isNaN(date.getTime())) return;
      if (date.getFullYear() !== now.getFullYear() || date.getMonth() !== now.getMonth()) return;
      currentMonthKeys.add(getDateKey(date));
    });
    return currentMonthKeys.size;
  }, [annualEntries]);
  const hasUnreadNotifications = Boolean(
    notificationsLatest && (!notificationsLastSeen || notificationsLatest > notificationsLastSeen)
  );
  const handleOpenPost = (entryId: string) => {
    navigate(`/posts/${entryId}`, { state: { returnTo: location.pathname } });
  };

  const handleFilterOpenChange = useCallback((open: boolean) => {
    setOpenFilterCount((prev) => Math.max(0, prev + (open ? 1 : -1)));
  }, []);

  const isOverlayOpen =
    isAddModalOpen ||
    Boolean(deleteEntry) ||
    notificationsOpen ||
    Boolean(profileModalUserId) ||
    isInvitesOpen;

  const handleEntrySaved = async () => {
    await loadEntries();
    await loadHistoricalYear();
    setRefreshFeedKey((prev) => prev + 1);
  };

  const handleEditEntry = (entry: EditEntry) => {
    setEditingEntry(entry);
    setIsAddModalOpen(true);
  };

  const handleDeleteEntry = async () => {
    if (!deleteEntry) return;
    setMutating(true);
    try {
      const { error: deleteError } = await supabase
        .from('entries')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: session.user.id,
        })
        .eq('id', deleteEntry.id);
      if (deleteError) throw deleteError;
      await loadEntries();
      await loadHistoricalYear();
      setRefreshFeedKey((prev) => prev + 1);
      setDeleteEntry(null);
    } catch (err) {
      console.error(err);
      alert(t('dashboard.deleteError'));
    } finally {
      setMutating(false);
    }
  };

  return (
    <AppShell>
        <PageHeader
          title="Burger Wrapped"
          subtitle={t('dashboard.subtitle', { year: activeYear, user: headerUsername ?? username ?? session.user.email })}
          logoAlt="Burger Wrapped"
          actions={(
            <>
              <button
                type="button"
                className="bw-icon-button bw-notify-button"
                onClick={() => setNotificationsOpen(true)}
                aria-label={t('dashboard.openNotifications')}
              >
                <Notifications />
                {hasUnreadNotifications && <span className="bw-notify-dot" />}
              </button>
            </>
          )}
        />

        {showInstallBanner && (
          <div className="bw-install-modal">
            <div className="bw-install-modal-card">
              <div className="bw-install-modal-body">
                <div>
                  <div className="bw-install-title">{t('dashboard.installText')}</div>
                </div>
                <div className="bw-install-actions">
                  <button className="bw-btn bw-btn-ghost" type="button" onClick={() => setShowInstallBanner(false)}>
                    {t('dashboard.later')}
                  </button>
                  <button className="bw-btn bw-btn-primary" type="button" onClick={handleInstallClick}>
                    {t('common.add')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <main className="bw-main bw-dashboard-main">
          {earliestYear !== null && new Date().getFullYear() > FIRST_ENTRY_YEAR && (
            <nav className="bw-dashboard-year-navigation" aria-label={t('dashboard.yearNavigation')}>
              <button type="button" className="bw-icon-button" onClick={() => changeYear(activeYear - 1)} disabled={activeYear <= earliestYear} aria-label={t('dashboard.previousYear')}>‹</button>
              <strong>{activeYear}</strong>
              <button type="button" className="bw-icon-button" onClick={() => changeYear(activeYear + 1)} disabled={activeYear >= new Date().getFullYear()} aria-label={t('dashboard.nextYear')}>›</button>
            </nav>
          )}
          <AnnualSummaryCollapse
            year={activeYear}
            totalBurgers={stats.totalBurgers}
            averageRating={stats.averageRating}
            totalSpentLabel={totalSpentLabel}
            favoriteRestaurant={stats.favoriteRestaurant}
            theme={theme}
            status={annualLoading ? t('common.loading') : error ?? (annualEntries.length === 0 ? t('dashboard.emptyYear', { year: activeYear }) : undefined)}
          >
            {error && <p role="alert" className="bw-dashboard-summary-message">{error}</p>}
            {!annualLoading && !error && annualEntries.length === 0 && <p className="bw-dashboard-summary-message">{t('dashboard.emptyYear', { year: activeYear })}</p>}
            <section className="bw-stats-grid">
              {annualLoading ? (
                [1, 2, 3, 4].map((id) => <DashboardStatSkeleton key={id} />)
              ) : (
                <>
                  <StatCard icon={<LunchDining fontSize="small" />} value={`${stats.totalBurgers}`} label={t('dashboard.burgers')} />
                  <StatCard
                    icon={<House fontSize="small" />}
                    value={`${stats.homemadeBurgers}`}
                    label={t('dashboard.homemade')}
                  />
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
              {annualLoading ? (
                <DashboardStatSkeleton />
              ) : (
                <StatCard
                  icon={<Euro fontSize="small" />}
                  value={totalSpentLabel}
                  label={t('dashboard.totalSpent')}
                />
              )}
            </section>
          </AnnualSummaryCollapse>

          <BurgerCalendarHomeCard
            burgerDaysThisMonth={burgerDaysThisMonth}
            onOpen={() => navigate('/burger-calendar')}
          />

          <section className="bw-history">
            <div
              className={`bw-dashboard-filter-carousel ${openFilterCount > 0 ? 'is-locked' : ''} ${isOverlayOpen ? 'is-disabled' : ''}`}
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
            {activeHistoryError && <p style={{ color: 'red', fontSize: 12 }}>{activeHistoryError}</p>}
            <FeedTabs
              currentUserId={session.user.id}
              focusUserId={session.user.id}
              hideHeader
              monthFilter={monthFilter}
              priceFilter={priceFilter}
              priceFilterRanges={priceFilterRanges}
              priceFilterCurrency={viewerCurrency}
              convertPriceAmount={convertAmount}
              meatTypeFilter={meatTypeFilter}
              refreshKey={refreshFeedKey}
              onOpenEntry={handleOpenPost}
              showOwnerActions
              onEditEntry={(entry) =>
                handleEditEntry({
                  id: entry.id,
                  datetime: entry.datetime,
                  rating: entry.rating,
                  price: entry.price,
                  currency: entry.currency,
                  is_burger: entry.isBurger,
                  additionalNotes: entry.additionalNotes,
                  restaurantId: entry.restaurantId,
                  restaurantName: entry.restaurantName,
                  burgerId: entry.burgerId,
                  burgerName: entry.burgerName,
                  meatType: entry.meatType,
                  photoUrl: entry.photoUrl,
                  burgerOrigin: entry.burgerOrigin,
                  ingredients: entry.ingredients,
                })
              }
              onDeleteEntry={(entry) =>
                setDeleteEntry({
                  id: entry.id,
                  datetime: entry.datetime,
                  rating: entry.rating,
                  price: entry.price,
                  is_burger: entry.isBurger,
                  additionalNotes: entry.additionalNotes,
                  restaurantId: entry.restaurantId,
                  restaurantName: entry.restaurantName,
                  burgerId: entry.burgerId,
                  burgerName: entry.burgerName,
                  meatType: entry.meatType,
                  photoUrl: entry.photoUrl,
                  burgerOrigin: entry.burgerOrigin,
                  ingredients: entry.ingredients,
                })
              }
            />
          </section>

        </main>

        <div className={`bw-fab-wrapper ${isOverlayOpen ? 'is-hidden' : ''}`}>
          <button
            className="bw-fab"
            onClick={openAddModal}
            aria-label={t('common.addEntry')}
          >
            <span className="bw-fab-plus">+</span>
            <span className="bw-fab-label">{t('common.add')}</span>
          </button>
        </div>

      <AddEntryModal
        open={isAddModalOpen}
        onClose={closeAddModal}
        onSaved={handleEntrySaved}
        session={session}
        theme={theme}
        mode={editingEntry ? 'edit' : 'create'}
        entry={editingEntry ?? undefined}
      />

      <ConfirmDialog
        open={Boolean(deleteEntry)}
        onClose={() => {
          if (mutating) return;
          setDeleteEntry(null);
        }}
        title={t('dashboard.deleteTitle')}
        message={deleteEntry ? (
          <>
            {t('dashboard.deleteMessage', { date: new Date(deleteEntry.datetime).toLocaleString(undefined, {
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            }), restaurant: deleteEntry.restaurantName ?? t('dashboard.unknownRestaurant') })}
          </>
        ) : null}
        actions={(
          <>
            <button
              className="bw-btn bw-btn-ghost"
              type="button"
              onClick={() => {
                if (mutating) return;
                setDeleteEntry(null);
              }}
              disabled={mutating}
            >
              {t('common.cancel')}
            </button>
            <button
              className="bw-btn bw-btn-danger"
              type="button"
              onClick={() => void handleDeleteEntry()}
              disabled={mutating}
            >
              {mutating ? t('dashboard.processing') : t('common.delete')}
            </button>
          </>
        )}
      />

      <NotificationsDrawer
        open={notificationsOpen}
        currentUserId={session.user.id}
        onClose={() => setNotificationsOpen(false)}
        onOpenEntry={handleOpenPost}
        onOpenProfile={(userId) => setProfileModalUserId(userId)}
        onOpenInvites={() => setIsInvitesOpen(true)}
        onLatestChange={setNotificationsLatest}
      />

      <UserProfileModal
        open={Boolean(profileModalUserId)}
        userId={profileModalUserId}
        session={session}
        onClose={() => setProfileModalUserId(null)}
      />

      {isInvitesOpen && (
        <GroupInvitesModal
          currentUserId={session.user.id}
          currentGroupCount={groupCount}
          maxGroups={maxGroups}
          invites={invites}
          loading={invitesLoading}
          error={invitesError}
          onClose={() => setIsInvitesOpen(false)}
          onChanged={() => { loadInvites(); loadGroupCount(); }}
        />
      )}


    </AppShell>
  );
}




