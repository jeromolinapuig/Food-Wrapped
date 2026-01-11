import type { Session } from '@supabase/supabase-js';
import { FeedTabs } from '../FeedTabs/FeedTabs';
import '../../styles/layout.css';
import '../../styles/shared.css';

type PostPageProps = {
  session: Session;
  entryId: string;
  onBack: () => void;
};

export function PostPage({ session, entryId, onBack }: Readonly<PostPageProps>) {
  return (
    <div className="bw-app-root">
      <div className="bw-shell">
        <header className="bw-header">
          <button type="button" className="bw-back-button" onClick={onBack} aria-label="Volver">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M15.41 16.59 10.83 12l4.58-4.59L14 6l-6 6 6 6z" />
            </svg>
          </button>
          <div className="bw-header-icon">
            <img src="/logo.png" alt="Burger Wrapped" />
          </div>
          <div style={{ flex: 1 }}>
            <h1 className="bw-title">Post</h1>
            <p className="bw-subtitle">Detalle de la entrada.</p>
          </div>
        </header>

        <main className="bw-main">
          <FeedTabs
            currentUserId={session.user.id}
            entryIdsFilter={[entryId]}
            hideHeader
          />
        </main>
      </div>
    </div>
  );
}
