import { useCallback, useEffect, useState, startTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';
import { FeedTabs } from '../FeedTabs/FeedTabs';
import { AppShell } from '../common/AppShell';
import { BackButton } from '../common/BackButton';
import { PageHeader } from '../common/PageHeader';
import '../../styles/layout.css';
import '../../styles/shared.css';

type SavedPostsPageProps = {
  session: Session | null;
  onBack: () => void;
};

export function SavedPostsPage({ session, onBack }: Readonly<SavedPostsPageProps>) {
  const navigate = useNavigate();
  const [savedEntryIds, setSavedEntryIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const currentUserId = session?.user.id ?? null;

  const loadSavedEntries = useCallback(async () => {
    if (!session) {
      setSavedEntryIds([]);
      setError(null);
      setLoading(false);
      return;
    }
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
  }, [session]);

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
          {session && currentUserId ? (
            <FeedTabs
              currentUserId={currentUserId}
              entryIdsFilter={savedEntryIds}
              hideHeader
              onOpenEntry={(entryId) => navigate(`/posts/${entryId}`, { state: { returnTo: '/saved' } })}
            />
          ) : (
            <p className="bw-helper">Inicia sesión para ver tus posts guardados.</p>
          )}
        </main>
    </AppShell>
  );
}
