import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from './lib/supabaseClient';
import { AuthScreen } from './components/AuthScreen/AuthScreen';
import { ResetPasswordScreen } from './components/AuthScreen/ResetPasswordScreen';
import { UsernameSetupScreen } from './components/AuthScreen/UsernameSetupScreen';
import { BottomNav } from './components/BottomNav/BottomNav';
import { Dashboard } from './components/Dashboard/Dashboard';
import { FeedPage } from './components/FeedPage/FeedPage';
import { GlobalRankingPage } from './components/GlobalRankingPage/GlobalRankingPage';
import { GroupsPage } from './components/GroupsPage/GroupsPage';
import { GroupPage } from './components/GroupPage/GroupPage';
import { LandingPage } from './components/LandingPage/LandingPage';
import { ProfilePage } from './components/ProfilePage/ProfilePage';
import { PrivacyPage } from './components/PrivacyPage/PrivacyPage';
import { UserDashboardPage } from './components/UserDashboardPage/UserDashboardPage';
import { AdminFeedPage } from './components/AdminFeedPage/AdminFeedPage';
import { AdminNotificationsPage } from './components/AdminNotificationsPage/AdminNotificationsPage';
import { AdminReportsPage } from './components/AdminReportsPage/AdminReportsPage';
import { AdminUsersPage } from './components/AdminUsersPage/AdminUsersPage';
import { SavedPostsPage } from './components/SavedPostsPage/SavedPostsPage';
import { BurgerWishlistPage } from './components/BurgerWishlistPage/BurgerWishlistPage';
import { BurgerCalendarPage } from './components/BurgerCalendarPage/BurgerCalendarPage';
import { PostPage } from './components/PostPage/PostPage';
import { SearchPage } from './components/SearchPage/SearchPage';
import { MyTopBurgersPage } from './components/MyTopBurgersPage/MyTopBurgersPage';
import { MorePage } from './components/MorePage/MorePage';
import { FeatureAnnouncementModal } from './components/FeatureAnnouncementModal/FeatureAnnouncementModal';
import { PushNotificationPrompt } from './components/PushNotifications/PushNotificationPrompt';
import { AppShell } from './components/common/AppShell';
import { PageHeader } from './components/common/PageHeader';
import { LockedContent } from './components/common/LoginOverlay';
import { FeedPlaceholder, GroupsPlaceholder, ProfilePlaceholder } from './components/common/LockedPlaceholders';
import './styles/shared.css';

type Session = Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'];
type Theme = 'light' | 'dark';
type FeedReturnPage = 'dashboard' | 'feed' | 'profile' | 'search';
type FocusUser = { id: string; username: string | null; displayName: string | null };
type FeedLocationState = { openProfileUserId?: string | null };
type UserDashboardLocationState = { returnTo?: string; returnProfileUserId?: string | null; adminView?: boolean };
type PostLocationState = { returnTo?: string };
type AuthMetadata = { username?: string; username_set?: boolean };
type AppMetadata = { provider?: string; providers?: string[] };

const FEATURE_ANNOUNCEMENT_ID = 'burger-wishlist-v1';

const getFeatureAnnouncementStorageKey = (userId: string) =>
  `bw-feature-announcement-${FEATURE_ANNOUNCEMENT_ID}:${userId}`;

const persistFeatureAnnouncementSeen = async (userId: string) => {
  const { error } = await supabase
    .from('user_feature_announcements')
    .upsert(
      {
        user_id: userId,
        announcement_id: FEATURE_ANNOUNCEMENT_ID,
        seen_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,announcement_id' }
    );

  if (error) {
    console.error('Error saving feature announcement state', error);
  }
};

const deriveDefaultUsername = (email?: string | null) => {
  if (!email) return null;
  const atIndex = email.indexOf('@');
  if (atIndex <= 0) return null;
  return email.slice(0, atIndex);
};

function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [requiresUsername, setRequiresUsername] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminModeEnabled, setAdminModeEnabled] = useState(false);
  const [feedFocusUser, setFeedFocusUser] = useState<FocusUser | null>(null);
  const [feedOpenProfileUserId, setFeedOpenProfileUserId] = useState<string | null>(null);
  const [showFeatureAnnouncement, setShowFeatureAnnouncement] = useState(false);
  const { t } = useTranslation();
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = window.localStorage.getItem('bw-theme') as Theme | null;
    return (saved === 'light' || saved === 'dark') ? saved : 'light';
  });
  const location = useLocation();
  const navigate = useNavigate();
  const isLoginRoute = location.pathname === '/login' ||
    location.pathname === '/reset-password' ||
    location.pathname === '/setup-username';

  // Aplicar tema al <html> y guardar
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('bw-theme', theme);
  }, [theme]);

  useEffect(() => {
    const ensureRobotsMeta = () => {
      let tag = document.querySelector('meta[name="robots"]');
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('name', 'robots');
        document.head.appendChild(tag);
      }
      return tag;
    };
    const tag = ensureRobotsMeta();
    const value = isLoginRoute ? 'noindex, nofollow' : 'index, follow';
    tag.setAttribute('content', value);
  }, [isLoginRoute]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [location.pathname]);

  useEffect(() => {
    const isLegacyAuthPayload = (value: string | null) => {
      if (!value) return false;
      try {
        const parsed = JSON.parse(value) as {
          loggedIn?: boolean;
          username?: string;
          email?: string;
          avatarUrl?: string;
        };
        return (
          Object.prototype.hasOwnProperty.call(parsed, 'loggedIn') &&
          Object.prototype.hasOwnProperty.call(parsed, 'username') &&
          Object.prototype.hasOwnProperty.call(parsed, 'email') &&
          Object.prototype.hasOwnProperty.call(parsed, 'avatarUrl')
        );
      } catch {
        return false;
      }
    };

    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      const value = window.localStorage.getItem(key);
      if (isLegacyAuthPayload(value)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => window.localStorage.removeItem(key));
  }, []);

  useEffect(() => {
    let active = true;
    const checkUsername = async () => {
      if (!session) {
        setRequiresUsername(false);
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', session.user.id)
        .single();
      if (!active) return;
      if (error) {
        setRequiresUsername(false);
        return;
      }
      const profileUsername = (data as { username: string | null } | null)?.username ?? null;
      const metadata =
        (session.user.user_metadata as AuthMetadata | null);
      const appMetadata =
        (session.user.app_metadata as AppMetadata | null);
      const metadataUsername = metadata?.username ?? null;
      const metadataSet = Boolean(metadata?.username_set);
      const isGoogle =
        appMetadata?.provider === 'google' ||
        Boolean(appMetadata?.providers?.includes('google'));
      const defaultUsername = deriveDefaultUsername(session.user.email);
      const usesDefault =
        Boolean(profileUsername) &&
        Boolean(defaultUsername) &&
        profileUsername?.toLowerCase() === defaultUsername?.toLowerCase();
      const inferredSet =
        Boolean(profileUsername) &&
        Boolean(metadataUsername) &&
        profileUsername === metadataUsername &&
        !usesDefault;
      const hasCustomUsername = metadataSet || inferredSet;
      setRequiresUsername(isGoogle && !hasCustomUsername);
    };
    checkUsername();
    return () => {
      active = false;
    };
  }, [location.pathname, session]);

  useEffect(() => {
    let cancelled = false;
    const loadAdminStatus = async () => {
      if (!session) {
        setIsAdmin(false);
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single();
      if (cancelled) return;
      if (error) {
        setIsAdmin(false);
        return;
      }
      setIsAdmin(Boolean((data as { is_admin?: boolean | null } | null)?.is_admin));
    };
    void loadAdminStatus();
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!isAdmin) {
      setAdminModeEnabled(false);
      window.localStorage.removeItem('bw-admin-mode');
      return;
    }
    const stored = window.localStorage.getItem('bw-admin-mode') === '1';
    setAdminModeEnabled(stored);
  }, [isAdmin]);

  useEffect(() => {
    if (!session) return;
    if (location.pathname.startsWith('/admin') && (!isAdmin || !adminModeEnabled)) {
      navigate('/profile', { replace: true });
    }
  }, [adminModeEnabled, isAdmin, location.pathname, navigate, session]);

  useEffect(() => {
    if (!session || isLoginRoute || requiresUsername || location.pathname.startsWith('/admin')) {
      setShowFeatureAnnouncement(false);
      return;
    }

    let cancelled = false;
    const loadFeatureAnnouncementState = async () => {
      const { data, error } = await supabase
        .from('user_feature_announcements')
        .select('seen_at')
        .eq('user_id', session.user.id)
        .eq('announcement_id', FEATURE_ANNOUNCEMENT_ID)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error('Error loading feature announcement state', error);
        setShowFeatureAnnouncement(false);
        return;
      }

      if (data) {
        setShowFeatureAnnouncement(false);
        return;
      }

      setShowFeatureAnnouncement(true);
    };

    void loadFeatureAnnouncementState();

    return () => {
      cancelled = true;
    };
  }, [isLoginRoute, location.pathname, requiresUsername, session]);

  useEffect(() => {
    if (!session || !requiresUsername) return;
    if (location.pathname === '/setup-username') return;
    navigate('/setup-username', { replace: true });
  }, [location.pathname, navigate, requiresUsername, session]);

  // Auth
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession ?? null);
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password', { replace: true });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  const toggleTheme = () =>
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));

  useEffect(() => {
    if (location.pathname !== '/feed') return;
    const state = location.state as FeedLocationState | null;
    if (!state?.openProfileUserId) return;
    setFeedOpenProfileUserId(state.openProfileUserId);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

  if (session === undefined) {
    return (
      <div className="bw-loader-overlay">
        <div className="bw-loader-spinner" aria-label="Cargando..." />
      </div>
    );
  }

  const handleNavigate = (page: 'dashboard' | 'feed' | 'profile' | 'groups' | 'ranking') => {
    const path = page === 'dashboard'
      ? '/'
      : page === 'feed'
        ? '/feed'
        : page === 'ranking'
          ? '/ranking'
          : `/${page}`;
    navigate(path);
  };

  const handleLogin = () => navigate('/login');
  const dismissFeatureAnnouncement = () => {
    if (session) {
      window.localStorage.setItem(getFeatureAnnouncementStorageKey(session.user.id), '1');
      void persistFeatureAnnouncementSeen(session.user.id);
    }
    setShowFeatureAnnouncement(false);
  };
  const handleViewFeatureFeed = () => {
    dismissFeatureAnnouncement();
    navigate('/feed');
  };
  const handleAdminModeChange = (enabled: boolean) => {
    if (!isAdmin) return;
    setAdminModeEnabled(enabled);
    window.localStorage.setItem('bw-admin-mode', enabled ? '1' : '0');
    navigate(enabled ? '/admin/feed' : '/profile');
  };

  const handleOpenUserDashboard = (
    user: { id: string; username: string | null; displayName: string | null },
    options?: { returnPage?: FeedReturnPage; returnProfileUserId?: string | null }
  ) => {
    const returnTo = options?.returnPage === 'profile'
      ? '/profile'
      : options?.returnPage === 'search'
        ? '/search'
        : '/feed';
    navigate(`/users/${user.id}`, {
      state: {
        returnTo,
        returnProfileUserId: options?.returnProfileUserId ?? null,
      } satisfies UserDashboardLocationState,
    });
  };

  const UserDashboardRoute = () => {
    const { userId } = useParams();
    const routeLocation = useLocation();
    const routeNavigate = useNavigate();
    const routeState = routeLocation.state as UserDashboardLocationState | null;
    const returnTo = routeState?.returnTo ?? '/feed';
    const returnProfileUserId = routeState?.returnProfileUserId ?? null;

    if (!userId) {
      return <Navigate to="/feed" replace />;
    }

    return (
      <UserDashboardPage
        session={session}
        theme={theme}
        onToggleTheme={toggleTheme}
        onNavigate={handleNavigate}
        userId={userId}
        isAdminView={Boolean(routeState?.adminView && isAdmin)}
        onBack={() => {
          if (returnTo === '/feed' && returnProfileUserId) {
            routeNavigate('/feed', { state: { openProfileUserId: returnProfileUserId } });
          } else {
            routeNavigate(returnTo);
          }
        }}
      />
    );
  };

  const PostRoute = () => {
    const { entryId } = useParams();
    const routeLocation = useLocation();
    const routeNavigate = useNavigate();
    const routeState = routeLocation.state as PostLocationState | null;
    const returnTo = routeState?.returnTo ?? '/';

    if (!entryId) {
      return <Navigate to="/" replace />;
    }

    return (
      <PostPage
        session={session}
        entryId={entryId}
        onBack={() => routeNavigate(returnTo)}
      />
    );
  };

  const SavedPostsRoute = () => {
    const routeNavigate = useNavigate();
    return (
      <SavedPostsPage
        session={session}
        onBack={() => routeNavigate('/profile')}
      />
    );
  };

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            session ? (
              <Dashboard
                session={session}
                theme={theme}
                onToggleTheme={toggleTheme}
                onNavigate={handleNavigate}
              />
            ) : (
              <LandingPage onLogin={handleLogin} />
            )
          }
        />
        <Route
          path="/home"
          element={<Navigate to="/" replace />}
        />
        <Route
          path="/feed"
          element={
            <FeedPage
              session={session}
              theme={theme}
              onToggleTheme={toggleTheme}
              onNavigate={handleNavigate}
              focusedUser={feedFocusUser}
              onFocusedUserChange={(user) => setFeedFocusUser(user)}
              returnPage="feed"
              openProfileUserId={feedOpenProfileUserId}
              onProfileModalConsumed={() => setFeedOpenProfileUserId(null)}
              onOpenUserDashboard={handleOpenUserDashboard}
              onRequireLogin={handleLogin}
              lockedPreview={<FeedPlaceholder />}
            />
          }
        />
        <Route
          path="/search"
          element={
            <SearchPage
              session={session}
              theme={theme}
              onRequireLogin={handleLogin}
              onOpenUserDashboard={handleOpenUserDashboard}
            />
          }
        />
        <Route
          path="/profile"
          element={
            session ? (
              <UserDashboardPage
                session={session}
                theme={theme}
                onToggleTheme={toggleTheme}
                onNavigate={handleNavigate}
                userId={session.user.id}
                isOwnProfile
                onOpenSettings={() => navigate('/profile/settings')}
              />
            ) : (
              <LockedPage
                title={t('locked.profileTitle')}
                subtitle={t('locked.profileSubtitle')}
                onLogin={handleLogin}
                preview={<ProfilePlaceholder />}
              />
            )
          }
        />
        <Route
          path="/more"
          element={
            session ? (
              <MorePage session={session} />
            ) : (
              <LockedPage
                title={t('more.title')}
                subtitle={t('more.lockedSubtitle')}
                onLogin={handleLogin}
                preview={<GroupsPlaceholder />}
              />
            )
          }
        />
        <Route
          path="/profile/settings"
          element={
            session ? (
              <ProfilePage
                session={session}
                theme={theme}
                onToggleTheme={toggleTheme}
                adminModeEnabled={adminModeEnabled}
                onAdminModeChange={handleAdminModeChange}
                onOpenUserDashboard={(user) =>
                  handleOpenUserDashboard(user, { returnPage: 'profile', returnProfileUserId: null })
                }
              />
            ) : (
              <Navigate to="/profile" replace />
            )
          }
        />
        <Route
          path="/groups"
          element={
            session ? (
              <GroupsPage
                session={session}
                theme={theme}
                onToggleTheme={toggleTheme}
                onNavigate={handleNavigate}
              />
            ) : (
              <LockedPage
                title={t('locked.section')}
                subtitle={t('locked.groupsSubtitle')}
                onLogin={handleLogin}
                preview={<GroupsPlaceholder />}
              />
            )
          }
        />
        <Route
          path="/ranking"
          element={
            session ? (
              <GlobalRankingPage session={session} />
            ) : (
              <LockedPage
                title={t('locked.section')}
                subtitle={t('locked.groupsSubtitle')}
                onLogin={handleLogin}
                preview={<GroupsPlaceholder />}
              />
            )
          }
        />
        <Route
          path="/groups/:groupId"
          element={
            session ? (
              <GroupRoute
                session={session}
                theme={theme}
                onToggleTheme={toggleTheme}
              />
            ) : (
              <LockedPage
                title={t('locked.section')}
                subtitle={t('locked.groupSubtitle')}
                onLogin={handleLogin}
                preview={<GroupsPlaceholder />}
              />
            )
          }
        />
        <Route path="/users/:userId" element={<UserDashboardRoute />} />
        <Route path="/posts/:entryId" element={<PostRoute />} />
        <Route
          path="/saved"
          element={
            session ? (
              <SavedPostsRoute />
            ) : (
              <LockedPage
                title={t('locked.section')}
                subtitle={t('locked.savedSubtitle')}
                onLogin={handleLogin}
                preview={<FeedPlaceholder />}
              />
            )
          }
        />
        <Route
          path="/burger-wishlist"
          element={
            session ? (
              <BurgerWishlistRoute session={session} />
            ) : (
              <LockedPage
                title={t('burgerWishlist.pageTitle', { defaultValue: 'Burgers to try' })}
                subtitle={t('burgerWishlist.lockedSubtitle', { defaultValue: 'Log in to see your burger wishlist.' })}
                onLogin={handleLogin}
                preview={<FeedPlaceholder />}
              />
            )
          }
        />
        <Route
          path="/burger-calendar"
          element={
            session ? (
              <BurgerCalendarRoute session={session} />
            ) : (
              <LockedPage
                title={t('burgerCalendar.title', { defaultValue: 'Burger Calendar' })}
                subtitle={t('burgerCalendar.lockedSubtitle', { defaultValue: 'Log in to see your burger calendar.' })}
                onLogin={handleLogin}
                preview={<FeedPlaceholder />}
              />
            )
          }
        />
        <Route
          path="/restaurants"
          element={<Navigate to="/search" replace />}
        />
        <Route
          path="/my-top-burgers"
          element={
            session ? (
              <MyTopBurgersRoute session={session} />
            ) : (
              <LockedPage
                title={t('myTopBurgers.title', { defaultValue: 'Mi top burgers' })}
                subtitle={t('myTopBurgers.lockedSubtitle', { defaultValue: 'Inicia sesión para ver tu ranking personal de hamburguesas.' })}
                onLogin={handleLogin}
                preview={<FeedPlaceholder />}
              />
            )
          }
        />
        <Route
          path="/login"
          element={session ? <Navigate to="/" replace /> : <AuthScreen />}
        />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route
          path="/setup-username"
          element={session ? <UsernameSetupScreen /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/admin/feed"
          element={session && isAdmin && adminModeEnabled ? <AdminFeedPage session={session} /> : <Navigate to="/profile" replace />}
        />
        <Route
          path="/admin/users"
          element={session && isAdmin && adminModeEnabled ? <AdminUsersPage session={session} /> : <Navigate to="/profile" replace />}
        />
        <Route
          path="/admin/reports"
          element={session && isAdmin && adminModeEnabled ? <AdminReportsPage session={session} /> : <Navigate to="/profile" replace />}
        />
        <Route
          path="/admin/notifications"
          element={session && isAdmin && adminModeEnabled ? <AdminNotificationsPage session={session} /> : <Navigate to="/profile" replace />}
        />
        <Route path="/reset-password" element={<ResetPasswordScreen />} />
        <Route path="/auth" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!isLoginRoute && (
        <BottomNav
          session={session}
          onRequireLogin={handleLogin}
          isAdmin={isAdmin}
          adminModeEnabled={adminModeEnabled}
        />
      )}
      <FeatureAnnouncementModal
        open={showFeatureAnnouncement}
        onDismiss={dismissFeatureAnnouncement}
        onViewFeed={handleViewFeatureFeed}
      />
      <PushNotificationPrompt
        userId={session?.user.id ?? null}
        enabled={Boolean(
          session &&
          !isLoginRoute &&
          !requiresUsername &&
          !showFeatureAnnouncement &&
          !location.pathname.startsWith('/admin')
        )}
      />
    </>
  );
}

type GroupRouteProps = {
  session: Session | null;
  theme: Theme;
  onToggleTheme: () => void;
};

function GroupRoute({ session, theme, onToggleTheme }: GroupRouteProps) {
  const { groupId } = useParams();
  const navigate = useNavigate();

  if (!groupId || !session) {
    return <Navigate to="/groups" replace />;
  }

  return (
    <GroupPage
      session={session}
      theme={theme}
      onToggleTheme={onToggleTheme}
      groupId={groupId}
      onBack={() => navigate('/groups')}
    />
  );
}

function MyTopBurgersRoute({ session }: { session: NonNullable<Session> }) {
  const navigate = useNavigate();

  return (
    <MyTopBurgersPage
      session={session}
      onBack={() => navigate(-1)}
    />
  );
}

function BurgerWishlistRoute({ session }: { session: NonNullable<Session> }) {
  const navigate = useNavigate();

  return (
    <BurgerWishlistPage
      session={session}
      onBack={() => navigate(-1)}
    />
  );
}

function BurgerCalendarRoute({ session }: { session: NonNullable<Session> }) {
  const navigate = useNavigate();

  return (
    <BurgerCalendarPage
      session={session}
      onBack={() => navigate('/more')}
    />
  );
}

export default App;

type LockedPageProps = {
  title: string;
  subtitle: string;
  onLogin: () => void;
  preview?: ReactNode;
};

function LockedPage({ title, subtitle, onLogin, preview }: Readonly<LockedPageProps>) {
  const { t } = useTranslation();
  const fallbackPreview = preview ?? (
    <div className="bw-locked-placeholder">
      <div className="bw-locked-row">
        <div className="bw-locked-pill" />
        <div className="bw-locked-pill" />
        <div className="bw-locked-pill" />
      </div>
      <div className="bw-locked-grid">
        <div className="bw-locked-card-skeleton" />
        <div className="bw-locked-card-skeleton" />
        <div className="bw-locked-card-skeleton" />
        <div className="bw-locked-card-skeleton" />
      </div>
      <div className="bw-locked-list">
        <div className="bw-locked-list-item" />
        <div className="bw-locked-list-item" />
        <div className="bw-locked-list-item" />
      </div>
    </div>
  );

  return (
    <AppShell>
      <PageHeader title={title} subtitle={subtitle} />
      <main className="bw-main">
        <LockedContent
          title={t('locked.section')}
          actionLabel={t('locked.action')}
          onLogin={onLogin}
          preview={fallbackPreview}
        />
      </main>
    </AppShell>
  );
}
