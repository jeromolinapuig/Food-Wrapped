import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { i18n } from '../../lib/i18n';
import { useRevalidateOnFocus } from '../../utils/useRevalidateOnFocus';
import { getCurrentMonthValue } from '../../utils/datetime';
import type { FeedEntry, FeedTab, MonthOption, SupabaseEntryRow } from './types';

type UseFeedEntriesOptions = {
  currentUserId: string | null;
  isReadOnly: boolean;
  focusUserId?: string | null;
  userIdsFilter?: string[] | null;
  entryIdsFilter?: string[] | null;
  ignorePrivacy: boolean;
  onCountChange?: (count: number) => void;
  headerOnly: boolean;
  hideHeader: boolean;
  refreshKey: number;
  monthFilter?: string;
  onMonthFilterChange?: (value: string) => void;
};

type UseFeedEntriesResult = {
  activeTab: FeedTab;
  setActiveTab: (tab: FeedTab) => void;
  entries: FeedEntry[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  privacyBlocked: boolean;
  monthOptions: MonthOption[];
  effectiveMonthFilter: string;
  setEffectiveMonthFilter: (value: string) => void;
  authNotice: string | null;
  setAuthNotice: (value: string | null) => void;
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
  viewerId: string | null;
  isUserFeed: boolean;
  isCustomList: boolean;
  hasEntryFilter: boolean;
};

const localeMap: Record<string, string> = {
  es: 'es-ES',
  th: 'th-TH',
  fr: 'fr-FR',
  it: 'it-IT',
  de: 'de-DE',
  en: 'en-US',
};

const getLocale = (language: string) => localeMap[language as keyof typeof localeMap] ?? 'en-US';

const buildMonthOptions = (values: string[], locale: string, allLabel: string) => {
  const currentMonthValue = getCurrentMonthValue();
  const unique = new Set(values.filter(Boolean));
  unique.add(currentMonthValue);
  const sortedValues = Array.from(unique).sort((a, b) => a.localeCompare(b));
  const currentYear = new Date().getFullYear();
  const options: MonthOption[] = [{ value: 'all', label: allLabel }];
  sortedValues.forEach((value) => {
    const [yearStr, monthStr] = value.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (Number.isNaN(year) || Number.isNaN(month)) return;
    const date = new Date(year, month - 1, 1);
    const label = year === currentYear
      ? date.toLocaleString(locale, { month: 'long' })
      : date.toLocaleString(locale, { month: 'long', year: 'numeric' });
    options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  });
  return options;
};

export function useFeedEntries({
  currentUserId,
  isReadOnly,
  focusUserId,
  userIdsFilter,
  entryIdsFilter,
  ignorePrivacy,
  onCountChange,
  headerOnly,
  hideHeader,
  refreshKey,
  monthFilter,
  onMonthFilterChange,
}: UseFeedEntriesOptions): UseFeedEntriesResult {
  const [activeTab, setActiveTab] = useState<FeedTab>('global');
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [privacyBlocked, setPrivacyBlocked] = useState(false);
  const [internalMonthFilter, setInternalMonthFilter] = useState<string>(() => getCurrentMonthValue());
  const [monthOptions, setMonthOptions] = useState<MonthOption[]>(() =>
    buildMonthOptions([], getLocale(i18n.language), i18n.t('feedTabs.all'))
  );
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ datetime: string; id: string } | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const entriesRef = useRef<FeedEntry[]>([]);
  const cursorRef = useRef<{ datetime: string; id: string } | null>(null);
  const lastRealtimeRef = useRef(0);
  const pageSize = 10;

  const viewerId = currentUserId ?? null;
  const viewerKey = viewerId ?? 'guest';
  const isUserFeed = Boolean(focusUserId);
  const hasEntryFilter = entryIdsFilter !== undefined && entryIdsFilter !== null;
  const isCustomList = Boolean(userIdsFilter?.length) || hasEntryFilter;
  const effectiveMonthFilter = monthFilter ?? internalMonthFilter;
  const setEffectiveMonthFilter = onMonthFilterChange ?? setInternalMonthFilter;

  const entryIdsKey = useMemo(() => {
    if (!hasEntryFilter) return '';
    if (!entryIdsFilter?.length) return 'empty';
    return [...entryIdsFilter].sort((a, b) => a.localeCompare(b)).join('|');
  }, [entryIdsFilter, hasEntryFilter]);

  const userIdsKey = useMemo(() => {
    if (!userIdsFilter?.length) return '';
    return [...userIdsFilter].sort((a, b) => a.localeCompare(b)).join('|');
  }, [userIdsFilter]);

  const monthCacheKey = useMemo(() => {
    if (focusUserId) return `bw-feed-months-${focusUserId}`;
    if (entryIdsKey) return `bw-feed-months-entries-${entryIdsKey}`;
    if (isCustomList) return `bw-feed-months-group-${userIdsKey}`;
    return null;
  }, [focusUserId, entryIdsKey, isCustomList, userIdsKey]);

  const entriesCacheKey = `bw-feed-entries-${viewerKey}-${focusUserId ?? 'global'}-${activeTab}-${effectiveMonthFilter}-${userIdsKey}-${entryIdsKey}`;

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);

  const checkFocusPrivacy = useCallback(async () => {
    if (ignorePrivacy || !focusUserId) {
      setPrivacyBlocked(false);
      return;
    }
    if (focusUserId === viewerId) {
      setPrivacyBlocked(false);
      return;
    }
    const { data: profileData } = await supabase
      .from('profiles')
      .select('is_private')
      .eq('id', focusUserId)
      .single();
    const isPrivate = Boolean((profileData as { is_private?: boolean | null })?.is_private);
    if (!isPrivate) {
      setPrivacyBlocked(false);
      return;
    }
    if (!viewerId) {
      setPrivacyBlocked(true);
      return;
    }
    const [{ data: out }, { data: inc }] = await Promise.all([
      supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', viewerId)
        .eq('following_id', focusUserId)
        .limit(1),
      supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', viewerId)
        .eq('follower_id', focusUserId)
        .limit(1),
    ]);
    const isMutual = Boolean((out ?? []).length && (inc ?? []).length);
    setPrivacyBlocked(!isMutual);
  }, [focusUserId, ignorePrivacy, viewerId]);

  const loadEntries = useCallback(async (options?: { showLoading?: boolean; skipCache?: boolean; append?: boolean }) => { /* NOSONAR */
    const showLoading = options?.showLoading ?? true;
    const append = options?.append ?? false;
    if (showLoading && !append) setLoading(true);
    if (append) setLoadingMore(true);
    setError(null);

    if (isReadOnly && activeTab === 'following' && !focusUserId && !isCustomList && !hasEntryFilter) {
      setEntries([]);
      setCursor(null);
      setHasMore(false);
      onCountChange?.(0);
      setPrivacyBlocked(false);
      if (!append) setLoading(false);
      if (append) setLoadingMore(false);
      return;
    }

    let userIdsForQuery: string[] | null = null;
    let entryIdsForQuery: string[] | null = null;

    if (hasEntryFilter) {
      if (!entryIdsFilter?.length) {
        if (!append) {
          setEntries([]);
          setCursor(null);
          setHasMore(false);
        }
        onCountChange?.(0);
        if (!append) setLoading(false);
        if (append) setLoadingMore(false);
        setPrivacyBlocked(false);
        return;
      }
      entryIdsForQuery = entryIdsFilter;
    } else if (isCustomList && userIdsFilter?.length) {
      userIdsForQuery = userIdsFilter;
    } else if (isCustomList) {
      if (!append) {
        setEntries([]);
        setCursor(null);
        setHasMore(false);
      }
      onCountChange?.(0);
      if (!append) setLoading(false);
      if (append) setLoadingMore(false);
      setPrivacyBlocked(false);
      return;
    } else if (focusUserId) {
      userIdsForQuery = [focusUserId];
    } else if (activeTab === 'following') {
      if (viewerId) {
        const { data: followsData, error: followsError } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', viewerId);

        if (followsError) {
          setError(followsError.message);
          if (!append) {
            setEntries([]);
            setCursor(null);
            setHasMore(false);
          }
          onCountChange?.(0);
          if (!append) setLoading(false);
          if (append) setLoadingMore(false);
          return;
        }

        userIdsForQuery = (followsData ?? []).map((row) => (row as { following_id: string }).following_id);
        if (!userIdsForQuery.length) {
          if (!append) {
            setEntries([]);
            setCursor(null);
            setHasMore(false);
          }
          onCountChange?.(0);
          if (!append) setLoading(false);
          if (append) setLoadingMore(false);
          return;
        }
      } else {
        userIdsForQuery = [];
      }
    }

    let query = supabase
      .from('entries')
      .select(
        `
          id,
          user_id,
          datetime,
          price,
          rating,
          is_burger,
          additional_notes,
          restaurant_id,
          burger_id,
          meat_type,
          burger_origin,
          photo_url,
          homemade_ingredients,
          restaurants ( name ),
          burgers ( name, meat_type )
        `
      )
      .order('datetime', { ascending: false })
      .order('id', { ascending: false })
      .limit(pageSize);

    const appendCursor = cursorRef.current;
    if (append && appendCursor) {
      query = query.or(`datetime.lt.${appendCursor.datetime},and(datetime.eq.${appendCursor.datetime},id.lt.${appendCursor.id})`);
    }

    if (entryIdsForQuery) {
      query = query.eq('visibility', 'public').in('id', entryIdsForQuery);
    } else if (isCustomList && userIdsForQuery) {
      query = query.eq('visibility', 'public').in('user_id', userIdsForQuery);
    } else if (focusUserId) {
      query = query.eq('visibility', 'public').eq('user_id', focusUserId);
    } else if (activeTab === 'global') {
      query = query.eq('visibility', 'public');
    } else if (activeTab === 'following' && userIdsForQuery) {
      query = query.eq('visibility', 'public').in('user_id', userIdsForQuery);
    }

    if ((focusUserId || isCustomList) && effectiveMonthFilter !== 'all') {
      const [yearStr, monthStr] = effectiveMonthFilter.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr);
      if (!Number.isNaN(year) && !Number.isNaN(month)) {
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 1);
        query = query.gte('datetime', start.toISOString()).lt('datetime', end.toISOString());
      }
    }

    const { data, error } = await query;

    if (error) {
      setError(error.message);
      if (!append) {
        setEntries([]);
        setCursor(null);
        setHasMore(false);
      }
      onCountChange?.(0);
      if (!append) setLoading(false);
      if (append) setLoadingMore(false);
      setPrivacyBlocked(false);
      return;
    }

    const rows = (data ?? []) as unknown as SupabaseEntryRow[];
    const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));

    let profileMap: Record<
      string,
      { username: string | null; display_name: string | null; avatar_url: string | null; is_private: boolean | null }
    > = {};
    if (userIds.length) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, is_private')
        .in('id', userIds);
      profileMap = Object.fromEntries(
        (profilesData ?? []).map((p) => [
          (p as { id: string }).id,
          {
            username: (p as { username: string | null }).username,
            display_name: (p as { display_name: string | null }).display_name,
            avatar_url: (p as { avatar_url: string | null }).avatar_url,
            is_private: (p as { is_private: boolean | null }).is_private,
          },
        ])
      );
    }

    if (focusUserId && !ignorePrivacy && !profileMap[focusUserId]) {
      const { data: focusProfile } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, is_private')
        .eq('id', focusUserId)
        .single();
      if (focusProfile) {
        profileMap[focusUserId] = {
          username: (focusProfile as { username: string | null }).username,
          display_name: (focusProfile as { display_name: string | null }).display_name,
          avatar_url: (focusProfile as { avatar_url: string | null }).avatar_url,
          is_private: (focusProfile as { is_private: boolean | null }).is_private,
        };
      }
    }

    let mutualIds = new Set<string>();
    if (!ignorePrivacy && userIds.length && viewerId && focusUserId !== viewerId) {
      const { data: follows } = await supabase
        .from('follows')
        .select('follower_id, following_id')
        .or(
          `and(follower_id.eq.${viewerId},following_id.in.(${userIds.join(',')})),and(following_id.eq.${viewerId},follower_id.in.(${userIds.join(',')}))`
        );
      const outgoingIds = new Set(
        (follows ?? [])
          .filter((row) => (row as { follower_id: string }).follower_id === viewerId)
          .map((row) => (row as { following_id: string }).following_id)
      );
      const incomingIds = new Set(
        (follows ?? [])
          .filter((row) => (row as { following_id: string }).following_id === viewerId)
          .map((row) => (row as { follower_id: string }).follower_id)
      );
      mutualIds = new Set([...outgoingIds].filter((id) => incomingIds.has(id)));
    }

    let mapped: FeedEntry[] = rows.map((entry) => {
      const profile = profileMap[entry.user_id];
      return {
        id: entry.id,
        userId: entry.user_id,
        username: profile?.username ?? 'usuario',
        displayName: profile?.display_name ?? null,
        avatarUrl: profile?.avatar_url ?? null,
        datetime: entry.datetime,
        price: entry.price ?? 0,
        currency: (entry as { currency?: string | null }).currency ?? 'EUR',
        rating: entry.rating ?? 0,
        isBurger: Boolean(entry.is_burger),
        additionalNotes: entry.additional_notes ?? null,
        restaurantId: entry.restaurant_id ?? null,
        burgerId: entry.burger_id ?? null,
        meatType: entry.meat_type ?? entry.burgers?.meat_type ?? null,
        restaurantName: entry.restaurants?.name ?? null,
        burgerName: entry.burgers?.name ?? null,
        photoUrl: entry.photo_url ?? null,
        burgerOrigin: entry.burger_origin ?? null,
        ingredients: entry.homemade_ingredients ?? null,
      };
    });

    if (!ignorePrivacy) {
      mapped = mapped.filter((entry) => {
        if (entry.userId === viewerId) return true;
        const profile = profileMap[entry.userId];
        if (!profile?.is_private) return true;
        return mutualIds.has(entry.userId);
      });
    }

    if (!ignorePrivacy && focusUserId) {
      const focusProfile = profileMap[focusUserId];
      const isPrivate = Boolean(focusProfile?.is_private);
      let isMutual = mutualIds.has(focusUserId);
      if (isPrivate && !isMutual && focusUserId !== viewerId) {
        const [{ data: out }, { data: inc }] = await Promise.all([
          supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', viewerId)
            .eq('following_id', focusUserId)
            .limit(1),
          supabase
            .from('follows')
            .select('follower_id')
            .eq('following_id', viewerId ?? '')
            .eq('follower_id', focusUserId)
            .limit(1),
        ]);
        isMutual = Boolean((out ?? []).length && (inc ?? []).length);
      }
      const canSee = focusUserId === viewerId || isMutual || !isPrivate;
      if (!canSee) {
        if (!append) {
          setEntries([]);
          setCursor(null);
          setHasMore(false);
        }
        onCountChange?.(0);
        if (!append) setLoading(false);
        if (append) setLoadingMore(false);
        setPrivacyBlocked(true);
        return;
      }
    }

    setPrivacyBlocked(false);
    const baseEntries = append ? entriesRef.current : [];
    const nextEntries = append ? [...baseEntries, ...mapped] : mapped;
    const seen = new Set<string>();
    const deduped = nextEntries.filter((entry) => {
      if (seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    });
    const lastEntry = deduped.at(-1) ?? null;
    const nextCursor = lastEntry ? { datetime: lastEntry.datetime, id: lastEntry.id } : null;
    setEntries(deduped);
    setCursor(nextCursor);
    setHasMore((data ?? []).length === pageSize);
    onCountChange?.(deduped.length);
    if (!options?.skipCache) {
      try {
        sessionStorage.setItem(entriesCacheKey, JSON.stringify(deduped));
      } catch {
        // Ignore cache write errors (private mode, quota, etc.).
      }
    }
    if (!append) setLoading(false);
    if (append) setLoadingMore(false);
  }, [
    activeTab,
    viewerId,
    effectiveMonthFilter,
    entriesCacheKey,
    entryIdsFilter,
    focusUserId,
    hasEntryFilter,
    ignorePrivacy,
    isReadOnly,
    isCustomList,
    onCountChange,
    pageSize,
    userIdsFilter,
  ]);

  useEffect(() => {
    if (hideHeader) return;
    if (!focusUserId && !isCustomList) return;
    if (hasEntryFilter && !entryIdsFilter?.length) {
      const locale = getLocale(i18n.language);
      const options = buildMonthOptions([], locale, i18n.t('feedTabs.all'));
      startTransition(() => setMonthOptions(options));
      return;
    }
    let cancelled = false;
    let usedCache = false;

    if (monthCacheKey) {
      const cached = sessionStorage.getItem(monthCacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as MonthOption[];
          if (!cancelled) {
            const locale = getLocale(i18n.language);
            const values = parsed.filter((option) => option.value !== 'all').map((option) => option.value);
            const nextOptions = buildMonthOptions(values, locale, i18n.t('feedTabs.all'));
            startTransition(() => {
              setMonthOptions(nextOptions);
            });
            usedCache = true;
          }
        } catch {
          // Fall through to fetch.
        }
      }
    }

    if (usedCache) {
      return () => {
        cancelled = true;
      };
    }

    const loadMonths = async () => {
      let query = supabase
        .from('entries')
        .select('datetime')
        .eq('visibility', 'public')
        .order('datetime', { ascending: false })
        .limit(500);

      if (entryIdsFilter?.length) {
        query = query.in('id', entryIdsFilter);
      } else if (focusUserId) {
        query = query.eq('user_id', focusUserId);
      } else if (isCustomList && userIdsFilter?.length) {
        query = query.in('user_id', userIdsFilter);
      }

      const { data, error } = await query;

      if (cancelled) return;

      if (error) {
        console.error('Error cargando meses', error);
        const locale = getLocale(i18n.language);
        setMonthOptions(buildMonthOptions([], locale, i18n.t('feedTabs.all')));
        return;
      }

      const seen = new Set<string>();
      const locale = getLocale(i18n.language);
      (data ?? []).forEach((row) => {
        const date = new Date((row as { datetime: string }).datetime);
        if (Number.isNaN(date.getTime())) return;
        const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (seen.has(value)) return;
        seen.add(value);
      });
      const options = buildMonthOptions(Array.from(seen), locale, i18n.t('feedTabs.all'));
      setMonthOptions(options);
      if (monthCacheKey) {
        try {
          sessionStorage.setItem(monthCacheKey, JSON.stringify(options));
        } catch {
          // Ignore cache write errors (private mode, quota, etc.).
        }
      }
    };

    loadMonths();

    return () => {
      cancelled = true;
    };
  }, [entryIdsFilter, focusUserId, hasEntryFilter, hideHeader, isCustomList, monthCacheKey, userIdsFilter, i18n.language]);

  useEffect(() => {
    if (headerOnly) return;
    let isCancelled = false;
    let usedCache = false;

    if (refreshKey === 0 && !hasEntryFilter) {
      const cached = sessionStorage.getItem(entriesCacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as FeedEntry[];
          if (!isCancelled && parsed.length) {
            startTransition(() => {
              setEntries(parsed);
              onCountChange?.(parsed.length);
              setLoading(false);
              setError(null);
              if (focusUserId && !ignorePrivacy) {
                checkFocusPrivacy();
              } else {
                setPrivacyBlocked(false);
              }
            });
            usedCache = true;
          }
        } catch {
          // Fall through to fetch.
        }
      }
    }

    if (usedCache) {
      startTransition(() => {
        setHasMore(true);
        const cached = sessionStorage.getItem(entriesCacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as FeedEntry[];
            const last = parsed.at(-1) ?? null;
            setCursor(last ? { datetime: last.datetime, id: last.id } : null);
          } catch {
            setCursor(null);
          }
        }
      });
    } else {
      startTransition(() => {
        setHasMore(true);
        setCursor(null);
        loadEntries();
      });
    }

    return () => {
      isCancelled = true;
    };
  }, [checkFocusPrivacy, entriesCacheKey, focusUserId, headerOnly, ignorePrivacy, loadEntries, onCountChange, refreshKey]);

  useEffect(() => {
    if (headerOnly) return;
    const channel = supabase
      .channel(`feed-entries-${viewerKey}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'entries' },
        (payload) => { /* NOSONAR */
          const row = (payload.new ?? payload.old) as { user_id?: string; visibility?: string | null } | null;
          if (isCustomList) {
            if (!row?.user_id || !userIdsFilter?.includes(row.user_id)) return;
            if (row?.visibility && row.visibility !== 'public') return;
          } else if (focusUserId) {
            if (row?.user_id !== focusUserId) return;
            if (row?.visibility && row.visibility !== 'public') return;
          } else if (activeTab === 'global') {
            if (row?.visibility && row.visibility !== 'public') return;
          }
          if (document.visibilityState !== 'visible') return;
          const now = Date.now();
          if (now - lastRealtimeRef.current < 60000) return;
          lastRealtimeRef.current = now;
          loadEntries({ showLoading: false, skipCache: true });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab, focusUserId, headerOnly, isCustomList, loadEntries, userIdsFilter, viewerKey]);

  useRevalidateOnFocus(
    () => {
      if (headerOnly) return;
      setHasMore(true);
      setCursor(null);
      loadEntries({ showLoading: false, skipCache: true });
    },
    [headerOnly, loadEntries],
    { minIntervalMs: 180000, maxStaleMs: 900000, debounceMs: 500 }
  );

  useEffect(() => {
    if (headerOnly) return;
    if (loading || loadingMore || !hasMore || privacyBlocked) return;
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entriesList) => {
        const entry = entriesList[0];
        if (!entry?.isIntersecting) return;
        loadEntries({ showLoading: false, skipCache: true, append: true });
      },
      { root: null, rootMargin: '200px', threshold: 0 }
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [hasMore, headerOnly, loadEntries, loading, loadingMore, privacyBlocked]);

  return {
    activeTab,
    setActiveTab,
    entries,
    loading,
    loadingMore,
    hasMore,
    error,
    privacyBlocked,
    monthOptions,
    effectiveMonthFilter,
    setEffectiveMonthFilter,
    authNotice,
    setAuthNotice,
    loadMoreRef,
    viewerId,
    isUserFeed,
    isCustomList,
    hasEntryFilter,
  };
}
