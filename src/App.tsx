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
import { SavedPostsPage } from './components/SavedPostsPage/SavedPostsPage';
import { PostPage } from './components/PostPage/PostPage';
import { RestaurantSearchPage } from './components/RestaurantSearchPage/RestaurantSearchPage';
import { AppShell } from './components/common/AppShell';
import { PageHeader } from './components/common/PageHeader';
import { LockedContent } from './components/common/LoginOverlay';
import { FeedPlaceholder, GroupsPlaceholder, ProfilePlaceholder } from './components/common/LockedPlaceholders';
import './styles/shared.css';

type Session = Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'];
type Theme = 'light' | 'dark';
type FeedReturnPage = 'dashboard' | 'feed' | 'profile';
type FocusUser = { id: string; username: string | null; displayName: string | null };
type FeedLocationState = { openProfileUserId?: string | null };
type UserDashboardLocationState = { returnTo?: string; returnProfileUserId?: string | null };
type PostLocationState = { returnTo?: string };
type AuthMetadata = { username?: string; username_set?: boolean };
type AppMetadata = { provider?: string; providers?: string[] };

const deriveDefaultUsername = (email?: string | null) => {
  if (!email) return null;
  const atIndex = email.indexOf('@');
  if (atIndex <= 0) return null;
  return email.slice(0, atIndex);
};

function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [requiresUsername, setRequiresUsername] = useState(false);
  const [feedFocusUser, setFeedFocusUser] = useState<FocusUser | null>(null);
  const [feedOpenProfileUserId, setFeedOpenProfileUserId] = useState<string | null>(null);
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
  }, []);

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

  const handleOpenUserDashboard = (
    user: { id: string; username: string | null; displayName: string | null },
    options?: { returnPage?: FeedReturnPage; returnProfileUserId?: string | null }
  ) => {
    const returnTo = options?.returnPage === 'profile' ? '/profile' : '/feed';
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
          path="/profile"
          element={
            session ? (
              <ProfilePage
                session={session}
                theme={theme}
                onToggleTheme={toggleTheme}
                onOpenUserDashboard={(user) =>
                  handleOpenUserDashboard(user, { returnPage: 'profile', returnProfileUserId: null })
                }
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
          path="/restaurants"
          element={
            session ? (
              <RestaurantSearchPage session={session} />
            ) : (
              <LockedPage
                title={t('restaurantSearch.lockedTitle', { defaultValue: 'Restaurantes' })}
                subtitle={t('restaurantSearch.lockedSubtitle', { defaultValue: 'Inicia sesión para buscar restaurantes.' })}
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
        <Route path="/reset-password" element={<ResetPasswordScreen />} />
        <Route path="/auth" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!isLoginRoute && <BottomNav session={session} onRequireLogin={handleLogin} />}
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
