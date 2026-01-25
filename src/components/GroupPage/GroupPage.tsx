import { Euro, LunchDining } from '@mui/icons-material';
import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import '../../styles/layout.css';
import '../../styles/shared.css';
import type { GroupMember } from '../../types/groups';
import { useRevalidateOnFocus } from '../../utils/useRevalidateOnFocus';
import { AppShell } from '../common/AppShell';
import { BackButton } from '../common/BackButton';
import { PageHeader } from '../common/PageHeader';
import '../Dashboard/Dashboard.css';
import { FeedTabs } from '../FeedTabs/FeedTabs';
import { StatCard } from '../StatCard/StatCard';
import { UserProfileModal } from '../UserProfileModal/UserProfileModal';
import './GroupPage.css';

type BurgerTypeStats = {
  beef: number;
  chicken: number;
  vegan: number;
};

type MeatType = 'beef' | 'chicken' | 'vegan' | 'other';

type DbEntryRow = {
  id: string;
  user_id: string;
  datetime: string;
  rating: number | null;
  price: number | null;
  is_burger: boolean;
  restaurant_id: string | null;
  burger_id: string | null;
  restaurant: { name: string } | null;
  burger: { name: string | null; meat_type: MeatType | null } | null;
};

type GroupPageProps = {
  session: Session;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  groupId: string;
  onBack: () => void;
};

export function GroupPage({ session, groupId, onBack }: Readonly<GroupPageProps>) {
  const navigate = useNavigate();
  const [groupName, setGroupName] = useState<string | null>(null);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [entries, setEntries] = useState<DbEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupMissing, setGroupMissing] = useState(false);
  const [postsCount, setPostsCount] = useState(0);
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'posts' | 'ranking'>('posts');
  const [rankingMetric, setRankingMetric] = useState<'spent' | 'burgers'>('spent');
  const [profileModalUserId, setProfileModalUserId] = useState<string | null>(null);
  const groupUserIds = memberIds.length ? memberIds : null;

  const loadGroup = useCallback(async () => {
    setError(null);
    setMembersLoaded(false);
    const { data: groupRow, error: groupError } = await supabase
      .from('groups')
      .select('id, name, owner_id')
      .eq('id', groupId)
      .single();

    if (groupError || !groupRow) {
      const notFound = groupError?.code === 'PGRST116' || ((groupError as unknown as { status?: number })?.status === 406);
      setGroupMissing(notFound);
      setError(notFound ? null : 'No se pudo cargar el grupo.');
      setGroupName(null);
      setMemberIds([]);
      setMembers([]);
      setMembersLoaded(true);
      return;
    }

    setGroupMissing(false);
    setGroupName((groupRow as { name: string }).name);
    const ownerId = (groupRow as { owner_id: string }).owner_id;

    const { data: memberRows, error: membersError } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId);

    if (membersError) {
      setError('No se pudieron cargar los miembros.');
      setMemberIds([]);
      setMembers([]);
      setMembersLoaded(true);
      return;
    }

    const memberIdsSet = new Set<string>();
    memberIdsSet.add(ownerId);
    (memberRows ?? []).forEach((row) => {
      memberIdsSet.add((row as { user_id: string }).user_id);
    });
    const uniqueMemberIds = Array.from(memberIdsSet);
    setMemberIds(uniqueMemberIds);

    if (!uniqueMemberIds.length) {
      setMembers([]);
      setMembersLoaded(true);
      return;
    }

    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', uniqueMemberIds);

    if (profilesError) {
      setError('No se pudieron cargar los miembros.');
      setMembers([]);
      setMembersLoaded(true);
      return;
    }

    const mapped = (profilesData ?? []).map((profile) => ({
      id: (profile as { id: string }).id,
      username: (profile as { username: string | null }).username,
      displayName: (profile as { display_name: string | null }).display_name,
      avatarUrl: (profile as { avatar_url: string | null }).avatar_url,
    }));
    setMembers(mapped);
    setMembersLoaded(true);
  }, [groupId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await loadGroup();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadGroup]);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (groupMissing) {
      setEntries([]);
      setPostsCount(0);
      setLoading(false);
      return;
    }

    if (!memberIds.length) {
      setEntries([]);
      setPostsCount(0);
      setLoading(false);
      return;
    }

    const from = '2026-01-01';
    const to = '2027-01-01';

    const { data, error } = await supabase
      .from('entries')
      .select(
        `
          id,
          user_id,
          datetime,
          rating,
          price,
          is_burger,
          restaurant_id,
          burger_id,
          restaurant:restaurants ( name ),
          burger:burgers ( name, meat_type )
        `
      )
      .eq('visibility', 'public')
      .gte('datetime', from)
      .lt('datetime', to)
      .in('user_id', memberIds)
      .order('datetime', { ascending: false });

    if (error) {
      setError(error.message);
      setEntries([]);
    } else {
      setEntries((data ?? []) as unknown as DbEntryRow[]);
    }

    setLoading(false);
  }, [groupMissing, memberIds]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await loadEntries();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadEntries]);

  useRevalidateOnFocus(
    () => {
      loadGroup();
      loadEntries();
    },
    [loadEntries, loadGroup],
    { minIntervalMs: 180000, maxStaleMs: 900000, debounceMs: 500 }
  );

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
    const restaurantRatings = new Map<string, { sum: number; count: number }>();
    const restaurantLastVisited = new Map<string, number>();
    const burgerTypes: BurgerTypeStats = { beef: 0, chicken: 0, vegan: 0 };

    for (const entry of entries) {
      if (entry.price != null) totalSpent += entry.price;
      if (entry.is_burger) burgerCount++;

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

      const meat = entry.burger?.meat_type;
      if (meat === 'beef') burgerTypes.beef++;
      if (meat === 'chicken') burgerTypes.chicken++;
      if (meat === 'vegan') burgerTypes.vegan++;
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
      burgerTypes,
    };
  }, [entries]);

  const rankingRows = useMemo(() => {
    const base = new Map<string, { spent: number; burgers: number }>();
    members.forEach((member) => {
      base.set(member.id, { spent: 0, burgers: 0 });
    });

    entries.forEach((entry) => {
      const current = base.get(entry.user_id) ?? { spent: 0, burgers: 0 };
      current.spent += entry.price ?? 0;
      if (entry.is_burger) {
        current.burgers += 1;
      }
      base.set(entry.user_id, current);
    });

    const rows = members.map((member) => {
      const totals = base.get(member.id) ?? { spent: 0, burgers: 0 };
      return {
        ...member,
        totalSpent: totals.spent,
        totalBurgers: totals.burgers,
      };
    });

    rows.sort((a, b) => {
      if (rankingMetric === 'spent') return b.totalSpent - a.totalSpent;
      return b.totalBurgers - a.totalBurgers;
    });

    return rows;
  }, [entries, members, rankingMetric]);

  const title = groupName ?? 'Grupo';
  const sectionTitle = activeTab === 'posts' ? `Posts (${postsCount})` : 'Ranking';
  const handleSelectRanking = useCallback(
    (metric: 'spent' | 'burgers') => {
      setRankingMetric(metric);
      setActiveTab('ranking');
    },
    []
  );
  const handleViewPosts = useCallback(
    (user: { id: string; username: string | null; displayName: string | null }) => {
      setProfileModalUserId(null);
      navigate(`/users/${user.id}`, {
        state: { returnTo: `/groups/${groupId}`, returnProfileUserId: null },
      });
    },
    [navigate, groupId]
  );

  return (
    <AppShell>
        <PageHeader
          title="Burger Wrapped"
          subtitle={`Resumen de ${title}`}
          logoAlt="Burger Wrapped"
          leading={<BackButton onClick={onBack} ariaLabel="Volver" />}
        />

        <main className="bw-main">
          {groupMissing ? (
            <div className="bw-card bw-private-card">Este grupo ya no existe.</div>
          ) : (
            <>
          <section className="bw-stats-grid">
            {loading ? (
              Array.from({ length: 2 }).map((_, idx) => (
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
                  label="Total gastado"
                  onClick={() => handleSelectRanking('spent')}
                  isActive={activeTab === 'ranking' && rankingMetric === 'spent'}
                />
                <StatCard
                  icon={<LunchDining fontSize="small" />}
                  value={`${stats.totalBurgers}`}
                  label="Hamburguesas"
                  onClick={() => handleSelectRanking('burgers')}
                  isActive={activeTab === 'ranking' && rankingMetric === 'burgers'}
                />
              </>
            )}
          </section>

          {error && <p style={{ color: 'red', fontSize: 12 }}>{error}</p>}

          <section className="bw-history">
            <div className="bw-section-header">
              <h2 className="bw-section-title">{sectionTitle}</h2>
              <div className="bw-section-right">
                <div className="bw-group-tabs">
                  <button
                    type="button"
                    className={`bw-group-tab ${activeTab === 'posts' ? 'is-active' : ''}`}
                    onClick={() => setActiveTab('posts')}
                  >
                    Posts
                  </button>
                  <button
                    type="button"
                    className={`bw-group-tab ${activeTab === 'ranking' ? 'is-active' : ''}`}
                    onClick={() => setActiveTab('ranking')}
                  >
                    Ranking
                  </button>
                </div>
              </div>
            </div>

            {activeTab === 'posts' ? (
              !membersLoaded ? (
                <p className="bw-helper">Cargando posts del grupo...</p>
              ) : memberIds.length === 0 ? (
                <p className="bw-helper">Este grupo no tiene miembros.</p>
              ) : (
                <FeedTabs
                  currentUserId={session.user.id}
                  userIdsFilter={groupUserIds}
                  ignorePrivacy
                  onCountChange={setPostsCount}
                  hideHeader
                  monthFilter={monthFilter}
                  onMonthFilterChange={setMonthFilter}
                  onOpenEntry={(entryId) => navigate(`/posts/${entryId}`, { state: { returnTo: `/groups/${groupId}` } })}
                  onOpenProfile={(userId) => setProfileModalUserId(userId)}
                />
              )
            ) : (
              <div className="bw-ranking-list">
                {!rankingRows.length && (
                  <div className="bw-ranking-empty">Sin datos para mostrar.</div>
                )}
                {rankingRows.map((member, index) => {
                  const label = member.displayName || member.username || 'usuario';
                  const value =
                    rankingMetric === 'spent'
                      ? `${member.totalSpent.toFixed(2)}\u20AC`
                      : `${member.totalBurgers}`;
                  return (
                    <button
                      type="button"
                      className="bw-ranking-item"
                      key={member.id}
                      onClick={() => setProfileModalUserId(member.id)}
                    >
                      <div className="bw-ranking-left">
                        <div className="bw-ranking-index">{index + 1}</div>
                        <div className="bw-ranking-avatar">
                          {member.avatarUrl ? (
                            <img src={member.avatarUrl} alt={label} />
                          ) : (
                            <span>{label.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="bw-ranking-name">{label}</div>
                      </div>
                      <div className="bw-ranking-value">{value}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        
            </>
          )}
</main>
      <UserProfileModal
        open={Boolean(profileModalUserId)}
        userId={profileModalUserId}
        session={session}
        onClose={() => setProfileModalUserId(null)}
        onViewPosts={handleViewPosts}
      />
    </AppShell>
  );
}
