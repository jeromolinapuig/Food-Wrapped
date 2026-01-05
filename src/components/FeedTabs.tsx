import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type FeedTab = 'me' | 'friends' | 'following' | 'global';

type FeedTabsProps = {
  currentUserId: string;
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
  photo_url: string | null;
  restaurants: { name: string | null } | null;
  burgers: { name: string | null } | null;
  profiles: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
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

export function FeedTabs({ currentUserId }: FeedTabsProps) {
  const [activeTab, setActiveTab] = useState<FeedTab>('global');
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const loadEntries = async () => {
      setLoading(true);
      setError(null);

      if (activeTab === 'friends' || activeTab === 'following') {
        setEntries([]);
        setLoading(false);
        return;
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
          visibility,
          photo_url,
          restaurants ( name ),
          burgers ( name ),
          profiles ( username, display_name, avatar_url )
        `
        )
        .order('datetime', { ascending: false })
        .limit(50);

      if (activeTab === 'global') {
        query = query.eq('visibility', 'public');
      } else if (activeTab === 'me') {
        query = query.eq('user_id', currentUserId);
      }

      const { data, error } = await query;

      if (isCancelled) return;

      if (error) {
        setError(error.message);
        setEntries([]);
        setLoading(false);
        return;
      }

      const mapped: FeedEntry[] = (data ?? []).map((row) => {
        const entry = row as unknown as SupabaseEntryRow;
        return {
          id: entry.id,
          userId: entry.user_id,
          username: entry.profiles?.username ?? 'usuario',
          displayName: entry.profiles?.display_name ?? null,
          avatarUrl: entry.profiles?.avatar_url ?? null,
          datetime: entry.datetime,
          price: entry.price ?? 0,
          rating: entry.rating ?? 0,
          isBurger: Boolean(entry.is_burger),
          restaurantName: entry.restaurants?.name ?? null,
          burgerName: entry.burgers?.name ?? null,
          photoUrl: entry.photo_url ?? null,
        };
      });

      setEntries(mapped);
      setLoading(false);
    };

    loadEntries();

    return () => {
      isCancelled = true;
    };
  }, [activeTab, currentUserId]);

  const renderPlaceholderText = () => {
    if (activeTab === 'friends') return 'Próximamente feed de amigos.';
    if (activeTab === 'following') return 'Próximamente feed de siguiendo.';
    return 'No hay comidas todavía en este feed.';
  };

  return (
    <section className="bw-feed">
      <div className="bw-feed-header">
        <h2 className="bw-section-title">Feed</h2>
        <div className="bw-feed-tabs">
          <button
            type="button"
            className={`bw-feed-tab ${activeTab === 'me' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('me')}
          >
            Tú
          </button>
          <button
            type="button"
            className={`bw-feed-tab ${activeTab === 'friends' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('friends')}
          >
            Amigos
          </button>
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

      <div className="bw-history-list">
        {loading && <p style={{ fontSize: 13 }}>Cargando feed...</p>}
        {error && <p style={{ color: 'red', fontSize: 12 }}>{error}</p>}
        {!loading && !entries.length && <p style={{ fontSize: 13, opacity: 0.8 }}>{renderPlaceholderText()}</p>}

        {entries.map((entry) => {
          const date = new Date(entry.datetime);
          const formattedDate = date.toLocaleString();
          const name = entry.displayName || entry.username;
          const stars = renderStarString(entry.rating);

          return (
            <article className="bw-history-card bw-feed-entry" key={entry.id}>
              <div className="bw-feed-entry-header">
                <div className="bw-feed-user">
                  <div className="bw-avatar">
                    <Avatar username={entry.username} avatarUrl={entry.avatarUrl} />
                  </div>
                  <div>
                    <div className="bw-feed-user-name">{name}</div>
                    <div className="bw-feed-user-handle">@{entry.username}</div>
                  </div>
                </div>
                <div className="bw-feed-datetime">{formattedDate}</div>
              </div>

              <div className="bw-feed-body">
                <div className="bw-feed-restaurant">
                  <div className="bw-history-restaurant">{entry.restaurantName ?? 'Restaurante'}</div>
                  {entry.burgerName && <div className="bw-feed-burger">{entry.burgerName}</div>}
                </div>

                {entry.photoUrl && (
                  <div className="bw-feed-photo">
                    <img src={entry.photoUrl} alt={entry.burgerName ?? entry.restaurantName ?? 'Foto de la entrada'} />
                  </div>
                )}

                <div className="bw-feed-footer">
                  <div className="bw-feed-rating">
                    <span className="bw-feed-stars">{stars}</span>
                    <span className="bw-feed-rating-number">
                      {entry.rating ? `${entry.rating.toFixed(1)}` : 'Sin nota'}
                    </span>
                  </div>
                  <div className="bw-feed-price">€ {entry.price.toFixed(2)}</div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
