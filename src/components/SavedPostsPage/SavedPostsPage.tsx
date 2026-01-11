import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';
import { FeedTabs } from '../FeedTabs/FeedTabs';
import '../../styles/layout.css';
import '../../styles/shared.css';

type SavedPostsPageProps = {
  session: Session;
  onBack: () => void;
};

export function SavedPostsPage({ session, onBack }: Readonly<SavedPostsPageProps>) {
  const [savedEntryIds, setSavedEntryIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadSavedEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: savedError } = await supabase
      .from('entry_bookmarks')
      .select('entry_id')
      .eq('user_id', session.user.id);

    if (savedError) {
      setError(savedError.message);
      setSavedEntryIds([]);
      setLoading(false);
      return;
    }

    const ids = Array.from(
      new Set(
        (data ?? [])
          .map((row) => (row as { entry_id: string }).entry_id)
          .filter(Boolean)
      )
    );
    setSavedEntryIds(ids);
    setLoading(false);
  }, [session.user.id]);

  useEffect(() => {
    loadSavedEntries();
  }, [loadSavedEntries]);

  useEffect(() => {
    const handleBookmarksUpdated = () => loadSavedEntries();
    window.addEventListener('bw-bookmarks-updated', handleBookmarksUpdated);
    return () => window.removeEventListener('bw-bookmarks-updated', handleBookmarksUpdated);
  }, [loadSavedEntries]);

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
            <h1 className="bw-title">Posts guardados</h1>
            <p className="bw-subtitle">Tus publicaciones guardadas.</p>
          </div>
        </header>

        <main className="bw-main">
          {loading && <p className="bw-helper">Cargando guardados...</p>}
          {error && <p className="bw-helper" style={{ color: 'red' }}>{error}</p>}
          <FeedTabs
            currentUserId={session.user.id}
            entryIdsFilter={savedEntryIds}
            hideHeader
          />
        </main>
      </div>
    </div>
  );
}
