import { useCallback, useEffect, useState } from 'react';
import { Close, Delete, Edit } from '@mui/icons-material';
import { supabase } from '../lib/supabaseClient';
import '../styles/shared.css';
import '../styles/feed-tabs.css';
import '../styles/entry-card.css';

type FeedTab = 'following' | 'global';

type FeedTabsProps = {
  currentUserId: string;
  refreshKey?: number;
  onOpenProfile?: (userId: string) => void;
  focusUserId?: string | null;
  onCountChange?: (count: number) => void;
  hideHeader?: boolean;
  headerOnly?: boolean;
  monthFilter?: 'all' | string;
  onMonthFilterChange?: (value: 'all' | string) => void;
  showOwnerActions?: boolean;
  onEditEntry?: (entry: FeedEntry) => void;
  onDeleteEntry?: (entry: FeedEntry) => void;
};

type FeedEntry = {
  id: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  datetime: string;
  price: number;
  rating: number;
  isBurger: boolean;
  additionalNotes: string | null;
  restaurantId: string | null;
  burgerId: string | null;
  meatType: 'beef' | 'chicken' | 'vegan' | 'other' | null;
  restaurantName: string | null;
  burgerName: string | null;
  photoUrl: string | null;
};

type SupabaseEntryRow = {
  id: string;
  user_id: string;
  datetime: string;
  price: number | null;
  rating: number | null;
  is_burger: boolean | null;
  additional_notes: string | null;
  restaurant_id: string | null;
  burger_id: string | null;
  visibility?: string | null;
  photo_url: string | null;
  restaurants: { name: string | null } | null;
  burgers: { name: string | null; meat_type: 'beef' | 'chicken' | 'vegan' | 'other' | null } | null;
};

const renderStarString = (rating: number) => {
  const safeRating = Math.max(0, Math.min(5, Math.round(rating)));
  return '★★★★★☆☆☆☆☆'.slice(5 - safeRating, 10 - safeRating);
};

const Avatar = ({ username, avatarUrl }: { username: string; avatarUrl: string | null }) => {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={username} className="bw-avatar-image" />;
  }

  const initial = username?.[0]?.toUpperCase() ?? '?';
  return <div className="bw-avatar-placeholder">{initial}</div>;
};

export function FeedTabs({
  currentUserId,
  refreshKey = 0,
  onOpenProfile,
  focusUserId,
  onCountChange,
  hideHeader = false,
  headerOnly = false,
  monthFilter,
  onMonthFilterChange,
  showOwnerActions = false,
  onEditEntry,
  onDeleteEntry,
}: Readonly<FeedTabsProps>) {
  const [activeTab, setActiveTab] = useState<FeedTab>('global');
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const isUserFeed = Boolean(focusUserId);
  const [internalMonthFilter, setInternalMonthFilter] = useState<'all' | string>('all');
  const [monthOptions, setMonthOptions] = useState<{ value: string; label: string }[]>([{ value: 'all', label: 'Todo' }]);
  const effectiveMonthFilter = monthFilter ?? internalMonthFilter;
  const setEffectiveMonthFilter = onMonthFilterChange ?? setInternalMonthFilter;
  const monthCacheKey = focusUserId ? `bw-feed-months-${focusUserId}` : null;
  const entriesCacheKey = `bw-feed-entries-${currentUserId}-${focusUserId ?? 'global'}-${activeTab}-${effectiveMonthFilter}`;

  const loadEntries = useCallback(async (options?: { showLoading?: boolean; skipCache?: boolean }) => {
    const showLoading = options?.showLoading ?? true;
    if (showLoading) setLoading(true);
    setError(null);

    let userIdsForQuery: string[] | null = null;

    if (focusUserId) {
      userIdsForQuery = [focusUserId];
    } else if (activeTab === 'following') {
      const { data: followsData, error: followsError } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUserId);

      if (followsError) {
        setError(followsError.message);
        setEntries([]);
        onCountChange?.(0);
        setLoading(false);
        return;
      }

      userIdsForQuery = (followsData ?? []).map((row) => (row as { following_id: string }).following_id);
      if (!userIdsForQuery.length) {
        setEntries([]);
        onCountChange?.(0);
        setLoading(false);
        return;
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
          visibility,
          photo_url,
          restaurants ( name ),
          burgers ( name, meat_type )
        `
      )
      .order('datetime', { ascending: false })
      .limit(50);

    if (focusUserId) {
      query = query.eq('visibility', 'public').eq('user_id', focusUserId);
    } else if (activeTab === 'global') {
      query = query.eq('visibility', 'public');
    } else if (activeTab === 'following' && userIdsForQuery) {
      query = query.eq('visibility', 'public').in('user_id', userIdsForQuery);
    }

    if (focusUserId && effectiveMonthFilter !== 'all') {
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
      setEntries([]);
      onCountChange?.(0);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as unknown as SupabaseEntryRow[];
    const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));

    let profileMap: Record<string, { username: string | null; display_name: string | null; avatar_url: string | null }> = {};
    if (userIds.length) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', userIds);
      profileMap = Object.fromEntries(
        (profilesData ?? []).map((p) => [
          (p as { id: string }).id,
          {
            username: (p as { username: string | null }).username,
            display_name: (p as { display_name: string | null }).display_name,
            avatar_url: (p as { avatar_url: string | null }).avatar_url,
          },
        ])
      );
    }

    const mapped: FeedEntry[] = rows.map((entry) => {
      const profile = profileMap[entry.user_id];
      return {
        id: entry.id,
        userId: entry.user_id,
        username: profile?.username ?? 'usuario',
        displayName: profile?.display_name ?? null,
        avatarUrl: profile?.avatar_url ?? null,
        datetime: entry.datetime,
        price: entry.price ?? 0,
        rating: entry.rating ?? 0,
        isBurger: Boolean(entry.is_burger),
        additionalNotes: entry.additional_notes ?? null,
        restaurantId: entry.restaurant_id ?? null,
        burgerId: entry.burger_id ?? null,
        meatType: entry.burgers?.meat_type ?? null,
        restaurantName: entry.restaurants?.name ?? null,
        burgerName: entry.burgers?.name ?? null,
        photoUrl: entry.photo_url ?? null,
      };
    });

    setEntries(mapped);
    onCountChange?.(mapped.length);
    if (!options?.skipCache) {
      try {
        sessionStorage.setItem(entriesCacheKey, JSON.stringify(mapped));
      } catch {
        // Ignore cache write errors (private mode, quota, etc.).
      }
    }
    setLoading(false);
  }, [
    activeTab,
    currentUserId,
    effectiveMonthFilter,
    entriesCacheKey,
    focusUserId,
    onCountChange,
  ]);

  useEffect(() => {
    if (!focusUserId) return;
    let cancelled = false;

    if (monthCacheKey) {
      const cached = sessionStorage.getItem(monthCacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as { value: string; label: string }[];
          if (!cancelled) {
            setMonthOptions(parsed);
            return () => {
              cancelled = true;
            };
          }
        } catch {
          // Fall through to fetch.
        }
      }
    }

    const loadMonths = async () => {
      const { data, error } = await supabase
        .from('entries')
        .select('datetime')
        .eq('visibility', 'public')
        .eq('user_id', focusUserId)
        .order('datetime', { ascending: false })
        .limit(500);

      if (cancelled) return;

      if (error) {
        console.error('Error cargando meses', error);
        setMonthOptions([{ value: 'all', label: 'Todo' }]);
        return;
      }

      const seen = new Set<string>();
      const options: { value: string; label: string }[] = [{ value: 'all', label: 'Todo' }];
      const now = new Date();
      const currentYear = now.getFullYear();
      (data ?? []).forEach((row) => {
        const date = new Date((row as { datetime: string }).datetime);
        if (Number.isNaN(date.getTime())) return;
        const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (seen.has(value)) return;
        seen.add(value);
        const label = date.getFullYear() === currentYear
          ? date.toLocaleString('es-ES', { month: 'long' })
          : date.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
        options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
      });
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
  }, [focusUserId]);

  useEffect(() => {
    if (headerOnly) return;
    let isCancelled = false;

    if (refreshKey === 0) {
      const cached = sessionStorage.getItem(entriesCacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as FeedEntry[];
          if (!isCancelled) {
            setEntries(parsed);
            onCountChange?.(parsed.length);
            setLoading(false);
            setError(null);
            return () => {
              isCancelled = true;
            };
          }
        } catch {
          // Fall through to fetch.
        }
      }
    }

    loadEntries();

    return () => {
      isCancelled = true;
    };
  }, [entriesCacheKey, headerOnly, loadEntries, onCountChange, refreshKey]);

  useEffect(() => {
    if (headerOnly) return;
    const channel = supabase
      .channel(`feed-entries-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'entries' },
        (payload) => {
          const row = (payload.new ?? payload.old) as { user_id?: string; visibility?: string | null } | null;
          if (focusUserId) {
            if (row?.user_id !== focusUserId) return;
            if (row?.visibility && row.visibility !== 'public') return;
          } else if (activeTab === 'global') {
            if (row?.visibility && row.visibility !== 'public') return;
          }
          loadEntries({ showLoading: false, skipCache: true });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab, currentUserId, focusUserId, headerOnly, loadEntries]);

  const renderPlaceholderText = () => {
    if (isUserFeed && effectiveMonthFilter !== 'all') return 'Este usuario no tiene comidas públicas en este mes.';
    if (isUserFeed) return 'Este usuario no tiene comidas públicas todavía.';
    if (activeTab === 'following') return 'No hay entradas públicas de la gente a la que sigues.';
    return 'No hay comidas todavía en este feed.';
  };

  return (
    <section className="bw-feed">
      {!hideHeader && !isUserFeed && (
        <div className="bw-feed-header">
          <div className="bw-feed-tabs bw-feed-tabs-duo" style={{ margin: '0 auto' }}>
            <button
              type="button"
              className={`bw-feed-tab ${activeTab === 'following' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('following')}
            >
              Siguiendo
            </button>
            <button
              type="button"
              className={`bw-feed-tab ${activeTab === 'global' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('global')}
            >
              Global
            </button>
          </div>
        </div>
      )}

      {!hideHeader && isUserFeed && (
        <div className="bw-feed-filter bw-feed-filter-inline">
          <div className="bw-select-wrap">
            <select
              id="bw-user-feed-month"
              className="bw-select bw-select-compact"
              value={effectiveMonthFilter}
              onChange={(e) => setEffectiveMonthFilter(e.target.value as 'all' | string)}
            >
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {headerOnly && !hideHeader ? null : (
      <div className="bw-history-list">
        {loading && (
          <>
            <div className="bw-history-card bw-skeleton">
              <div className="bw-skeleton-line bw-skeleton-short" />
              <div className="bw-skeleton-line" />
              <div className="bw-skeleton-line" />
            </div>
            <div className="bw-history-card bw-skeleton">
              <div className="bw-skeleton-line bw-skeleton-short" />
              <div className="bw-skeleton-line" />
              <div className="bw-skeleton-line" />
            </div>
          </>
        )}
        {error && <p style={{ color: 'red', fontSize: 12 }}>{error}</p>}
        {!loading && !entries.length && <p style={{ fontSize: 13, opacity: 0.8 }}>{renderPlaceholderText()}</p>}

        {!loading &&
          entries.map((entry) => {
            const date = new Date(entry.datetime);
            const formattedDate = date.toLocaleString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
            const isSelf = entry.userId === currentUserId;
            const shouldDisableProfileClick = isSelf || isUserFeed;
            const name = isSelf ? 'Tú' : entry.displayName || entry.username;
            const stars = renderStarString(entry.rating);
            const canEdit = showOwnerActions && isSelf;

            return (
              <article className="bw-history-card bw-feed-entry" key={entry.id}>
                <div className="bw-feed-entry-header">
                  {shouldDisableProfileClick ? (
                    <div className="bw-feed-user">
                      <div className="bw-avatar">
                        <Avatar username={entry.username} avatarUrl={entry.avatarUrl} />
                      </div>
                      <div>
                        <div className="bw-feed-user-name">{name}</div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="bw-feed-user as-button"
                      onClick={() => onOpenProfile?.(entry.userId)}
                    >
                      <div className="bw-avatar">
                        <Avatar username={entry.username} avatarUrl={entry.avatarUrl} />
                      </div>
                      <div>
                        <div className="bw-feed-user-name">{name}</div>
                      </div>
                    </button>
                  )}
                  <div className="bw-feed-datetime">{formattedDate}</div>
                </div>

                <div className="bw-feed-body">
                  <div className="bw-feed-restaurant">
                    <div className="bw-history-restaurant">{entry.restaurantName ?? 'Restaurante'}</div>
                    {entry.burgerName && <div className="bw-feed-burger">{entry.burgerName}</div>}
                  </div>

                  {entry.photoUrl && (
                    <button
                      type="button"
                      className="bw-feed-photo"
                      onClick={() => setPhotoPreviewUrl(entry.photoUrl)}
                    >
                      <img src={entry.photoUrl} alt={entry.burgerName ?? entry.restaurantName ?? 'Foto de la entrada'} />
                    </button>
                  )}

                  {entry.additionalNotes && (
                    <p className="bw-feed-notes">{entry.additionalNotes}</p>
                  )}

                  <div className="bw-feed-footer">
                    <div className="bw-feed-rating">
                      <span className="bw-feed-stars">{stars}</span>
                      <span className="bw-feed-rating-number">
                        {entry.rating ? `${entry.rating.toFixed(1)}` : 'Sin nota'}
                      </span>
                    </div>
                    <div className="bw-feed-footer-right">
                      <div className="bw-feed-price">€ {entry.price.toFixed(2)}</div>
                      {canEdit && (
                        <div className="bw-history-actions">
                          <button
                            className="bw-icon-button"
                            title="Editar entrada"
                            onClick={() => onEditEntry?.(entry)}
                          >
                            <Edit fontSize="small" />
                          </button>
                          <button
                            className="bw-icon-button bw-icon-danger"
                            title="Eliminar entrada"
                            onClick={() => onDeleteEntry?.(entry)}
                          >
                            <Delete fontSize="small" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
      })}
      </div>
      )}

      {photoPreviewUrl && (
        <div className="bw-photo-viewer-backdrop" onClick={() => setPhotoPreviewUrl(null)}>
          <div className="bw-photo-viewer" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="bw-photo-viewer-close"
              onClick={() => setPhotoPreviewUrl(null)}
              aria-label="Cerrar imagen"
            >
              <Close />
            </button>
            <img src={photoPreviewUrl} alt="Foto de la entrada" />
          </div>
        </div>
      )}
    </section>
  );
}
