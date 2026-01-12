import { useEffect, useMemo, useState, startTransition } from 'react';
import type { Session } from '@supabase/supabase-js';
import { FeedTabs } from '../FeedTabs/FeedTabs';
import { supabase } from '../../lib/supabaseClient';
import { CheckCircleOutline, GroupAdd, Search, SyncAlt, Clear } from '@mui/icons-material';
import { UserProfileModal } from '../UserProfileModal/UserProfileModal';
import { lockBodyScroll } from '../../utils/scrollLock';
import { AppShell } from '../common/AppShell';
import { BackButton } from '../common/BackButton';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { PageHeader } from '../common/PageHeader';
import { UserCard } from '../common/UserCard';
import '../../styles/layout.css';
import '../../styles/shared.css';
import './FeedPage.css';
import '../FollowListModal/FollowListModal.css';

type FeedPageProps = {
  session: Session;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onNavigate: (page: 'dashboard' | 'feed' | 'profile' | 'groups') => void;
  focusedUser?: { id: string; username: string | null; displayName: string | null } | null;
  onFocusedUserChange?: (user: { id: string; username: string | null; displayName: string | null } | null) => void;
  returnPage?: 'dashboard' | 'feed' | 'profile';
  openProfileUserId?: string | null;
  onProfileModalConsumed?: () => void;
  onOpenUserDashboard?: (
    user: { id: string; username: string | null; displayName: string | null },
    options?: { returnPage?: 'dashboard' | 'feed' | 'profile'; returnProfileUserId?: string | null }
  ) => void;
};

type SearchUser = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

export function FeedPage({
  session,
  onNavigate,
  focusedUser,
  onFocusedUserChange,
  returnPage = 'feed',
  openProfileUserId,
  onProfileModalConsumed,
  onOpenUserDashboard,
}: Readonly<FeedPageProps>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ user: SearchUser; action: 'request' | 'cancel' } | null>(null);
  const [followingIds, setFollowingIds] = useState<Record<string, number>>({});
  const [followersIds, setFollowersIds] = useState<Record<string, number>>({});
  const [followsLoaded, setFollowsLoaded] = useState(false);
  const [refreshFeedKey, setRefreshFeedKey] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);
  const [profileModalUserId, setProfileModalUserId] = useState<string | null>(null);
  const [focusedFeedUser, setFocusedFeedUser] = useState<{ id: string; username: string | null; displayName: string | null } | null>(null);
  const [userMonthFilter, setUserMonthFilter] = useState<'all' | string>('all');
  const followsCacheKey = `bw-feed-follows-${session.user.id}`;

  const trimmedTerm = useMemo(() => searchTerm.trim(), [searchTerm]);

  useEffect(() => {
    if (!confirmAction) return;
    return lockBodyScroll();
  }, [confirmAction]);

  useEffect(() => {
    const cached = sessionStorage.getItem(followsCacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as {
          followingIds?: Record<string, number>;
          followersIds?: Record<string, number>;
        };
        startTransition(() => {
          setFollowingIds(parsed.followingIds ?? {});
          setFollowersIds(parsed.followersIds ?? {});
          setFollowsLoaded(true);
        });
        return;
      } catch {
        // Fall through to fetch.
      }
    }

    const loadFollows = async () => {
      const { data, error } = await supabase
        .from('follows')
        .select('id, follower_id, following_id')
        .or(`follower_id.eq.${session.user.id},following_id.eq.${session.user.id}`);
      if (error) {
        console.error('Error loading follows', error);
        return;
      }
      const newFollowing: Record<string, number> = {};
      const newFollowers: Record<string, number> = {};
      const followRows = (data ?? []) as { id: number; follower_id: string; following_id: string }[];
      followRows.forEach((row) => {
        const followerId = row.follower_id;
        const followingId = row.following_id;
        const id = row.id;
        if (followerId === session.user.id) {
          newFollowing[followingId] = id;
        }
        if (followingId === session.user.id) {
          newFollowers[followerId] = id;
        }
      });
      setFollowingIds(newFollowing);
      setFollowersIds(newFollowers);
      setFollowsLoaded(true);
      try {
        sessionStorage.setItem(
          followsCacheKey,
          JSON.stringify({ followingIds: newFollowing, followersIds: newFollowers })
        );
      } catch {
        // Ignore cache write errors (private mode, quota, etc.).
      }
    };
    loadFollows();
  }, [followsCacheKey, session.user.id]);

  useEffect(() => {
    if (!followsLoaded) return;
    try {
      sessionStorage.setItem(
        followsCacheKey,
        JSON.stringify({ followingIds, followersIds })
      );
    } catch {
      // Ignore cache write errors (private mode, quota, etc.).
    }
  }, [followsCacheKey, followersIds, followingIds, followsLoaded]);

  useEffect(() => {
    const doSearch = async () => {
      if (trimmedTerm.length < 2) {
        setSearchResults([]);
        setSearchError(null);
        return;
      }
      setSearchLoading(true);
      setSearchError(null);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, bio')
        .ilike('username', `%${trimmedTerm}%`)
        .neq('id', session.user.id)
        .limit(10);

      if (error) {
        setSearchError(error.message);
        setSearchResults([]);
      } else {
        setSearchResults((data ?? []) as SearchUser[]);
      }
      setSearchLoading(false);
    };

    const t = window.setTimeout(doSearch, 250);
    return () => window.clearTimeout(t);
  }, [trimmedTerm, session.user.id]);

  const handleFollow = async (user: SearchUser) => {
    const currentUserId = session.user.id;
    const targetUserId = user.id;
    if (followingIds[targetUserId]) return;

    // optimistic set with temp id
    setFollowingIds((prev) => ({ ...prev, [targetUserId]: -1 }));

    const { data, error } = await supabase
      .from('follows')
      .insert({
        follower_id: currentUserId,
        following_id: targetUserId,
      })
      .select('id, follower_id, following_id')
      .single();

    if (error || !data) {
      console.error('Error following user', error);
      setFollowingIds((prev) => {
        const copy = { ...prev };
        delete copy[targetUserId];
        return copy;
      });
      return;
    }

    setFollowingIds((prev) => ({ ...prev, [targetUserId]: data.id }));
    setRefreshFeedKey((prev) => prev + 1);

  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    const { user, action } = confirmAction;

    if (action === 'request') {
      await handleFollow(user);
      setConfirmAction(null);
      return;
    }

    // cancel (unfollow)
    const currentUserId = session.user.id;
    const targetUserId = user.id;
    const followId = followingIds[targetUserId];
    if (!followId) {
      setConfirmAction(null);
      return;
    }

    const { error } = await supabase
      .from('follows')
      .delete()
      .match({
        id: followId,
        follower_id: currentUserId,
        following_id: targetUserId,
      });

    if (error) {
      console.error('Error unfollowing user', error);
      setConfirmAction(null);
      return;
    }

    setFollowingIds((prev) => {
      const copy = { ...prev };
      delete copy[targetUserId];
      return copy;
    });
    // if they still follow me, surface as incoming
    setRefreshFeedKey((prev) => prev + 1);
    setConfirmAction(null);
  };

  const handleCancelModal = () => setConfirmAction(null);
  const handleViewPosts = (user: { id: string; username: string | null; displayName: string | null }) => {
    onOpenUserDashboard?.(user, { returnPage: 'feed', returnProfileUserId: user.id });
    setProfileModalUserId(null);
  };
  const showBackButton = searchFocused || Boolean(searchTerm);
  const effectiveFocusedUser = focusedUser ?? focusedFeedUser;
  const shouldHideFeed = trimmedTerm.length >= 2 && !effectiveFocusedUser;

  return (
    <AppShell>
        <PageHeader
          title="Feed"
          subtitle="Descubre burgers y conecta con más gente."
        />

        <main className="bw-main">
          {effectiveFocusedUser ? (
            <div className="bw-feed-focus">
              <div className="bw-feed-focus-left">
                <BackButton
                  onClick={() => {
                    setFocusedFeedUser(null);
                    onFocusedUserChange?.(null);
                    if (returnPage === 'profile') {
                      onNavigate('profile');
                      return;
                    }
                  }}
                  ariaLabel="Volver al feed general"
                />
                <div className="bw-feed-focus-text">
                  <div className="bw-feed-focus-name">Posts de @{effectiveFocusedUser.username ?? 'usuario'}</div>
                </div>
              </div>
              <div className="bw-feed-focus-right">
                <FeedTabs
                  currentUserId={session.user.id}
                  focusUserId={effectiveFocusedUser.id}
                  headerOnly
                  monthFilter={userMonthFilter}
                  onMonthFilterChange={setUserMonthFilter}
                />
              </div>
            </div>
          ) : (
            <div className="bw-feed-search-row">
              {showBackButton && (
                <button
                  type="button"
                  className="bw-feed-search-back"
                  onClick={() => setSearchTerm('')}
                  aria-label="Limpiar búsqueda"
                  disabled={!searchTerm}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M15.41 16.59 10.83 12l4.58-4.59L14 6l-6 6 6 6z" />
                  </svg>
                </button>
              )}
              <div className={`bw-feed-search ${showBackButton ? 'has-back' : ''}`}>
                <span className="bw-feed-search-icon">
                  <Search fontSize="small" />
                </span>
                <input
                  type="search"
                  className="bw-input bw-feed-search-input"
                  placeholder="Buscar usuarios..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                />
                {searchTerm && (
                  <button
                    type="button"
                    className="bw-feed-search-clear"
                    onClick={() => setSearchTerm('')}
                    aria-label="Limpiar búsqueda"
                  >
                    <Clear fontSize="small" />
                  </button>
                )}
              </div>
            </div>
          )}

          {!effectiveFocusedUser && trimmedTerm.length >= 2 && (
            <div className="bw-user-results">
              {searchLoading && <p className="bw-helper">Buscando...</p>}
              {searchError && <p style={{ color: 'red', fontSize: 12 }}>{searchError}</p>}
              {!searchLoading && !searchError && !searchResults.length && (
                <p className="bw-helper">No se encontraron usuarios.</p>
              )}
              {searchResults.map((user) => {
                const outgoingId = followingIds[user.id];
                const incomingId = followersIds[user.id];
                const isMutual = Boolean(outgoingId && incomingId);
                const isOutgoing = Boolean(outgoingId);
                const isIncoming = Boolean(incomingId);
                return (
                  <UserCard
                    key={user.id}
                    handle={user.username ?? 'usuario'}
                    avatarUrl={user.avatar_url}
                    avatarAlt={user.username ?? ''}
                    avatarInitial={(user.username ?? '?').charAt(0).toUpperCase()}
                    meta={isMutual ? 'Os segu?s mutuamente' : isIncoming ? 'Te sigue' : null}
                    bio={user.bio}
                    infoButton
                    onInfoClick={() => setProfileModalUserId(user.id)}
                    action={(
                      <button
                        type="button"
                        className={`bw-user-action ${isMutual ? 'is-accepted' : ''} ${isOutgoing && !isMutual ? 'is-following' : ''}`}
                        onClick={() => {
                          if (isMutual || isOutgoing) {
                            setConfirmAction({ user, action: 'cancel' });
                          } else {
                            handleFollow(user);
                          }
                        }}
                        title={
                          isMutual
                            ? 'Ya se siguen mutuamente'
                            : isOutgoing
                              ? 'Dejar de seguir'
                              : isIncoming
                                ? 'Seguir de vuelta'
                                : 'Seguir'
                        }
                      >
                        {isMutual ? (
                          <SyncAlt fontSize="small" />
                        ) : isOutgoing ? (
                          <CheckCircleOutline fontSize="small" />
                        ) : (
                          <GroupAdd fontSize="small" />
                        )}
                      </button>
                    )}
                  />
                );
              })}
            </div>
          )}

          <div className={shouldHideFeed ? 'bw-feed-hidden' : ''}>
            <FeedTabs
              currentUserId={session.user.id}
              refreshKey={refreshFeedKey}
              onOpenProfile={(userId) => setProfileModalUserId(userId)}
              focusUserId={effectiveFocusedUser?.id ?? null}
              hideHeader={Boolean(effectiveFocusedUser)}
              monthFilter={userMonthFilter}
              onMonthFilterChange={setUserMonthFilter}
            />
          </div>
        </main>
      <UserProfileModal
        open={Boolean(openProfileUserId ?? profileModalUserId)}
        userId={openProfileUserId ?? profileModalUserId}
        session={session}
        onClose={() => {
          if (openProfileUserId) {
            onProfileModalConsumed?.();
          } else {
            setProfileModalUserId(null);
          }
        }}
        onFollowChange={(targetId, isNowFollowing) => {
          setFollowingIds((prev) => {
            const copy = { ...prev };
            if (isNowFollowing) {
              copy[targetId] = copy[targetId] ?? -1;
            } else {
              delete copy[targetId];
            }
            return copy;
          });
          // refresh feed to reflect following changes
          setRefreshFeedKey((prev) => prev + 1);
        }}
        onViewPosts={(user) => handleViewPosts(user)}
      />
      <ConfirmDialog
        open={Boolean(confirmAction)}
        onClose={handleCancelModal}
        backdropClassName="bw-modal-backdrop"
        title={
          confirmAction?.action === 'request'
            ? `¿Estás seguro que quieres seguir a @${confirmAction.user.username ?? 'usuario'}?`
            : `¿Estás seguro que quieres dejar de seguir a @${confirmAction?.user.username ?? 'usuario'}?`
        }
        actions={(
          <>
            <button className="bw-btn bw-btn-ghost" onClick={handleCancelModal}>
              No
            </button>
            <button className="bw-btn bw-btn-primary" onClick={handleConfirm}>
              Sí
            </button>
          </>
        )}
      />
    </AppShell>
  );
}
