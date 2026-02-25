import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { AddEntryModal } from '../AddEntryModal/AddEntryModal';
import { FeedTabs } from '../FeedTabs/FeedTabs';
import type { FeedEntry } from '../FeedTabs/types';
import { AppShell } from '../common/AppShell';
import { PageHeader } from '../common/PageHeader';
import { SlideConfirmDialog } from '../common/SlideConfirmDialog';
import '../../styles/layout.css';
import '../../styles/shared.css';

type AdminFeedPageProps = {
  session: Session;
};

type EditEntry = {
  id: string;
  datetime: string;
  rating: number | null;
  price: number | null;
  currency?: string | null;
  is_burger: boolean;
  additionalNotes?: string | null;
  restaurantId?: string | null;
  restaurantName?: string | null;
  burgerId?: string | null;
  burgerName?: string | null;
  meatType?: 'beef' | 'chicken' | 'vegan' | 'other' | null;
  photoUrl?: string | null;
  burgerOrigin?: 'restaurant' | 'homemade' | null;
  ingredients?: string | null;
};

export function AdminFeedPage({ session }: Readonly<AdminFeedPageProps>) {
  const navigate = useNavigate();
  const [refreshFeedKey, setRefreshFeedKey] = useState(0);
  const [editingEntry, setEditingEntry] = useState<EditEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<FeedEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteEntry = async () => {
    if (!deleteEntry) return;
    setDeleting(true);
    const { error } = await supabase
      .from('entries')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: session.user.id,
      })
      .eq('id', deleteEntry.id);
    if (!error) {
      setDeleteEntry(null);
      setRefreshFeedKey((prev) => prev + 1);
    }
    setDeleting(false);
  };

  return (
    <AppShell>
      <PageHeader
        title="Admin · Feed"
        subtitle="Moderacion de publicaciones y comentarios"
      />

      <main className="bw-main">
        <FeedTabs
          currentUserId={session.user.id}
          hideHeader
          refreshKey={refreshFeedKey}
          adminMode
          commentMode="full"
          onOpenEntry={(entryId) => navigate(`/posts/${entryId}`, { state: { returnTo: '/admin/feed' } })}
          onEditEntry={(entry) =>
            setEditingEntry({
              id: entry.id,
              datetime: entry.datetime,
              rating: entry.rating,
              price: entry.price,
              currency: entry.currency,
              is_burger: entry.isBurger,
              additionalNotes: entry.additionalNotes,
              restaurantId: entry.restaurantId,
              restaurantName: entry.restaurantName,
              burgerId: entry.burgerId,
              burgerName: entry.burgerName,
              meatType: entry.meatType,
              photoUrl: entry.photoUrl,
              burgerOrigin: entry.burgerOrigin,
              ingredients: entry.ingredients,
            })
          }
          onDeleteEntry={(entry) => setDeleteEntry(entry)}
        />
      </main>

      <AddEntryModal
        open={Boolean(editingEntry)}
        onClose={() => setEditingEntry(null)}
        onSaved={async () => {
          setEditingEntry(null);
          setRefreshFeedKey((prev) => prev + 1);
        }}
        session={session}
        theme="light"
        mode="edit"
        entry={editingEntry ?? undefined}
      />

      <SlideConfirmDialog
        open={Boolean(deleteEntry)}
        onClose={() => {
          if (deleting) return;
          setDeleteEntry(null);
        }}
        onConfirm={handleDeleteEntry}
        isProcessing={deleting}
        title="Eliminar publicacion"
        message="Esta accion ocultara la publicacion para los usuarios."
        confirmLabel="Eliminar publicacion"
      />
    </AppShell>
  );
}
