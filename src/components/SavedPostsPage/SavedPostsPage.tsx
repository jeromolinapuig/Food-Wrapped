import { useCallback, useEffect, useState, startTransition } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';
import { FeedTabs } from '../FeedTabs/FeedTabs';
import { AppShell } from '../common/AppShell';
import { BackButton } from '../common/BackButton';
import { PageHeader } from '../common/PageHeader';
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
    startTransition(() => {
      void loadSavedEntries();
    });
  }, [loadSavedEntries]);

  useEffect(() => {
    const handleBookmarksUpdated = () => loadSavedEntries();
    window.addEventListener('bw-bookmarks-updated', handleBookmarksUpdated);
    return () => window.removeEventListener('bw-bookmarks-updated', handleBookmarksUpdated);
  }, [loadSavedEntries]);

  return (
    <AppShell>
        <PageHeader
          title="Posts guardados"
          subtitle="Tus publicaciones guardadas."
          leading={<BackButton onClick={onBack} ariaLabel="Volver" />}
        />

        <main className="bw-main">
          {loading && <p className="bw-helper">Cargando guardados...</p>}
          {error && <p className="bw-helper" style={{ color: 'red' }}>{error}</p>}
          <FeedTabs
            currentUserId={session.user.id}
            entryIdsFilter={savedEntryIds}
            hideHeader
          />
        </main>
    </AppShell>
  );
}
