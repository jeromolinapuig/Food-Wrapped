import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import { AuthScreen } from './components/AuthScreen';
import { Dashboard } from './components/Dashboard';
import { FeedPage } from './components/FeedPage';
import { ProfilePage } from './components/ProfilePage';
import { UserDashboardPage } from './components/UserDashboardPage';

type Session = Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'];
type Theme = 'light' | 'dark';
type Page = 'dashboard' | 'feed' | 'profile' | 'user-dashboard';
type FocusUser = { id: string; username: string | null; displayName: string | null };

function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [feedFocusUser, setFeedFocusUser] = useState<FocusUser | null>(null);
  const [feedReturnPage, setFeedReturnPage] = useState<Page>('feed');
  const [userDashboardUser, setUserDashboardUser] = useState<FocusUser | null>(null);
  const [userDashboardReturn, setUserDashboardReturn] = useState<{ page: Page; profileUserId: string | null }>({
    page: 'feed',
    profileUserId: null,
  });
  const [feedOpenProfileUserId, setFeedOpenProfileUserId] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = window.localStorage.getItem('bw-theme') as Theme | null;
    return (saved === 'light' || saved === 'dark') ? saved : 'light';
  });

  // Aplicar tema al <html> y guardar
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('bw-theme', theme);
  }, [theme]);

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

  if (session === undefined) {
    return <div>Cargando...</div>;
  }

  if (!session) {
    return <AuthScreen />;
  }

  const toggleTheme = () =>
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));

  const handleNavigate = (page: Page) => {
    setActivePage(page);
  };

  if (activePage === 'feed') {
    return (
      <FeedPage
        session={session}
        theme={theme}
        onToggleTheme={toggleTheme}
        onNavigate={handleNavigate}
        focusedUser={feedFocusUser}
        onFocusedUserChange={(user) => {
          setFeedFocusUser(user);
          setFeedReturnPage(user ? 'feed' : 'feed');
        }}
        returnPage={feedReturnPage}
        openProfileUserId={feedOpenProfileUserId}
        onProfileModalConsumed={() => setFeedOpenProfileUserId(null)}
        onOpenUserDashboard={(user, options) => {
          setUserDashboardUser(user);
          setUserDashboardReturn({
            page: options?.returnPage ?? 'feed',
            profileUserId: options?.returnProfileUserId ?? null,
          });
          setActivePage('user-dashboard');
        }}
      />
    );
  }

  if (activePage === 'profile') {
    return (
      <ProfilePage
        session={session}
        theme={theme}
        onToggleTheme={toggleTheme}
        onNavigate={handleNavigate}
        onOpenUserDashboard={(user) => {
          setUserDashboardUser(user);
          setUserDashboardReturn({ page: 'profile', profileUserId: null });
          setActivePage('user-dashboard');
        }}
      />
    );
  }

  if (activePage === 'user-dashboard' && userDashboardUser) {
    return (
      <UserDashboardPage
        session={session}
        theme={theme}
        onToggleTheme={toggleTheme}
        onNavigate={(page) => handleNavigate(page)}
        user={userDashboardUser}
        onBack={() => {
          const { page, profileUserId } = userDashboardReturn;
          setActivePage(page);
          if (page === 'feed') {
            setFeedFocusUser(null);
            setFeedOpenProfileUserId(profileUserId);
          }
          setUserDashboardUser(null);
        }}
      />
    );
  }

  return (
    <Dashboard
      session={session}
      theme={theme}
      onToggleTheme={toggleTheme}
      onNavigate={handleNavigate}
    />
  );
}

export default App;
