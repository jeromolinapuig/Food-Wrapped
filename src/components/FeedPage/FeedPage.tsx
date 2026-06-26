import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { FeedTabs } from '../FeedTabs/FeedTabs';
import { UserProfileModal } from '../UserProfileModal/UserProfileModal';
import { AppShell } from '../common/AppShell';
import { BackButton } from '../common/BackButton';
import { PageHeader } from '../common/PageHeader';
import { getCurrentMonthValue } from '../../utils/datetime';
import '../../styles/layout.css';
import '../../styles/shared.css';
import './FeedPage.css';
import '../FollowListModal/FollowListModal.css';

type FeedPageProps = {
  session: Session | null;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onNavigate: (page: 'dashboard' | 'feed' | 'profile' | 'groups' | 'ranking') => void;
  focusedUser?: { id: string; username: string | null; displayName: string | null } | null;
  onFocusedUserChange?: (user: { id: string; username: string | null; displayName: string | null } | null) => void;
  returnPage?: 'dashboard' | 'feed' | 'profile';
  openProfileUserId?: string | null;
  onProfileModalConsumed?: () => void;
  onOpenUserDashboard?: (
    user: { id: string; username: string | null; displayName: string | null },
    options?: { returnPage?: 'dashboard' | 'feed' | 'profile'; returnProfileUserId?: string | null }
  ) => void;
  onRequireLogin: () => void;
  lockedPreview?: React.ReactNode;
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
  onRequireLogin,
  lockedPreview,
}: Readonly<FeedPageProps>) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [refreshFeedKey, setRefreshFeedKey] = useState(0);
  const [profileModalUserId, setProfileModalUserId] = useState<string | null>(null);
  const [focusedFeedUser, setFocusedFeedUser] = useState<{ id: string; username: string | null; displayName: string | null } | null>(null);
  const [userMonthFilter, setUserMonthFilter] = useState<'all' | string>(() => getCurrentMonthValue());
  const currentUserId = session?.user.id ?? null;
  const isGuest = !session;

  const handleViewPosts = (user: { id: string; username: string | null; displayName: string | null }) => {
    onOpenUserDashboard?.(user, { returnPage: 'feed', returnProfileUserId: user.id });
    setProfileModalUserId(null);
  };
  const effectiveFocusedUser = focusedUser ?? focusedFeedUser;

  return (
    <AppShell>
        <PageHeader
          title={t('feedPage.title', { defaultValue: 'Feed' })}
          subtitle={t('feedPage.subtitle')}
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
                  ariaLabel={t('feedPage.backToFeed', { defaultValue: 'Back to main feed' })}
                />
                <div className="bw-feed-focus-text">
          <div className="bw-feed-focus-name">{t('feedPage.postsOf', { user: effectiveFocusedUser.username ?? 'user' })}</div>
                </div>
              </div>
              <div className="bw-feed-focus-right">
                <FeedTabs
                  currentUserId={currentUserId}
                  isReadOnly={isGuest}
                  onRequireLogin={onRequireLogin}
                  lockedPreview={lockedPreview}
                  focusUserId={effectiveFocusedUser.id}
                  headerOnly
                  monthFilter={userMonthFilter}
                  onMonthFilterChange={setUserMonthFilter}
                />
              </div>
            </div>
          ) : null}

          <div>
            <FeedTabs
              currentUserId={currentUserId}
              isReadOnly={isGuest}
              onRequireLogin={onRequireLogin}
              lockedPreview={lockedPreview}
              refreshKey={refreshFeedKey}
              onOpenEntry={(entryId) => navigate(`/posts/${entryId}`, { state: { returnTo: '/feed' } })}
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
        onRequireLogin={onRequireLogin}
        onFollowChange={() => {
          if (isGuest) return;
          setRefreshFeedKey((prev) => prev + 1);
        }}
        onViewPosts={(user) => handleViewPosts(user)}
      />
    </AppShell>
  );
}



