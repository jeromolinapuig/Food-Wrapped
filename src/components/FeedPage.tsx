import type { Session } from '@supabase/supabase-js';
import { TopMenu } from './TopMenu';
import { FeedTabs } from './FeedTabs';

type FeedPageProps = {
  session: Session;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onNavigate: (page: 'dashboard' | 'feed' | 'profile') => void;
};

export function FeedPage({ session, theme, onToggleTheme, onNavigate }: FeedPageProps) {
  const username = (session.user.user_metadata as { username?: string } | null)?.username;

  return (
    <div className="bw-app-root">
      <div className="bw-shell">
        <header className="bw-header">
          <div className="bw-header-icon">
            <img src="/logo.png" alt="Burger Wrapped" />
          </div>
          <div style={{ flex: 1 }}>
            <h1 className="bw-title">Feed</h1>
            <p className="bw-subtitle">
              Hola {username ?? session.user.email}
            </p>
          </div>

          <TopMenu theme={theme} onToggleTheme={onToggleTheme} onNavigate={onNavigate} />
        </header>

        <main className="bw-main">
          <FeedTabs currentUserId={session.user.id} />
        </main>
      </div>
    </div>
  );
}
