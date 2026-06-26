import { CheckCircleOutline, Clear, GroupAdd, Search, SyncAlt } from '@mui/icons-material';
import type { Session } from '@supabase/supabase-js';
import { startTransition, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { lockBodyScroll } from '../../utils/scrollLock';
import { AppShell } from '../common/AppShell';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { LockedContent } from '../common/LoginOverlay';
import { PageHeader } from '../common/PageHeader';
import { UserCard } from '../common/UserCard';
import { RestaurantSearchContent } from '../RestaurantSearchPage/RestaurantSearchPage';
import { UserProfileModal } from '../UserProfileModal/UserProfileModal';
import '../../styles/layout.css';
import '../../styles/shared.css';
import '../FollowListModal/FollowListModal.css';
import '../RestaurantSearchPage/RestaurantSearchPage.css';
import './SearchPage.css';

type SearchPageProps = {
  session: Session | null;
  theme: 'light' | 'dark';
  onRequireLogin: () => void;
  onOpenUserDashboard?: (
    user: { id: string; username: string | null; displayName: string | null },
    options?: { returnPage?: 'dashboard' | 'feed' | 'profile' | 'search'; returnProfileUserId?: string | null }
  ) => void;
};

type SearchUser = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  equipped_frame: 'gold' | 'silver' | 'bronze' | null;
  bio: string | null;
};

type SearchLocationState = {
  activeSearchTab?: 'users' | 'restaurants';
};

export function SearchPage({
  session,
  theme,
  onRequireLogin,
  onOpenUserDashboard,
}: Readonly<SearchPageProps>) {
  const { t } = useTranslation();
  const location = useLocation();
  const locationState = location.state as SearchLocationState | null;
  const [activeTab, setActiveTab] = useState<'users' | 'restaurants'>(
    locationState?.activeSearchTab === 'restaurants' ? 'restaurants' : 'users'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ user: SearchUser; action: 'request' | 'cancel' } | null>(null);
  const [followingIds, setFollowingIds] = useState<Record<string, number>>({});
  const [followersIds, setFollowersIds] = useState<Record<string, number>>({});
  const [followsLoaded, setFollowsLoaded] = useState(false);
  const [profileModalUserId, setProfileModalUserId] = useState<string | null>(null);
  const currentUserId = session?.user.id ?? null;
  const followsCacheKey = currentUserId ? `bw-search-follows-${currentUserId}` : null;
  const isGuest = !session;
  const trimmedTerm = useMemo(() => searchTerm.trim(), [searchTerm]);

  useEffect(() => {
    if (!confirmAction) return;
    return lockBodyScroll();
  }, [confirmAction]);

  useEffect(() => {
    if (!followsCacheKey || !currentUserId) return;
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
        .or(`follower_id.eq.${currentUserId},following_id.eq.${currentUserId}`);
      if (error) {
        console.error('Error loading follows', error);
        return;
      }
      const newFollowing: Record<string, number> = {};
      const newFollowers: Record<string, number> = {};
      const followRows = (data ?? []) as { id: number; follower_id: string; following_id: string }[];
      followRows.forEach((row) => {
        if (row.follower_id === currentUserId) {
          newFollowing[row.following_id] = row.id;
        }
        if (row.following_id === currentUserId) {
          newFollowers[row.follower_id] = row.id;
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
        // Ignore cache write errors.
      }
    };
    void loadFollows();
  }, [currentUserId, followsCacheKey]);

  useEffect(() => {
    if (!followsLoaded || !followsCacheKey) return;
    try {
      sessionStorage.setItem(
        followsCacheKey,
        JSON.stringify({ followingIds, followersIds })
      );
    } catch {
      // Ignore cache write errors.
    }
  }, [followsCacheKey, followersIds, followingIds, followsLoaded]);

  useEffect(() => {
    const doSearch = async () => {
      if (activeTab !== 'users' || trimmedTerm.length < 2) {
        setSearchResults([]);
        setSearchError(null);
        return;
      }
      setSearchLoading(true);
      setSearchError(null);
      let query = supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, equipped_frame, bio')
        .ilike('username', `%${trimmedTerm}%`)
        .limit(10);

      if (currentUserId) {
        query = query.neq('id', currentUserId);
      }

      const { data, error } = await query;

      if (error) {
        setSearchError(error.message);
        setSearchResults([]);
      } else {
        setSearchResults((data ?? []) as SearchUser[]);
      }
      setSearchLoading(false);
    };

    const timeoutId = window.setTimeout(doSearch, 250);
    return () => window.clearTimeout(timeoutId);
  }, [activeTab, currentUserId, trimmedTerm]);

  const handleFollow = async (user: SearchUser) => {
    if (!currentUserId) {
      onRequireLogin();
      return;
    }
    const targetUserId = user.id;
    if (followingIds[targetUserId]) return;

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
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    const { user, action } = confirmAction;

    if (action === 'request') {
      await handleFollow(user);
      setConfirmAction(null);
      return;
    }

    if (!currentUserId) {
      onRequireLogin();
      setConfirmAction(null);
      return;
    }
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
    setConfirmAction(null);
  };

  const handleViewPosts = (user: { id: string; username: string | null; displayName: string | null }) => {
    onOpenUserDashboard?.(user, { returnPage: 'search', returnProfileUserId: null });
    setProfileModalUserId(null);
  };

  const renderUserResults = () => {
    if (trimmedTerm.length < 2) {
      return (
        <p className="bw-helper">
          {t('searchPage.usersHint', { defaultValue: 'Type at least 2 characters to search users.' })}
        </p>
      );
    }
    if (searchLoading) {
      return <p className="bw-helper">{t('feedPage.searching', { defaultValue: 'Searching...' })}</p>;
    }
    if (searchError) {
      return <p className="bw-search-error">{searchError}</p>;
    }
    if (!searchResults.length) {
      return <p className="bw-helper">{t('feedPage.noUsers', { defaultValue: 'No users found.' })}</p>;
    }
    return (
      <div className="bw-user-results">
        {searchResults.map((user) => {
          const outgoingId = followingIds[user.id];
          const incomingId = followersIds[user.id];
          const isMutual = Boolean(outgoingId && incomingId);
          const isOutgoing = Boolean(outgoingId);
          const isIncoming = Boolean(incomingId);
          const actionButton = isGuest ? null : (
            <button
              type="button"
              className={`bw-user-action ${isMutual ? 'is-accepted' : ''} ${isOutgoing && !isMutual ? 'is-following' : ''}`}
              onClick={() => {
                if (isMutual || isOutgoing) {
                  setConfirmAction({ user, action: 'cancel' });
                } else {
                  void handleFollow(user);
                }
              }}
              title={
                isMutual
                  ? t('followList.mutual', { defaultValue: 'You follow each other' })
                  : isOutgoing
                    ? t('followList.unfollow', { defaultValue: 'Unfollow' })
                    : isIncoming
                      ? t('feedPage.followBack', { defaultValue: 'Follow back' })
                      : t('followList.follow', { defaultValue: 'Follow' })
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
          );
          return (
            <UserCard
              key={user.id}
              handle={user.username ?? 'user'}
              avatarUrl={user.avatar_url}
              avatarFrame={user.equipped_frame}
              avatarAlt={user.username ?? ''}
              avatarInitial={(user.username ?? '?').charAt(0).toUpperCase()}
              meta={
                isMutual
                  ? t('followList.mutual', { defaultValue: 'You follow each other' })
                  : isIncoming
                    ? t('followList.followsYou', { defaultValue: 'Follows you' })
                    : null
              }
              bio={user.bio}
              infoButton
              onInfoClick={() => setProfileModalUserId(user.id)}
              action={actionButton}
            />
          );
        })}
      </div>
    );
  };

  return (
    <AppShell>
      <PageHeader
        title={t('searchPage.title', { defaultValue: 'Search' })}
        subtitle={t('searchPage.subtitle', { defaultValue: 'Find users and restaurants from one place.' })}
      />
      <main className="bw-main">
        <div className="bw-search-tabs" role="tablist" aria-label={t('searchPage.tabsLabel', { defaultValue: 'Search type' })}>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'users'}
            className={`bw-search-tab ${activeTab === 'users' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            {t('searchPage.usersTab', { defaultValue: 'Users' })}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'restaurants'}
            className={`bw-search-tab ${activeTab === 'restaurants' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('restaurants')}
          >
            {t('common.restaurants', { defaultValue: 'Restaurants' })}
          </button>
        </div>

        {activeTab === 'users' ? (
          <section className="bw-search-section">
            <div className="bw-search-input-wrap">
              <span className="bw-search-input-icon">
                <Search fontSize="small" />
              </span>
              <input
                type="search"
                className="bw-input bw-search-input"
                placeholder={t('feedPage.searchPlaceholder', { defaultValue: 'Search users...' })}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="bw-search-clear"
                  onClick={() => setSearchTerm('')}
                  aria-label={t('common.searchClear')}
                >
                  <Clear fontSize="small" />
                </button>
              )}
            </div>
            {renderUserResults()}
          </section>
        ) : session ? (
          <RestaurantSearchContent session={session} theme={theme} returnTo="/search" />
        ) : (
          <LockedContent
            title={t('restaurantSearch.lockedTitle', { defaultValue: 'Restaurants' })}
            actionLabel={t('locked.action')}
            onLogin={onRequireLogin}
            preview={<div className="bw-search-locked-preview" />}
          />
        )}
      </main>

      <UserProfileModal
        open={Boolean(profileModalUserId)}
        userId={profileModalUserId}
        session={session}
        onClose={() => setProfileModalUserId(null)}
        onRequireLogin={onRequireLogin}
        onFollowChange={(targetId, isNowFollowing) => {
          if (isGuest) return;
          setFollowingIds((prev) => {
            const copy = { ...prev };
            if (isNowFollowing) {
              copy[targetId] = copy[targetId] ?? -1;
            } else {
              delete copy[targetId];
            }
            return copy;
          });
        }}
        onViewPosts={(user) => handleViewPosts(user)}
      />
      <ConfirmDialog
        open={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        backdropClassName="bw-modal-backdrop"
        title={
          confirmAction?.action === 'request'
            ? t('feedPage.confirmFollow', { user: confirmAction.user.username ?? 'user' })
            : t('feedPage.confirmUnfollow', { user: confirmAction?.user.username ?? 'user' })
        }
        actions={(
          <>
            <button className="bw-btn bw-btn-ghost" onClick={() => setConfirmAction(null)}>
              {t('feedPage.no')}
            </button>
            <button className="bw-btn bw-btn-primary" onClick={handleConfirm}>
              {t('feedPage.yes')}
            </button>
          </>
        )}
      />
    </AppShell>
  );
}
