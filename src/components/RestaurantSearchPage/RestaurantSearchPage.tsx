import { startTransition, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabaseClient';
import { whereNotDeleted } from '../../lib/whereNotDeleted';
import { AppShell } from '../common/AppShell';
import { PageHeader } from '../common/PageHeader';
import { AddEntryModal } from '../AddEntryModal/AddEntryModal';
import { FeedTabs } from '../FeedTabs/FeedTabs';
import '../../styles/shared.css';
import './RestaurantSearchPage.css';

type RestaurantOption = {
  id: string;
  name: string;
};

type RestaurantSearchPageProps = {
  session: Session;
  theme: 'light' | 'dark';
};

type RestaurantSearchContentProps = RestaurantSearchPageProps & {
  returnTo?: string;
};

type RestaurantSearchLocationState = {
  selectedRestaurantId?: string;
  selectedRestaurantName?: string;
};

type TriedBurgerCard = {
  id: string;
  burgerName: string;
  restaurantName: string;
  photoUrl: string | null;
  rating: number | null;
};

const normalizeName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();

const normalizeCompact = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .trim()
    .toLowerCase();

export function RestaurantSearchContent({
  session,
  theme,
  returnTo = '/restaurants',
}: Readonly<RestaurantSearchContentProps>) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantOption | null>(null);
  const [activeTab, setActiveTab] = useState<'mine' | 'friends' | 'all'>('mine');
  const [mineCount, setMineCount] = useState(0);
  const [triedBurgerCards, setTriedBurgerCards] = useState<TriedBurgerCard[]>([]);
  const [mutualIds, setMutualIds] = useState<Set<string> | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [refreshFeedKey, setRefreshFeedKey] = useState(0);

  useEffect(() => {
    const state = location.state as RestaurantSearchLocationState | null;
    const selectedRestaurantId = state?.selectedRestaurantId?.trim();
    const selectedRestaurantName = state?.selectedRestaurantName?.trim();
    if (!selectedRestaurantId || !selectedRestaurantName) return;

    startTransition(() => {
      setSelectedRestaurant({ id: selectedRestaurantId, name: selectedRestaurantName });
      setActiveTab('mine');
    });
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    let cancelled = false;
    const loadMutuals = async () => {
      const viewerId = session.user.id;
      const [{ data: outData, error: outError }, { data: incData, error: incError }] = await Promise.all([
        supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', viewerId),
        supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', viewerId),
      ]);

      if (cancelled) return;
      if (outError || incError) {
        console.error(outError ?? incError);
        setMutualIds(new Set());
        return;
      }

      const outgoing = new Set((outData ?? []).map((row) => (row as { following_id: string }).following_id));
      const incoming = new Set((incData ?? []).map((row) => (row as { follower_id: string }).follower_id));
      const mutuals = new Set<string>([...outgoing].filter((id) => incoming.has(id)));
      setMutualIds(mutuals);
    };

    void loadMutuals();

    return () => {
      cancelled = true;
    };
  }, [session.user.id]);

  useEffect(() => {
    let cancelled = false;

    const loadMineCount = async () => {
      if (!selectedRestaurant) {
        setMineCount(0);
        setTriedBurgerCards([]);
        return;
      }
      const [mineCountResponse, triedResponse] = await Promise.all([
        whereNotDeleted(
        supabase
        .from('entries')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', selectedRestaurant.id)
        .eq('user_id', session.user.id)
        ),
        supabase
          .from('burger_wishlist')
          .select(`
            id,
            rating,
            photo_url,
            restaurants ( name ),
            burgers ( name )
          `)
          .eq('user_id', session.user.id)
          .eq('restaurant_id', selectedRestaurant.id)
          .eq('status', 'tried')
          .order('tried_at', { ascending: false }),
      ]);
      if (cancelled) return;
      if (mineCountResponse.error) {
        console.error(mineCountResponse.error);
        setMineCount(0);
      } else {
        setMineCount(mineCountResponse.count ?? 0);
      }
      if (triedResponse.error) {
        console.error(triedResponse.error);
        setTriedBurgerCards([]);
      } else {
        const rows = (triedResponse.data ?? []) as {
          id: string;
          rating: number | null;
          photo_url: string | null;
          restaurants: { name: string | null } | { name: string | null }[] | null;
          burgers: { name: string | null } | { name: string | null }[] | null;
        }[];
        setTriedBurgerCards(rows.map((row) => {
          const restaurant = Array.isArray(row.restaurants) ? row.restaurants[0] : row.restaurants;
          const burger = Array.isArray(row.burgers) ? row.burgers[0] : row.burgers;
          return {
            id: row.id,
            burgerName: burger?.name ?? t('burgerWishlist.unknownBurger'),
            restaurantName: restaurant?.name ?? selectedRestaurant.name,
            photoUrl: row.photo_url,
            rating: row.rating,
          };
        }));
      }
    };

    void loadMineCount();

    return () => {
      cancelled = true;
    };
  }, [selectedRestaurant, session.user.id, t]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedTerm(searchTerm.trim());
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchTerm]);

  useEffect(() => {
    let cancelled = false;

    const loadRestaurants = async () => {
      if (!mutualIds) return;
      setLoading(true);
      setError(null);
      const term = debouncedTerm;

      let query = supabase
        .from('restaurants')
        .select('id, name')
        .order('name')
        .limit(50);

      if (term) {
        const normalizedValue = normalizeName(term);
        const compactValue = normalizeCompact(term);
        query = query.or(
          `name.ilike.%${term}%,name_normalized.ilike.%${normalizedValue}%,name_compact.ilike.%${compactValue}%`
        );
      }

      const { data, error } = await query;

      if (cancelled) return;
      if (error) {
        setError(t('restaurantSearch.errors.load', { defaultValue: 'No se pudieron cargar restaurantes.' }));
        setRestaurants([]);
        setLoading(false);
        return;
      }

      const baseRestaurants = (data ?? []).map((row) => ({
        id: (row as { id: string }).id,
        name: (row as { name: string }).name,
      })) as RestaurantOption[];

      if (!baseRestaurants.length) {
        setRestaurants([]);
        setLoading(false);
        return;
      }

      const restaurantIds = baseRestaurants.map((r) => r.id);
      const visibleEntriesQuery = whereNotDeleted(
        supabase
        .from('entries')
        .select('restaurant_id, user_id, visibility')
        .in('restaurant_id', restaurantIds)
      );
      const { data: entryRows, error: entryError } = await visibleEntriesQuery;

      if (cancelled) return;
      if (entryError) {
        console.error(entryError);
        setError(t('restaurantSearch.errors.load', { defaultValue: 'No se pudieron cargar restaurantes.' }));
        setRestaurants([]);
        setLoading(false);
        return;
      }

      const entries = (entryRows ?? []) as {
        restaurant_id: string | null;
        user_id: string;
        visibility?: string | null;
      }[];

      const userIds = Array.from(new Set(entries.map((row) => row.user_id)));
      let profileMap: Record<string, { is_private: boolean | null }> = {};
      if (userIds.length) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, is_private')
          .in('id', userIds);
        if (profilesError) {
          console.error(profilesError);
          setError(t('restaurantSearch.errors.load', { defaultValue: 'No se pudieron cargar restaurantes.' }));
          setRestaurants([]);
          setLoading(false);
          return;
        }
        profileMap = Object.fromEntries(
          (profilesData ?? []).map((p) => [
            (p as { id: string }).id,
            { is_private: (p as { is_private: boolean | null }).is_private },
          ])
        );
      }

      const viewerId = session.user.id;
      const visibleRestaurantIds = new Set<string>();
      entries.forEach((row) => {
        if (!row.restaurant_id) return;
        if (row.user_id === viewerId) {
          visibleRestaurantIds.add(row.restaurant_id);
          return;
        }
        if (row.visibility !== 'public') return;
        const isPrivate = Boolean(profileMap[row.user_id]?.is_private);
        if (isPrivate && !mutualIds.has(row.user_id)) return;
        visibleRestaurantIds.add(row.restaurant_id);
      });

      const filtered = baseRestaurants.filter((r) => visibleRestaurantIds.has(r.id));
      setRestaurants(filtered);
      setLoading(false);
      return;
    };

    void loadRestaurants();

    return () => {
      cancelled = true;
    };
  }, [debouncedTerm, mutualIds, session.user.id, t]);

  const handleSelectRestaurant = (restaurant: RestaurantOption) => {
    setSelectedRestaurant(restaurant);
    setActiveTab('mine');
  };

  const handleClearSelection = () => {
    setSelectedRestaurant(null);
  };

  const handleOpenEntry = (entryId: string) => {
    navigate(`/posts/${entryId}`, { state: { returnTo } });
  };

  const handleAddSaved = async () => {
    setRefreshFeedKey((prev) => prev + 1);
    setIsAddModalOpen(false);
  };

  const renderTriedBurgerCards = () => {
    if (activeTab !== 'mine' || !triedBurgerCards.length) return null;
    return (
      <div className="bw-restaurant-tried-list">
        {triedBurgerCards.map((card) => (
          <article className="bw-history-card bw-restaurant-tried-card" key={card.id}>
            <div className="bw-restaurant-tried-kicker">
              {t('burgerWishlist.privateTriedCard', { defaultValue: 'Probada sin post' })}
            </div>
            <div className="bw-history-restaurant">{card.restaurantName}</div>
            <div className="bw-feed-burger">{card.burgerName}</div>
            {card.photoUrl && (
              <div className="bw-restaurant-tried-photo">
                <img src={card.photoUrl} alt={card.burgerName} loading="lazy" />
              </div>
            )}
            <div className="bw-restaurant-tried-rating">
              {t('burgerWishlist.ratingLabel')}: {card.rating != null ? card.rating.toFixed(1) : '-'}
            </div>
          </article>
        ))}
      </div>
    );
  };

  const renderResults = () => {
    if (loading) {
      return <p className="bw-helper">{t('restaurantSearch.searching', { defaultValue: 'Buscando restaurantes...' })}</p>;
    }
    if (error) {
      return <p className="bw-restaurant-error">{error}</p>;
    }
    if (!restaurants.length) {
      return <p className="bw-helper">{t('restaurantSearch.empty', { defaultValue: 'No hay restaurantes con ese nombre.' })}</p>;
    }
    return (
      <div className="bw-restaurant-results">
        {restaurants.map((restaurant) => (
          <button
            key={restaurant.id}
            type="button"
            className="bw-card bw-restaurant-card"
            onClick={() => handleSelectRestaurant(restaurant)}
          >
            <div className="bw-restaurant-card-body">
              <div className="bw-restaurant-card-name">{restaurant.name}</div>
              <div className="bw-restaurant-card-subtitle">
                {t('restaurantSearch.cardSubtitle', { defaultValue: 'Ver publicaciones' })}
              </div>
            </div>
            <span className="bw-restaurant-card-action">
              {t('restaurantSearch.cardAction', { defaultValue: 'Ver' })}
            </span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <>
      <section className="bw-restaurant-search">
          <div className="bw-field">
            <label className="bw-label" htmlFor="bw-restaurant-search">
              {t('restaurantSearch.searchLabel', { defaultValue: 'Buscar restaurante' })}
            </label>
            <input
              id="bw-restaurant-search"
              type="search"
              className="bw-input"
              placeholder={t('restaurantSearch.searchPlaceholder', { defaultValue: 'Ej: Burger Town' })}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          {selectedRestaurant ? (
            <>
              <div className="bw-card bw-restaurant-selected">
                <div>
                  <div className="bw-restaurant-selected-label">
                    {t('restaurantSearch.selectedLabel', { defaultValue: 'Restaurante seleccionado' })}
                  </div>
                  <div className="bw-restaurant-selected-name">{selectedRestaurant.name}</div>
                </div>
                <button
                  type="button"
                  className="bw-btn bw-btn-ghost"
                  onClick={handleClearSelection}
                >
                  {t('restaurantSearch.change', { defaultValue: 'Cambiar' })}
                </button>
              </div>

              <div className="bw-restaurant-tabs">
                <div className="bw-feed-tabs bw-feed-tabs-trio">
                  <button
                    type="button"
                    className={`bw-feed-tab ${activeTab === 'mine' ? 'is-active' : ''}`}
                    onClick={() => setActiveTab('mine')}
                  >
                    {t('restaurantSearch.tabsMine', { count: mineCount + triedBurgerCards.length, defaultValue: 'Tu ({{count}})' })}
                  </button>
                  <button
                    type="button"
                    className={`bw-feed-tab ${activeTab === 'friends' ? 'is-active' : ''}`}
                    onClick={() => setActiveTab('friends')}
                  >
                    {t('restaurantSearch.tabsFriends', { defaultValue: 'Amigos' })}
                  </button>
                  <button
                    type="button"
                    className={`bw-feed-tab ${activeTab === 'all' ? 'is-active' : ''}`}
                    onClick={() => setActiveTab('all')}
                  >
                    {t('restaurantSearch.tabsAll', { defaultValue: 'Todos' })}
                  </button>
                </div>
              </div>

              <div className="bw-restaurant-feed">
                {renderTriedBurgerCards()}
                <FeedTabs
                  key={`${selectedRestaurant.id}-${activeTab}-${refreshFeedKey}`}
                  currentUserId={session.user.id}
                  focusUserId={activeTab === 'mine' ? session.user.id : null}
                  restaurantIdFilter={selectedRestaurant.id}
                  forcedTab={activeTab === 'friends' ? 'following' : 'global'}
                  monthFilter="all"
                  hideHeader
                  onOpenEntry={handleOpenEntry}
                  refreshKey={refreshFeedKey}
                />
              </div>
            </>
          ) : (
            renderResults()
          )}
      </section>

      {selectedRestaurant && (
        <div className="bw-fab-wrapper">
          <button
            className="bw-fab"
            onClick={() => setIsAddModalOpen(true)}
            aria-label={t('common.addEntry')}
          >
            <span className="bw-fab-plus">+</span>
            <span className="bw-fab-label">{t('common.add')}</span>
          </button>
        </div>
      )}

      <AddEntryModal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSaved={handleAddSaved}
        session={session}
        theme={theme}
        mode="create"
        initialRestaurant={selectedRestaurant}
      />
    </>
  );
}

export function RestaurantSearchPage({ session, theme }: Readonly<RestaurantSearchPageProps>) {
  const { t } = useTranslation();

  return (
    <AppShell>
      <PageHeader
        title={t('restaurantSearch.title', { defaultValue: 'Restaurantes' })}
        subtitle={t('restaurantSearch.subtitle', { defaultValue: 'Busca un restaurante y explora las publicaciones' })}
      />
      <main className="bw-main">
        <RestaurantSearchContent session={session} theme={theme} />
      </main>
    </AppShell>
  );
}
