import { useCallback, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

type EntryReactions = { likeCount: number; liked: boolean; saved: boolean };

type UseEntryReactionsOptions = {
  viewerId: string | null;
  isReadOnly: boolean;
  onRequireLogin?: () => void;
};

type UseEntryReactionsResult = {
  entryReactions: Record<string, EntryReactions>;
  pendingLikes: Record<string, boolean>;
  pendingSaves: Record<string, boolean>;
  loadEntryReactions: (entryIds: string[]) => Promise<void>;
  toggleLike: (entryId: string) => Promise<void>;
  toggleSave: (entryId: string) => Promise<void>;
};

export function useEntryReactions({
  viewerId,
  isReadOnly,
  onRequireLogin,
}: UseEntryReactionsOptions): UseEntryReactionsResult {
  const [entryReactions, setEntryReactions] = useState<Record<string, EntryReactions>>({});
  const [pendingLikes, setPendingLikes] = useState<Record<string, boolean>>({});
  const [pendingSaves, setPendingSaves] = useState<Record<string, boolean>>({});

  const loadEntryReactions = useCallback(
    async (entryIds: string[]) => {
      if (!entryIds.length) {
        setEntryReactions({});
        return;
      }

      const [likesResponse, savedResponse] = await Promise.all([
        supabase
          .from('entry_likes')
          .select('entry_id, user_id')
          .in('entry_id', entryIds),
        viewerId
          ? supabase
              .from('entry_bookmarks')
              .select('entry_id')
              .eq('user_id', viewerId)
              .in('entry_id', entryIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (likesResponse.error || savedResponse.error) {
        console.error('Error loading reactions', likesResponse.error ?? savedResponse.error);
        return;
      }

      const likeCounts: Record<string, number> = {};
      const likedByMe = new Set<string>();
      (likesResponse.data ?? []).forEach((row) => {
        const typed = row as { entry_id: string; user_id: string };
        likeCounts[typed.entry_id] = (likeCounts[typed.entry_id] ?? 0) + 1;
        if (viewerId && typed.user_id === viewerId) {
          likedByMe.add(typed.entry_id);
        }
      });

      const savedIds = new Set(
        (savedResponse.data ?? []).map((row) => (row as { entry_id: string }).entry_id)
      );

      const next: Record<string, EntryReactions> = {};
      entryIds.forEach((id) => {
        next[id] = {
          likeCount: likeCounts[id] ?? 0,
          liked: likedByMe.has(id),
          saved: savedIds.has(id),
        };
      });
      setEntryReactions(next);
    },
    [viewerId]
  );

  const toggleLike = useCallback(
    async (entryId: string) => {
      if (isReadOnly || !viewerId) {
        onRequireLogin?.();
        return;
      }
      if (pendingLikes[entryId]) return;
      const current = entryReactions[entryId] ?? { likeCount: 0, liked: false, saved: false };
      const nextLiked = !current.liked;
      const nextCount = Math.max(0, current.likeCount + (nextLiked ? 1 : -1));

      setEntryReactions((prev) => ({
        ...prev,
        [entryId]: { ...current, liked: nextLiked, likeCount: nextCount },
      }));
      setPendingLikes((prev) => ({ ...prev, [entryId]: true }));

      const { error } = nextLiked
        ? await supabase.from('entry_likes').insert({ entry_id: entryId, user_id: viewerId })
        : await supabase.from('entry_likes').delete().match({ entry_id: entryId, user_id: viewerId });

      if (error) {
        console.error('Error toggling like', error);
        setEntryReactions((prev) => ({ ...prev, [entryId]: current }));
      }

      setPendingLikes((prev) => {
        const copy = { ...prev };
        delete copy[entryId];
        return copy;
      });
    },
    [entryReactions, isReadOnly, onRequireLogin, pendingLikes, viewerId]
  );

  const toggleSave = useCallback(
    async (entryId: string) => {
      if (isReadOnly || !viewerId) {
        onRequireLogin?.();
        return;
      }
      if (pendingSaves[entryId]) return;
      const current = entryReactions[entryId] ?? { likeCount: 0, liked: false, saved: false };
      const nextSaved = !current.saved;

      setEntryReactions((prev) => ({
        ...prev,
        [entryId]: { ...current, saved: nextSaved },
      }));
      setPendingSaves((prev) => ({ ...prev, [entryId]: true }));

      const { error } = nextSaved
        ? await supabase.from('entry_bookmarks').insert({ entry_id: entryId, user_id: viewerId })
        : await supabase.from('entry_bookmarks').delete().match({ entry_id: entryId, user_id: viewerId });

      if (error) {
        console.error('Error toggling bookmark', error);
        setEntryReactions((prev) => ({ ...prev, [entryId]: current }));
      } else {
        window.dispatchEvent(new CustomEvent('bw-bookmarks-updated'));
      }

      setPendingSaves((prev) => {
        const copy = { ...prev };
        delete copy[entryId];
        return copy;
      });
    },
    [entryReactions, isReadOnly, onRequireLogin, pendingSaves, viewerId]
  );

  return {
    entryReactions,
    pendingLikes,
    pendingSaves,
    loadEntryReactions,
    toggleLike,
    toggleSave,
  };
}
