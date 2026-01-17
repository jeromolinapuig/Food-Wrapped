import { startTransition, useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { CommentMode, EntryComment, SupabaseCommentRow } from './types';

type EntryRef = { id: string };

type CommentConfirm = {
  entryId: string;
  comment: EntryComment;
};

type UseEntryCommentsOptions = {
  entries: EntryRef[];
  commentMode: CommentMode;
  headerOnly: boolean;
  refreshKey: number;
  viewerId: string | null;
  maxCommentLength?: number;
};

type UseEntryCommentsResult = {
  entryComments: Record<string, EntryComment[]>;
  commentCounts: Record<string, number>;
  commentDrafts: Record<string, string>;
  commentLoading: Record<string, boolean>;
  commentErrors: Record<string, string | null>;
  commentActioning: Record<string, boolean>;
  commentConfirm: CommentConfirm | null;
  maxCommentLength: number;
  setCommentConfirm: (value: CommentConfirm | null) => void;
  setCommentDraft: (entryId: string, value: string) => void;
  submitComment: (entryId: string) => Promise<void>;
  deleteComment: () => Promise<void>;
};

export function useEntryComments({
  entries,
  commentMode,
  headerOnly,
  refreshKey,
  viewerId,
  maxCommentLength: maxCommentLengthProp,
}: UseEntryCommentsOptions): UseEntryCommentsResult {
  const [entryComments, setEntryComments] = useState<Record<string, EntryComment[]>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentLoading, setCommentLoading] = useState<Record<string, boolean>>({});
  const [commentErrors, setCommentErrors] = useState<Record<string, string | null>>({});
  const [commentActioning, setCommentActioning] = useState<Record<string, boolean>>({});
  const [commentConfirm, setCommentConfirm] = useState<CommentConfirm | null>(null);
  const maxCommentLength = maxCommentLengthProp ?? 100;

  const loadEntryComments = useCallback(async (entryId: string) => {
    setCommentLoading((prev) => ({ ...prev, [entryId]: true }));
    setCommentErrors((prev) => ({ ...prev, [entryId]: null }));
    const limit = 200;
    const query = supabase
      .from('entry_comments')
      .select('id, entry_id, user_id, body, created_at')
      .eq('entry_id', entryId)
      .order('created_at', { ascending: false })
      .limit(limit);

    const { data, error } = await query;

    if (error) {
      setCommentErrors((prev) => ({ ...prev, [entryId]: error.message }));
      setCommentLoading((prev) => ({ ...prev, [entryId]: false }));
      return;
    }

    const rows = (data ?? []) as SupabaseCommentRow[];
    const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)));
    let profileMap: Record<string, { username: string | null; display_name: string | null; avatar_url: string | null }> = {};
    if (userIds.length) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', userIds);
      profileMap = Object.fromEntries(
        (profilesData ?? []).map((profile) => [
          (profile as { id: string }).id,
          {
            username: (profile as { username: string | null }).username,
            display_name: (profile as { display_name: string | null }).display_name,
            avatar_url: (profile as { avatar_url: string | null }).avatar_url,
          },
        ])
      );
    }

    const mapped: EntryComment[] = rows.map((row) => {
      const profile = profileMap[row.user_id];
      return {
        id: row.id,
        entryId: row.entry_id,
        userId: row.user_id,
        body: row.body ?? '',
        createdAt: row.created_at,
        username: profile?.username ?? 'usuario',
        displayName: profile?.display_name ?? null,
        avatarUrl: profile?.avatar_url ?? null,
      };
    });

    setEntryComments((prev) => ({ ...prev, [entryId]: mapped }));
    setCommentCounts((prev) => ({ ...prev, [entryId]: mapped.length }));
    setCommentLoading((prev) => ({ ...prev, [entryId]: false }));
  }, []);

  const loadPreviewComments = useCallback(async (entryIds: string[]) => {
    if (!entryIds.length) return;
    setCommentErrors((prev) => {
      const next = { ...prev };
      entryIds.forEach((id) => {
        next[id] = null;
      });
      return next;
    });
    setCommentLoading((prev) => {
      const next = { ...prev };
      entryIds.forEach((id) => {
        next[id] = true;
      });
      return next;
    });

    const limit = Math.min(entryIds.length * 3, 60);
    const { data, error } = await supabase
      .from('entry_comments')
      .select('id, entry_id, user_id, body, created_at')
      .in('entry_id', entryIds)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      setCommentErrors((prev) => {
        const next = { ...prev };
        entryIds.forEach((id) => {
          next[id] = error.message;
        });
        return next;
      });
      setCommentLoading((prev) => {
        const next = { ...prev };
        entryIds.forEach((id) => {
          next[id] = false;
        });
        return next;
      });
      return;
    }

    const rows = (data ?? []) as SupabaseCommentRow[];
    const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)));
    let profileMap: Record<string, { username: string | null; display_name: string | null; avatar_url: string | null }> = {};
    if (userIds.length) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', userIds);
      profileMap = Object.fromEntries(
        (profilesData ?? []).map((profile) => [
          (profile as { id: string }).id,
          {
            username: (profile as { username: string | null }).username,
            display_name: (profile as { display_name: string | null }).display_name,
            avatar_url: (profile as { avatar_url: string | null }).avatar_url,
          },
        ])
      );
    }

    const grouped: Record<string, EntryComment[]> = {};
    rows.forEach((row) => {
      const profile = profileMap[row.user_id];
      const entryId = row.entry_id;
      if (!grouped[entryId]) grouped[entryId] = [];
      if (grouped[entryId].length >= 3) return;
      grouped[entryId].push({
        id: row.id,
        entryId,
        userId: row.user_id,
        body: row.body ?? '',
        createdAt: row.created_at,
        username: profile?.username ?? 'usuario',
        displayName: profile?.display_name ?? null,
        avatarUrl: profile?.avatar_url ?? null,
      });
    });

    setEntryComments((prev) => ({ ...prev, ...grouped }));
    setCommentCounts((prev) => {
      const next = { ...prev };
      entryIds.forEach((id) => {
        next[id] = grouped[id]?.length ?? 0;
      });
      return next;
    });
    setCommentLoading((prev) => {
      const next = { ...prev };
      entryIds.forEach((id) => {
        next[id] = false;
      });
      return next;
    });
  }, []);

  useEffect(() => {
    if (headerOnly || commentMode === 'none') return;
    if (!entries.length) {
      startTransition(() => {
        setEntryComments({});
        setCommentCounts({});
      });
      return;
    }
    if (commentMode === 'preview') {
      startTransition(() => {
        void loadPreviewComments(entries.map((entry) => entry.id));
      });
      return;
    }
    void Promise.all(entries.map((entry) => loadEntryComments(entry.id)));
  }, [commentMode, entries, headerOnly, loadEntryComments, loadPreviewComments, refreshKey]);

  const submitComment = useCallback(
    async (entryId: string) => {
      if (!viewerId) return;
      const raw = commentDrafts[entryId] ?? '';
      const body = raw.trim();
      if (!body) return;
      if (body.length > maxCommentLength) {
        setCommentErrors((prev) => ({ ...prev, [entryId]: `Maximo ${maxCommentLength} caracteres.` }));
        return;
      }
      setCommentActioning((prev) => ({ ...prev, [entryId]: true }));
      setCommentErrors((prev) => ({ ...prev, [entryId]: null }));
      const { error } = await supabase
        .from('entry_comments')
        .insert({ entry_id: entryId, user_id: viewerId, body });
      if (error) {
        setCommentErrors((prev) => ({ ...prev, [entryId]: 'No se pudo guardar el comentario.' }));
        setCommentActioning((prev) => ({ ...prev, [entryId]: false }));
        return;
      }
      setCommentDrafts((prev) => ({ ...prev, [entryId]: '' }));
      await loadEntryComments(entryId);
      setCommentActioning((prev) => ({ ...prev, [entryId]: false }));
    },
    [commentDrafts, loadEntryComments, maxCommentLength, viewerId]
  );

  const deleteComment = useCallback(async () => {
    if (!commentConfirm) return;
    const { entryId, comment } = commentConfirm;
    setCommentActioning((prev) => ({ ...prev, [comment.id]: true }));
    const { error } = await supabase
      .from('entry_comments')
      .delete()
      .eq('id', comment.id);
    if (error) {
      setCommentErrors((prev) => ({ ...prev, [entryId]: 'No se pudo eliminar el comentario.' }));
      setCommentActioning((prev) => ({ ...prev, [comment.id]: false }));
      setCommentConfirm(null);
      return;
    }
    setEntryComments((prev) => ({
      ...prev,
      [entryId]: (prev[entryId] ?? []).filter((item) => item.id !== comment.id),
    }));
    setCommentCounts((prev) => ({
      ...prev,
      [entryId]: Math.max(0, (prev[entryId] ?? 1) - 1),
    }));
    setCommentActioning((prev) => ({ ...prev, [comment.id]: false }));
    setCommentConfirm(null);
  }, [commentConfirm]);

  const setCommentDraft = useCallback((entryId: string, value: string) => {
    setCommentDrafts((prev) => ({ ...prev, [entryId]: value }));
  }, []);

  return {
    entryComments,
    commentCounts,
    commentDrafts,
    commentLoading,
    commentErrors,
    commentActioning,
    commentConfirm,
    maxCommentLength,
    setCommentConfirm,
    setCommentDraft,
    submitComment,
    deleteComment,
  };
}
