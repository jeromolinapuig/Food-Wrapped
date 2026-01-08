import { useEffect, useState } from 'react';
import { Close, GroupAdd, CheckCircleOutline, Clear } from '@mui/icons-material';
import { supabase } from '../lib/supabaseClient';
import { lockBodyScroll } from '../utils/scrollLock';
import '../styles/shared.css';
import '../styles/follow-list.css';
import '../styles/user-profile-modal.css';

export type FollowListMode = 'followers' | 'following';

type FollowListItem = {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  isOutgoing: boolean;
  isIncoming: boolean;
  outgoingFollowId: number | null;
  incomingFollowId: number | null;
};

type FollowListModalProps = {
  open: boolean;
  mode: FollowListMode | null;
  currentUserId: string;
  onClose: () => void;
  onFollowingDelta: (delta: number) => void;
  onListCount?: (mode: FollowListMode, count: number) => void;
  onViewPosts?: (user: { id: string; username: string | null; displayName: string | null }) => void;
};

export function FollowListModal({
  open,
  mode,
  currentUserId,
  onClose,
  onFollowingDelta,
  onListCount,
  onViewPosts,
}: Readonly<FollowListModalProps>) {
  const [items, setItems] = useState<FollowListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [confirmUnfollow, setConfirmUnfollow] = useState<FollowListItem | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    return lockBodyScroll();
  }, [open]);

  useEffect(() => {
    if (!open || !mode) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setItems([]);

      const { data: baseData, error: baseError } = await supabase
        .from('follows')
        .select('id, follower_id, following_id')
        .eq(mode === 'followers' ? 'following_id' : 'follower_id', currentUserId);

      if (cancelled) return;

      if (baseError) {
        setError(baseError.message);
        setLoading(false);
        return;
      }

      const rows = (baseData ?? []) as { id: number; follower_id: string; following_id: string }[];
      const userIds = Array.from(new Set(rows.map((r) => (mode === 'followers' ? r.follower_id : r.following_id))));

      const incomingBaseMap = mode === 'followers' ? Object.fromEntries(rows.map((r) => [r.follower_id, r.id])) : {};
      const outgoingBaseMap = mode === 'following' ? Object.fromEntries(rows.map((r) => [r.following_id, r.id])) : {};

      if (!userIds.length) {
        setItems([]);
        onListCount?.(mode, 0);
        setLoading(false);
        return;
      }

      const [{ data: profilesData, error: profilesError }, extraFollows] = await Promise.all([
        supabase.from('profiles').select('id, username, display_name, avatar_url, bio').in('id', userIds),
        mode === 'followers'
          ? supabase
              .from('follows')
              .select('id, follower_id, following_id')
              .eq('follower_id', currentUserId)
              .in('following_id', userIds)
          : supabase
              .from('follows')
              .select('id, follower_id, following_id')
              .eq('following_id', currentUserId)
              .in('follower_id', userIds),
      ]);

      if (cancelled) return;

      if (profilesError) {
        setError(profilesError.message);
        setLoading(false);
        return;
      }

      if (extraFollows?.error) {
        console.error('Error cargando seguimientos', extraFollows.error);
      }

      const extraRows = (extraFollows?.data ?? []) as { id: number; follower_id: string; following_id: string }[];
      const outgoingExtraMap = mode === 'followers' ? Object.fromEntries(extraRows.map((r) => [r.following_id, r.id])) : {};
      const incomingExtraMap = mode === 'following' ? Object.fromEntries(extraRows.map((r) => [r.follower_id, r.id])) : {};

      const mapped: FollowListItem[] = (profilesData ?? []).map((p) => {
        const id = (p as { id: string }).id;
        const outgoingFollowId = mode === 'following' ? outgoingBaseMap[id] ?? null : outgoingExtraMap[id] ?? null;
        const incomingFollowId = mode === 'followers' ? incomingBaseMap[id] ?? null : incomingExtraMap[id] ?? null;

        return {
          id,
          username: (p as { username: string | null }).username,
          displayName: (p as { display_name: string | null }).display_name,
          avatarUrl: (p as { avatar_url: string | null }).avatar_url,
          bio: (p as { bio: string | null }).bio,
          isOutgoing: Boolean(outgoingFollowId),
          isIncoming: Boolean(incomingFollowId),
          outgoingFollowId,
          incomingFollowId,
        };
      });

      setItems(mapped);
      onListCount?.(mode, mapped.length);
      setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [open, mode, currentUserId, onListCount, refreshKey]);

  useEffect(() => {
    if (!open || !mode) return;
    const filter = mode === 'followers'
      ? `following_id=eq.${currentUserId}`
      : `follower_id=eq.${currentUserId}`;
    const channel = supabase
      .channel(`follow-list-${currentUserId}-${mode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follows', filter },
        () => {
          setRefreshKey((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, mode, open]);

  if (!open || !mode) return null;

  const term = searchTerm.trim().toLowerCase();
  const filteredItems = term
    ? items.filter((item) => {
        const u = (item.username ?? '').toLowerCase();
        const d = (item.displayName ?? '').toLowerCase();
        return u.includes(term) || d.includes(term);
      })
    : items;

  const title = mode === 'followers' ? 'Seguidores' : 'Seguidos';

  const handleToggleFollow = async (userId: string) => {
    const item = items.find((i) => i.id === userId);
    if (!item || actioningId) return;

    if (item.isOutgoing) {
      setConfirmUnfollow(item);
      return;
    }

    setActioningId(userId);

    const { data, error } = await supabase
      .from('follows')
      .insert({ follower_id: currentUserId, following_id: userId })
      .select('id')
      .single();

    if (error || !data) {
      console.error('Error al seguir', error);
      setActioningId(null);
      return;
    }

    setItems((prev) =>
      prev.map((row) =>
        row.id === userId ? { ...row, isOutgoing: true, outgoingFollowId: (data as { id: number }).id } : row
      )
    );
    onFollowingDelta(1);
    setActioningId(null);
  };

  const handleConfirmUnfollow = async () => {
    if (!confirmUnfollow || !confirmUnfollow.outgoingFollowId) {
      setConfirmUnfollow(null);
      return;
    }
    const userId = confirmUnfollow.id;
    setActioningId(userId);
    const { error } = await supabase.from('follows').delete().eq('id', confirmUnfollow.outgoingFollowId);
    if (error) {
      console.error('Error al dejar de seguir', error);
      setActioningId(null);
      setConfirmUnfollow(null);
      return;
    }
    setItems((prev) => {
      const updated = prev.map((row) =>
        row.id === userId ? { ...row, isOutgoing: false, outgoingFollowId: null } : row
      );
      return mode === 'following' ? updated.filter((row) => row.id !== userId) : updated;
    });
    onFollowingDelta(-1);
    setActioningId(null);
    setConfirmUnfollow(null);
  };

  return (
    <div className="bw-modal-backdrop" onClick={onClose}>
      <div className="bw-modal bw-user-profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bw-modal-header" style={{ justifyContent: 'space-between' }}>
          <div className="bw-modal-title" style={{ margin: 0 }}>
            {title} ({items.length})
          </div>
          <button type="button" className="bw-icon-button" onClick={onClose} aria-label="Cerrar">
            <Close fontSize="small" />
          </button>
        </div>

        <div className="bw-field" style={{ marginBottom: 12 }}>
          <div style={{ position: 'relative' }}>
            <input
              type="search"
              className="bw-input"
              placeholder="Buscar en la lista..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Limpiar búsqueda"
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 'none',
                  background: 'transparent',
                  padding: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--bw-text-muted)',
                  cursor: 'pointer',
                }}
              >
                <Clear fontSize="small" />
              </button>
            )}
          </div>
        </div>

        {loading && <p style={{ fontSize: 13 }}>Cargando...</p>}
        {error && <p style={{ color: 'red', fontSize: 12 }}>{error}</p>}
        {!loading && !filteredItems.length && (
          <p style={{ fontSize: 13, opacity: 0.8 }}>
            {mode === 'followers'
              ? term
                ? 'Aún no tienes seguidores con ese nombre.'
                : 'Aún no tienes seguidores.'
              : term
                ? 'No sigues a nadie con ese nombre.'
                : 'Todavía no sigues a nadie.'}
          </p>
        )}

        {!loading && (
          <div className="bw-follow-list">
            {filteredItems.map((item) => {
              const isMutual = item.isIncoming && item.isOutgoing;
              const metaText = isMutual
                ? 'Os seguís mutuamente'
                : item.isIncoming
                  ? 'Te sigue'
                  : item.isOutgoing && mode === 'following'
                    ? 'Lo sigues'
                    : '';
              return (
                <div className="bw-user-card" key={item.id}>
                  <div className="bw-user-info">
                    <div className="bw-avatar bw-avatar-sm">
                      {item.avatarUrl ? (
                        <img src={item.avatarUrl} alt={item.username ?? ''} className="bw-avatar-image" />
                      ) : (
                        <div className="bw-avatar-placeholder">
                          {(item.username ?? '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="bw-user-name">@{item.username ?? 'usuario'}</div>
                      {metaText && <div className="bw-user-meta">{metaText}</div>}
                      {item.bio && <div className="bw-user-bio">{item.bio}</div>}
                      {onViewPosts && (
                        <button
                          type="button"
                          className="bw-link-button bw-link-inline"
                          onClick={() => onViewPosts({ id: item.id, username: item.username, displayName: item.displayName })}
                          style={{ marginTop: 4 }}
                        >
                          Ver sus estadísticas
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`bw-user-action ${item.isOutgoing ? 'is-following' : ''} ${item.isIncoming && item.isOutgoing ? 'is-accepted' : ''}`}
                    onClick={() => handleToggleFollow(item.id)}
                    disabled={actioningId === item.id}
                    title={item.isOutgoing ? 'Dejar de seguir' : 'Seguir'}
                  >
                    {item.isOutgoing ? <CheckCircleOutline fontSize="small" /> : <GroupAdd fontSize="small" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {confirmUnfollow && (
        <div
          className="bw-confirm-backdrop"
          onClick={(e) => {
            e.stopPropagation();
            setConfirmUnfollow(null);
          }}
        >
          <div className="bw-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="bw-confirm-title">¿Estás seguro que quieres dejar de seguir a @{confirmUnfollow.username ?? 'usuario'}?</h3>
            <div className="bw-confirm-actions">
              <button className="bw-btn bw-btn-ghost" onClick={() => setConfirmUnfollow(null)} disabled={actioningId === confirmUnfollow.id}>
                Cancelar
              </button>
              <button className="bw-btn bw-btn-primary" onClick={handleConfirmUnfollow} disabled={actioningId === confirmUnfollow.id}>
                Dejar de seguir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
