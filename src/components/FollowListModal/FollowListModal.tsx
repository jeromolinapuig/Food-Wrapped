import { useEffect, useRef, useState } from 'react';
import { Close, GroupAdd, CheckCircleOutline, Clear } from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import { lockBodyScroll } from '../../utils/scrollLock';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { ModalBase } from '../common/ModalBase';
import { UserCard } from '../common/UserCard';
import { useTranslation } from 'react-i18next';
import { loadFollowListItems, type FollowListItem, type FollowListMode } from './followListData';
import '../../styles/shared.css';
import './FollowListModal.css';
import '../UserProfileModal/UserProfileModal.css';

type FollowListModalProps = {
  open: boolean;
  mode: FollowListMode | null;
  currentUserId: string;
  onClose: () => void;
  onFollowingDelta: (delta: number) => void;
  onListCount?: (mode: FollowListMode, count: number) => void;
  preloadedItems?: FollowListItem[];
  preloadedLoading?: boolean;
  onRequestRefresh?: () => void;
  onViewPosts?: (user: { id: string; username: string | null; displayName: string | null }) => void;
};

export function FollowListModal({
  open,
  mode,
  currentUserId,
  onClose,
  onFollowingDelta,
  onListCount,
  preloadedItems,
  preloadedLoading = false,
  onRequestRefresh,
  onViewPosts,
}: Readonly<FollowListModalProps>) {
  const { t } = useTranslation();
  const [items, setItems] = useState<FollowListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [confirmUnfollow, setConfirmUnfollow] = useState<FollowListItem | null>(null);
  const [optimisticItems, setOptimisticItems] = useState<FollowListItem[] | null>(null);
  const [optimisticListKey, setOptimisticListKey] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const activeLoadIdRef = useRef(0);
  const listKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    return lockBodyScroll();
  }, [open]);

  useEffect(() => {
    if (!open || !mode || preloadedItems !== undefined) return;
    let cancelled = false;

    const load = async () => {
      const loadId = activeLoadIdRef.current + 1;
      activeLoadIdRef.current = loadId;
      const listKey = `${currentUserId}-${mode}`;
      const isSameList = listKeyRef.current === listKey;
      listKeyRef.current = listKey;
      const isStale = () => cancelled || activeLoadIdRef.current !== loadId;

      setLoading(true);
      setError(null);
      if (!isSameList) {
        setItems([]);
      }

      const { items: nextItems, count, error: loadError } = await loadFollowListItems(currentUserId, mode);

      if (isStale()) return;

      if (loadError) {
        setError(loadError.message);
        setLoading(false);
        return;
      }

      setItems(nextItems);
      onListCount?.(mode, count);
      setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [open, mode, currentUserId, onListCount, preloadedItems, refreshKey]);

  useEffect(() => {
    if (!open || !mode || preloadedItems !== undefined) return;
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
  }, [currentUserId, mode, onRequestRefresh, open, preloadedItems]);

  if (!open || !mode) return null;

  const listKey = `${currentUserId}-${mode}`;
  const baseItems = preloadedItems ?? items;
  const modalItems = optimisticItems && optimisticListKey === listKey ? optimisticItems : baseItems;
  const modalLoading = preloadedItems !== undefined ? preloadedLoading && !optimisticItems : loading;
  const term = searchTerm.trim().toLowerCase();
  const filteredItems = term
    ? modalItems.filter((item) => {
        const u = (item.username ?? '').toLowerCase();
        const d = (item.displayName ?? '').toLowerCase();
        return u.includes(term) || d.includes(term);
      })
    : modalItems;

  const title = mode === 'followers' ? t('followList.followers') : t('followList.following');
  const updateVisibleItems = (updater: (current: FollowListItem[]) => FollowListItem[]) => {
    if (preloadedItems !== undefined) {
      setOptimisticListKey(listKey);
      setOptimisticItems((current) => updater(current ?? preloadedItems));
      return;
    }
    setItems(updater);
  };

  const handleToggleFollow = async (userId: string) => {
    const item = modalItems.find((i) => i.id === userId);
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

    updateVisibleItems((prev) =>
      prev.map((row) =>
        row.id === userId ? { ...row, isOutgoing: true, outgoingFollowId: (data as { id: number }).id } : row
      )
    );
    onFollowingDelta(1);
    onRequestRefresh?.();
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
    updateVisibleItems((prev) => {
      const updated = prev.map((row) =>
        row.id === userId ? { ...row, isOutgoing: false, outgoingFollowId: null } : row
      );
      return mode === 'following' ? updated.filter((row) => row.id !== userId) : updated;
    });
    onFollowingDelta(-1);
    onRequestRefresh?.();
    setActioningId(null);
    setConfirmUnfollow(null);
  };

  return (
    <>
      <ModalBase onClose={onClose} modalClassName="bw-modal bw-user-profile-modal">
        <div className="bw-modal-header" style={{ justifyContent: 'space-between' }}>
          <div className="bw-modal-title" style={{ margin: 0 }}>
            {title} ({modalItems.length})
          </div>
          <button type="button" className="bw-icon-button" onClick={onClose} aria-label={t('common.close')}>
            <Close fontSize="small" />
          </button>
        </div>

        <div className="bw-field" style={{ marginBottom: 12 }}>
          <div style={{ position: 'relative' }}>
            <input
              type="search"
              className="bw-input"
              placeholder={t('followList.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label={t('followList.searchClear')}
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

        {modalLoading && <p style={{ fontSize: 13 }}>{t('followList.loading')}</p>}
        {error && <p style={{ color: 'red', fontSize: 12 }}>{error}</p>}
        {!modalLoading && !filteredItems.length && (
          <p style={{ fontSize: 13, opacity: 0.8 }}>
            {mode === 'followers'
              ? term
                ? t('followList.noFollowersName')
                : t('followList.noFollowers')
              : term
                ? t('followList.noFollowingName')
                : t('followList.noFollowing')}
          </p>
        )}

        {!modalLoading && (
          <div className="bw-follow-list">
            {filteredItems.map((item) => {
              const isMutual = item.isIncoming && item.isOutgoing;
              const metaText = isMutual
                ? t('followList.mutual')
                : item.isIncoming
                  ? t('followList.followsYou')
                  : item.isOutgoing && mode === 'following'
                    ? t('followList.youFollow')
                    : '';
              return (
                <UserCard
              key={item.id}
              handle={item.username ?? 'usuario'}
              avatarUrl={item.avatarUrl}
              avatarFrame={item.avatarFrame}
              avatarAlt={item.username ?? ''}
              avatarInitial={(item.username ?? '?').charAt(0).toUpperCase()}
              meta={metaText || null}
              bio={item.bio}
              infoExtra={onViewPosts ? (
                <button
                  type="button"
                  className="bw-link-button bw-link-inline"
                  onClick={() => onViewPosts({ id: item.id, username: item.username, displayName: item.displayName })}
                  style={{ marginTop: 4 }}
                >
                  {t('followList.viewStats')}
                </button>
              ) : null}
              action={(
                <button
                  type="button"
                  className={`bw-user-action ${item.isOutgoing ? 'is-following' : ''} ${item.isIncoming && item.isOutgoing ? 'is-accepted' : ''}`}
                  onClick={() => handleToggleFollow(item.id)}
                  disabled={actioningId === item.id}
                  title={item.isOutgoing ? t('followList.unfollow') : t('followList.follow')}
                >
                  {item.isOutgoing ? <CheckCircleOutline fontSize="small" /> : <GroupAdd fontSize="small" />}
                </button>
              )}
            />
              );
            })}
          </div>
        )}
      </ModalBase>
      <ConfirmDialog
        open={Boolean(confirmUnfollow)}
        onClose={() => setConfirmUnfollow(null)}
        title={confirmUnfollow ? t('followList.confirmUnfollow', { user: confirmUnfollow.username ?? 'usuario' }) : ''}
        actions={(
          <>
            <button className="bw-btn bw-btn-ghost" onClick={() => setConfirmUnfollow(null)} disabled={actioningId === confirmUnfollow?.id}>
              {t('followList.cancel')}
            </button>
            <button className="bw-btn bw-btn-primary" onClick={handleConfirmUnfollow} disabled={actioningId === confirmUnfollow?.id}>
              {t('followList.unfollow')}
            </button>
          </>
        )}
      />
    </>
  );
}
