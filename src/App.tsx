import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import { AuthScreen } from './components/AuthScreen';
import { BottomNav } from './components/BottomNav';
import { Dashboard } from './components/Dashboard';
import { FeedPage } from './components/FeedPage';
import { GroupsPage } from './components/GroupsPage';
import { GroupPage } from './components/GroupPage';
import { ProfilePage } from './components/ProfilePage';
import { UserDashboardPage } from './components/UserDashboardPage';
import './styles/shared.css';

type Session = Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'];
type Theme = 'light' | 'dark';
type FeedReturnPage = 'dashboard' | 'feed' | 'profile';
type FocusUser = { id: string; username: string | null; displayName: string | null };
type FeedLocationState = { openProfileUserId?: string | null };
type UserDashboardLocationState = { returnTo?: string; returnProfileUserId?: string | null };

function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [feedFocusUser, setFeedFocusUser] = useState<FocusUser | null>(null);
  const [feedOpenProfileUserId, setFeedOpenProfileUserId] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = window.localStorage.getItem('bw-theme') as Theme | null;
    return (saved === 'light' || saved === 'dark') ? saved : 'light';
  });
  const location = useLocation();
  const navigate = useNavigate();

  // Aplicar tema al <html> y guardar
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('bw-theme', theme);
  }, [theme]);

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

  // Auth
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
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
    navigate('/feed', { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

  if (session === undefined) {
    return (
      <div className="bw-loader-overlay">
        <div className="bw-loader-spinner" aria-label="Cargando..." />
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  const handleNavigate = (page: 'dashboard' | 'feed' | 'profile' | 'groups') => {
    const path = page === 'dashboard' ? '/' : `/${page}`;
    navigate(path);
  };

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

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            <Dashboard
              session={session}
              theme={theme}
              onToggleTheme={toggleTheme}
              onNavigate={handleNavigate}
            />
          }
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
            />
          }
        />
        <Route
          path="/profile"
          element={
            <ProfilePage
              session={session}
              theme={theme}
              onToggleTheme={toggleTheme}
              onNavigate={handleNavigate}
              onOpenUserDashboard={(user) =>
                handleOpenUserDashboard(user, { returnPage: 'profile', returnProfileUserId: null })
              }
            />
          }
        />
        <Route
          path="/groups"
          element={
            <GroupsPage
              session={session}
              theme={theme}
              onToggleTheme={toggleTheme}
              onNavigate={handleNavigate}
            />
          }
        />
        <Route
          path="/groups/:groupId"
          element={
            <GroupRoute
              session={session}
              theme={theme}
              onToggleTheme={toggleTheme}
            />
          }
        />
        <Route path="/users/:userId" element={<UserDashboardRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav session={session} />
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
