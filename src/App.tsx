import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import { AuthScreen } from './components/AuthScreen';
import { Dashboard } from './components/Dashboard';

type Session = Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'];
type Theme = 'light' | 'dark';

function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
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

  return (
    <Dashboard
      session={session}
      theme={theme}
      onToggleTheme={toggleTheme}
    />
  );
}

export default App;
