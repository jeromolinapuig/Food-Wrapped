import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { EmojiEvents, Euro, LunchDining, Star } from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import { AddEntryModal } from '../AddEntryModal/AddEntryModal';
import { FeedTabs } from '../FeedTabs/FeedTabs';
import { StatCard } from '../StatCard/StatCard';
import { lockBodyScroll } from '../../utils/scrollLock';
import { useRevalidateOnFocus } from '../../utils/useRevalidateOnFocus';
import '../../styles/layout.css';
import '../../styles/shared.css';
import './Dashboard.css';

type DashboardProps = {
  session: Session;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onNavigate: (page: 'dashboard' | 'feed' | 'profile' | 'groups') => void;
};

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
  is_burger: boolean;
  additionalNotes?: string | null;
  restaurantId?: string | null;
  restaurantName?: string | null;
  burgerId?: string | null;
  burgerName?: string | null;
  meatType?: MeatType | null;
  photoUrl?: string | null;
};

export function Dashboard({ session, theme }: DashboardProps) {
  const username = (session.user.user_metadata as { username?: string } | null)?.username;
  const [entries, setEntries] = useState<DbEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [postsCount, setPostsCount] = useState(0);
  const [monthFilter, setMonthFilter] = useState<'all' | string>('all');
  const [refreshFeedKey, setRefreshFeedKey] = useState(0);
  const [mutating, setMutating] = useState(false);
  const [editingEntry, setEditingEntry] = useState<EditEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<EditEntry | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<unknown>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const cacheKey = `bw-dashboard-entries-${session.user.id}-2026`;
  const openAddModal = () => {
    setEditingEntry(null);
    setIsAddModalOpen(true);
  };
  const closeAddModal = () => {
    setIsAddModalOpen(false);
    setEditingEntry(null);
  };

  // --- Cargar entradas del año 2026 ---
  const loadEntries = useCallback(async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading ?? true;
    if (showLoading) setLoading(true);
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
        additional_notes,
        restaurant_id,
        burger_id,
        photo_url,
        restaurant:restaurants ( name ),
        burger:burgers ( name, meat_type )
      `
      )
      .gte('datetime', from)
      .lt('datetime', to)
      .eq('user_id', session.user.id)
      .order('datetime', { ascending: false });

    if (error) {
      setError(error.message);
      setEntries([]);
    } else {
      const nextEntries = (data ?? []) as unknown as DbEntryRow[];
      setEntries(nextEntries);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(nextEntries));
      } catch {
        // Ignore cache write errors (private mode, quota, etc.).
      }
    }

    setLoading(false);
  }, [cacheKey, session.user.id]);

  useEffect(() => {
    let cancelled = false;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as DbEntryRow[];
        if (!cancelled) {
          setEntries(parsed);
          setLoading(false);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          loadEntries();
        }
      }
    } else {
      loadEntries();
    }

    // Suscripción a cambios en la tabla de entries para refrescar el feed en tiempo real
    const channel = supabase
      .channel('entries-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'entries' },
        () => {
          loadEntries({ showLoading: false });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [cacheKey, loadEntries, session.user.id]);

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

  useRevalidateOnFocus(() => {
    loadEntries({ showLoading: false });
  }, [loadEntries]);

  useEffect(() => {
    if (!showInstallBanner && !deleteEntry) return;
    return lockBodyScroll();
  }, [deleteEntry, showInstallBanner]);


  const handleInstallClick = async () => {
    if (installPromptEvent) {
      const promptEvent = installPromptEvent as { prompt: () => Promise<void>; userChoice?: Promise<{ outcome: string }> };
      await promptEvent.prompt?.();
    }
    setShowInstallBanner(false);
    setInstallPromptEvent(null);
  };

  // --- Stats calculadas ---
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

    for (const e of entries) {
      if (e.price != null) totalSpent += e.price;
      if (e.is_burger) burgerCount++;

      if (e.rating != null) {
        ratingSum += e.rating;
        ratingCount++;
      }

      const restaurantName = e.restaurant?.name;
      if (restaurantName) {
        restaurantCounter.set(
          restaurantName,
          (restaurantCounter.get(restaurantName) ?? 0) + 1
        );
      }

      const meat = e.burger?.meat_type;
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

  const handleEntrySaved = async () => {
    await loadEntries();
    setRefreshFeedKey((prev) => prev + 1);
    setEditingEntry(null);
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
        .delete()
        .eq('id', deleteEntry.id);
      if (deleteError) throw deleteError;
      await loadEntries();
      setRefreshFeedKey((prev) => prev + 1);
      setDeleteEntry(null);
    } catch (err) {
      console.error(err);
      alert('No se pudo eliminar la entrada.');
    } finally {
      setMutating(false);
    }
  };

  return (
    <div className="bw-app-root">
      <div className="bw-shell">
        <header className="bw-header">
          <div className="bw-header-icon">
            <img src="/logo.png" alt="Burger Wrapped" />
          </div>
          <div style={{ flex: 1 }}>
            <h1 className="bw-title">Burger Wrapped</h1>
            <p className="bw-subtitle">
              Tu año 2026 en hamburguesas - {username ?? session.user.email}
            </p>
          </div>

        </header>

        {showInstallBanner && (
          <div className="bw-install-modal">
            <div className="bw-install-modal-card">
              <div className="bw-install-modal-body">
                <div>
                  <div className="bw-install-title">Instala la app</div>
                  <div className="bw-install-text">Añádela a tu pantalla de inicio para abrirla rápido.</div>
                </div>
                <div className="bw-install-actions">
                  <button className="bw-btn bw-btn-ghost" type="button" onClick={() => setShowInstallBanner(false)}>
                    Más tarde
                  </button>
                  <button className="bw-btn bw-btn-primary" type="button" onClick={handleInstallClick}>
                    Instalar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <main className="bw-main">
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

          <section className="bw-history">
            <div className="bw-section-header">
              <h2 className="bw-section-title">Posts ({postsCount})</h2>
              <div className="bw-section-right">
                <FeedTabs
                  currentUserId={session.user.id}
                  focusUserId={session.user.id}
                  onCountChange={setPostsCount}
                  headerOnly
                  monthFilter={monthFilter}
                  onMonthFilterChange={setMonthFilter}
                  refreshKey={refreshFeedKey}
                />
              </div>
            </div>
            {error && <p style={{ color: 'red', fontSize: 12 }}>{error}</p>}
            <FeedTabs
              currentUserId={session.user.id}
              focusUserId={session.user.id}
              onCountChange={setPostsCount}
              hideHeader
              monthFilter={monthFilter}
              onMonthFilterChange={setMonthFilter}
              refreshKey={refreshFeedKey}
              showOwnerActions
              onEditEntry={(entry) =>
                handleEditEntry({
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
                })
              }
            />
          </section>

        </main>

        <div className="bw-fab-wrapper">
          <button
            className="bw-fab"
            onClick={openAddModal}
            aria-label="Añadir entrada"
          >
            <span className="bw-fab-plus">+</span>
            <span className="bw-fab-label">Añadir</span>
          </button>
        </div>
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

      {deleteEntry && (
        <div className="bw-confirm-backdrop" onClick={() => (!mutating ? setDeleteEntry(null) : null)}>
          <div className="bw-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="bw-confirm-title">Eliminar entrada</h3>
            <p className="bw-confirm-text">
              ¿Seguro que deseas eliminar la entrada del{' '}
              {new Date(deleteEntry.datetime).toLocaleString('es-ES', {
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              })}
              {' '}en {deleteEntry.restaurantName ?? 'restaurante desconocido'}?
            </p>
            <div className="bw-confirm-actions">
              <button
                className="bw-btn bw-btn-ghost"
                type="button"
                onClick={() => setDeleteEntry(null)}
                disabled={mutating}
              >
                Cancelar
              </button>
              <button
                className="bw-btn bw-btn-danger"
                type="button"
                onClick={handleDeleteEntry}
                disabled={mutating}
              >
                {mutating ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}



    </div>
  );
}



