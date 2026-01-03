// src/components/Dashboard.tsx
import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { AddEntryModal } from './AddEntryModal';

type DashboardProps = {
  session: Session;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
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
  restaurant: { name: string } | null;
  burger: { name: string | null; meat_type: MeatType | null } | null;
};

export function Dashboard({ session, theme, onToggleTheme }: DashboardProps) {
  const [entries, setEntries] = useState<DbEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const openAddModal = () => setIsAddModalOpen(true);
  const closeAddModal = () => setIsAddModalOpen(false);

  // --- Cargar entradas del año 2026 ---
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
        restaurant:restaurants ( name ),
        burger:burgers ( name, meat_type )
      `
      )
      .gte('datetime', from)
      .lt('datetime', to)
      .order('datetime', { ascending: false });

    if (error) {
      setError(error.message);
      setEntries([]);
    } else {
      setEntries((data ?? []) as unknown as DbEntryRow[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    const fetchData = async () => {
      await loadEntries();
    };
    fetchData();
  }, [session.user.id]);

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

  const renderStars = (rating: number) =>
    '*****-----'.slice(5 - rating, 10 - rating); // simple visual stars

  const handleEntrySaved = async () => {
    await loadEntries();
  };

  return (
    <div className="bw-app-root">
      <div className="bw-shell">
        <header className="bw-header">
          <div className="bw-header-icon">BW</div>
          <div style={{ flex: 1 }}>
            <h1 className="bw-title">Burger Wrapped</h1>
            <p className="bw-subtitle">
              Tu año 2026 en hamburguesas - Conectado como {session.user.email}
            </p>
          </div>

          <button
            type="button"
            className="bw-icon-button"
            onClick={onToggleTheme}
            aria-label="Cambiar tema"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </header>

        <main className="bw-main">
          <section className="bw-stats-grid">
            <article className="bw-stat-card">
              <div className="bw-stat-icon">€</div>
              <div className="bw-stat-value">{stats.totalSpent.toFixed(2)}€</div>
              <div className="bw-stat-label">Total gastado</div>
            </article>

            <article className="bw-stat-card">
              <div className="bw-stat-icon">HB</div>
              <div className="bw-stat-value">{stats.totalBurgers}</div>
              <div className="bw-stat-label">Hamburguesas</div>
            </article>

            <article className="bw-stat-card">
              <div className="bw-stat-icon">★</div>
              <div className="bw-stat-value">
                {stats.averageRating ? stats.averageRating.toFixed(1) : '-'}
              </div>
              <div className="bw-stat-label">Nota media</div>
            </article>

            <article className="bw-stat-card">
              <div className="bw-stat-icon">Fav</div>
              <div className="bw-stat-value">
                {stats.favoriteRestaurant || '-'}
              </div>
              <div className="bw-stat-label">Favorito</div>
            </article>
          </section>

          <section className="bw-card bw-burger-types">
            <h2 className="bw-section-title">Tipos de hamburguesa</h2>
            <div className="bw-burger-types-row">
              <div className="bw-burger-type">
                <span className="bw-burger-type-emoji">B</span>
                <span>{stats.burgerTypes.beef}</span>
              </div>
              <div className="bw-burger-type">
                <span className="bw-burger-type-emoji">P</span>
                <span>{stats.burgerTypes.chicken}</span>
              </div>
              <div className="bw-burger-type">
                <span className="bw-burger-type-emoji">V</span>
                <span>{stats.burgerTypes.vegan}</span>
              </div>
            </div>
          </section>

          <section className="bw-history">
            <h2 className="bw-section-title">HISTORIAL ({entries.length})</h2>

            <div className="bw-history-list">
              {loading && <p>Cargando...</p>}
              {error && <p style={{ color: 'red', fontSize: 12 }}>{error}</p>}
              {!loading && !entries.length && !error && (
                <p style={{ fontSize: 13, opacity: 0.8 }}>
                  Todavía no tienes comidas registradas en 2026.
                </p>
              )}

              {!loading &&
                entries.map((entry) => {
                  const restaurantName = entry.restaurant?.name ?? '-';
                  const burgerName = entry.burger?.name ?? undefined;
                  const date = new Date(entry.datetime);
                  const formatted = date.toLocaleString('es-ES', {
                    day: 'numeric',
                    month: 'long',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <article key={entry.id} className="bw-history-card">
                      <div className="bw-history-header">
                        <div>
                          <div className="bw-history-restaurant">
                            <span className="bw-history-meat-icon">R</span>
                            <span>{restaurantName}</span>
                          </div>
                          {burgerName && (
                            <div className="bw-history-burger-name">{burgerName}</div>
                          )}
                          <div className="bw-history-meta">
                            <span>Hora</span>
                            <span>{formatted}</span>
                          </div>
                        </div>
                        {entry.rating != null && (
                          <div className="bw-history-rating">
                            {renderStars(entry.rating)}
                          </div>
                        )}
                      </div>

                      <div className="bw-history-footer">
                        <div className="bw-history-price">
                          € {entry.price != null ? entry.price.toFixed(2) : '-'}
                        </div>
                        <div className="bw-history-actions">
                          <button
                            className="bw-icon-button"
                            title="Editar entrada"
                          >
                            Edit
                          </button>
                          <button
                            className="bw-icon-button bw-icon-danger"
                            title="Eliminar entrada"
                          >
                            Del
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
            </div>
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
      />
    </div>
  );
}
