import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabaseClient';
import { AppShell } from '../common/AppShell';
import { PageHeader } from '../common/PageHeader';
import { FeedTabs } from '../FeedTabs/FeedTabs';
import '../../styles/shared.css';
import './RestaurantSearchPage.css';

type RestaurantOption = {
  id: string;
  name: string;
};

type RestaurantSearchPageProps = {
  session: Session;
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

export function RestaurantSearchPage({ session }: Readonly<RestaurantSearchPageProps>) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantOption | null>(null);
  const [activeTab, setActiveTab] = useState<'mine' | 'friends' | 'all'>('mine');
  const [mineCount, setMineCount] = useState(0);
  const [mutualIds, setMutualIds] = useState<Set<string> | null>(null);

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
        return;
      }
      const { count, error } = await supabase
        .from('entries')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', selectedRestaurant.id)
        .eq('user_id', session.user.id);
      if (cancelled) return;
      if (error) {
        console.error(error);
        setMineCount(0);
        return;
      }
      setMineCount(count ?? 0);
    };

    void loadMineCount();

    return () => {
      cancelled = true;
    };
  }, [selectedRestaurant, session.user.id]);

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
      const { data: entryRows, error: entryError } = await supabase
        .from('entries')
        .select('restaurant_id, user_id, visibility')
        .in('restaurant_id', restaurantIds);

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
    navigate(`/posts/${entryId}`, { state: { returnTo: '/restaurants' } });
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
    <AppShell>
      <PageHeader
        title={t('restaurantSearch.title', { defaultValue: 'Restaurantes' })}
        subtitle={t('restaurantSearch.subtitle', { defaultValue: 'Busca un restaurante y explora las publicaciones' })}
      />
      <main className="bw-main">
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
                    {t('restaurantSearch.tabs.mine', { count: mineCount, defaultValue: 'Tu ({{count}})' })}
                  </button>
                  <button
                    type="button"
                    className={`bw-feed-tab ${activeTab === 'friends' ? 'is-active' : ''}`}
                    onClick={() => setActiveTab('friends')}
                  >
                    {t('restaurantSearch.tabs.friends', { defaultValue: 'Amigos' })}
                  </button>
                  <button
                    type="button"
                    className={`bw-feed-tab ${activeTab === 'all' ? 'is-active' : ''}`}
                    onClick={() => setActiveTab('all')}
                  >
                    {t('restaurantSearch.tabs.all', { defaultValue: 'Todos' })}
                  </button>
                </div>
              </div>

              <div className="bw-restaurant-feed">
                <FeedTabs
                  key={`${selectedRestaurant.id}-${activeTab}`}
                  currentUserId={session.user.id}
                  focusUserId={activeTab === 'mine' ? session.user.id : null}
                  restaurantIdFilter={selectedRestaurant.id}
                  forcedTab={activeTab === 'friends' ? 'following' : 'global'}
                  monthFilter="all"
                  hideHeader
                  onOpenEntry={handleOpenEntry}
                />
              </div>
            </>
          ) : (
            renderResults()
          )}
        </section>
      </main>
    </AppShell>
  );
}
