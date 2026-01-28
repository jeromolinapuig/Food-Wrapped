import { useCallback, useEffect, useMemo, useState, startTransition } from 'react';
import { ChatBubbleOutline, Favorite, GroupAdd, Notifications, PersonAdd } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabaseClient';
import { lockBodyScroll } from '../../utils/scrollLock';
import '../../styles/shared.css';
import './NotificationsDrawer.css';

type NotificationsDrawerProps = {
  open: boolean;
  currentUserId: string;
  onClose: () => void;
  onOpenEntry: (entryId: string) => void;
  onOpenProfile: (userId: string) => void;
  onOpenInvites: () => void;
  onCountChange?: (count: number) => void;
  onLatestChange?: (latest: string | null) => void;
};

type NotificationItem =
  | {
      id: string;
      type: 'like';
      entryId: string;
      likerIds: string[];
      createdAt: string | null;
    }
  | {
      id: string;
      type: 'comment';
      entryId: string;
      commenterIds: string[];
      createdAt: string | null;
    }
  | {
      id: string;
      type: 'follow';
      userId: string;
      createdAt: string | null;
    }
  | {
      id: string;
      type: 'invite';
      inviteId: string;
      inviterId: string;
      groupId: string;
      createdAt: string | null;
    };

type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
};

export function NotificationsDrawer({
  open,
  currentUserId,
  onClose,
  onOpenEntry,
  onOpenProfile,
  onOpenInvites,
  onCountChange,
  onLatestChange,
}: Readonly<NotificationsDrawerProps>) {
  const { t } = useTranslation();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileMap, setProfileMap] = useState<Record<string, ProfileRow>>({});
  const [groupMap, setGroupMap] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!open) return;
    return lockBodyScroll();
  }, [open]);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: entryRows, error: entriesError } = await supabase
      .from('entries')
      .select('id, datetime')
      .eq('user_id', currentUserId)
      .order('datetime', { ascending: false })
      .limit(200);

    if (entriesError) {
      setError('No se pudieron cargar las notificaciones.');
      setLoading(false);
      return;
    }

    const entryIds = (entryRows ?? []).map((row) => (row as { id: string }).id);

    const [likesResponse, commentsResponse, followsResponse, invitesResponse] = await Promise.all([
      entryIds.length
        ? supabase
            .from('entry_likes')
            .select('entry_id, user_id, created_at')
            .in('entry_id', entryIds)
            .neq('user_id', currentUserId)
            .order('created_at', { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [], error: null }),
      entryIds.length
        ? supabase
            .from('entry_comments')
            .select('entry_id, user_id, created_at')
            .in('entry_id', entryIds)
            .neq('user_id', currentUserId)
            .order('created_at', { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('follows')
        .select('follower_id, created_at')
        .eq('following_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('group_invitations')
        .select('id, group_id, inviter_id, created_at')
        .eq('invitee_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    if (likesResponse.error || commentsResponse.error || followsResponse.error || invitesResponse.error) {
      console.error(
        'Error loading notifications',
        likesResponse.error ?? commentsResponse.error ?? followsResponse.error ?? invitesResponse.error
      );
      setError(t('notifications.loading'));
      setLoading(false);
      return;
    }

    const likesByEntry = new Map<string, { likerIds: string[]; createdAt: string | null }>();
    const likerSet = new Set<string>();
    (likesResponse.data ?? []).forEach((row) => {
      const typed = row as { entry_id: string; user_id: string; created_at: string | null };
      if (!typed.entry_id || !typed.user_id) return;
      if (typed.user_id === currentUserId) return;
      likerSet.add(typed.user_id);
      const existing = likesByEntry.get(typed.entry_id);
      if (!existing) {
        likesByEntry.set(typed.entry_id, { likerIds: [typed.user_id], createdAt: typed.created_at ?? null });
        return;
      }
      if (!existing.likerIds.includes(typed.user_id)) {
        existing.likerIds.push(typed.user_id);
      }
      if (typed.created_at && (!existing.createdAt || typed.created_at > existing.createdAt)) {
        existing.createdAt = typed.created_at;
      }
    });

    const commentsByEntry = new Map<string, { commenterIds: string[]; createdAt: string | null }>();
    const commenterSet = new Set<string>();
    (commentsResponse.data ?? []).forEach((row) => {
      const typed = row as { entry_id: string; user_id: string; created_at: string | null };
      if (!typed.entry_id || !typed.user_id) return;
      if (typed.user_id === currentUserId) return;
      commenterSet.add(typed.user_id);
      const existing = commentsByEntry.get(typed.entry_id);
      if (!existing) {
        commentsByEntry.set(typed.entry_id, { commenterIds: [typed.user_id], createdAt: typed.created_at ?? null });
        return;
      }
      if (!existing.commenterIds.includes(typed.user_id)) {
        existing.commenterIds.push(typed.user_id);
      }
      if (typed.created_at && (!existing.createdAt || typed.created_at > existing.createdAt)) {
        existing.createdAt = typed.created_at;
      }
    });

    const followRows = (followsResponse.data ?? []) as { follower_id: string; created_at: string | null }[];
    const followerIds = followRows.map((row) => row.follower_id);
    const inviteRows = (invitesResponse.data ?? []) as { id: string; inviter_id: string; group_id: string; created_at: string | null }[];
    const inviterIds = inviteRows.map((row) => row.inviter_id);
    const groupIds = inviteRows.map((row) => row.group_id);

    const userIds = Array.from(new Set([...likerSet, ...commenterSet, ...followerIds, ...inviterIds].filter(Boolean)));

    const [profilesResponse, groupsResponse] = await Promise.all([
      userIds.length
        ? supabase.from('profiles').select('id, username, display_name').in('id', userIds)
        : Promise.resolve({ data: [], error: null }),
      groupIds.length
        ? supabase.from('groups').select('id, name').in('id', groupIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (profilesResponse.error || groupsResponse.error) {
      console.error('Error loading notification context', profilesResponse.error ?? groupsResponse.error);
    }

    const nextProfileMap: Record<string, ProfileRow> = {};
    (profilesResponse.data ?? []).forEach((row) => {
      const typed = row as ProfileRow;
      nextProfileMap[typed.id] = typed;
    });
    setProfileMap(nextProfileMap);

    const nextGroupMap: Record<string, string | null> = {};
    (groupsResponse.data ?? []).forEach((row) => {
      const typed = row as { id: string; name: string | null };
      nextGroupMap[typed.id] = typed.name ?? null;
    });
    setGroupMap(nextGroupMap);

    const likeItems: NotificationItem[] = Array.from(likesByEntry.entries()).map(([entryId, data]) => ({
      id: `like-${entryId}`,
      type: 'like',
      entryId,
      likerIds: data.likerIds,
      createdAt: data.createdAt,
    }));

    const commentItems: NotificationItem[] = Array.from(commentsByEntry.entries()).map(([entryId, data]) => ({
      id: `comment-${entryId}`,
      type: 'comment',
      entryId,
      commenterIds: data.commenterIds,
      createdAt: data.createdAt,
    }));

    const followItems: NotificationItem[] = followRows.map((row) => ({
      id: `follow-${row.follower_id}`,
      type: 'follow',
      userId: row.follower_id,
      createdAt: row.created_at ?? null,
    }));

    const inviteItems: NotificationItem[] = inviteRows.map((row) => ({
      id: `invite-${row.id}`,
      type: 'invite',
      inviteId: row.id,
      inviterId: row.inviter_id,
      groupId: row.group_id,
      createdAt: row.created_at ?? null,
    }));

    const combined = [...likeItems, ...commentItems, ...followItems, ...inviteItems].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    setItems(combined);
    const latest = combined.reduce<string | null>((acc, item) => {
      if (!item.createdAt) return acc;
      if (!acc || item.createdAt > acc) return item.createdAt;
      return acc;
    }, null);
    onLatestChange?.(latest);
    setLoading(false);
  }, [currentUserId, onLatestChange]);

  useEffect(() => {
    if (!open) return;
    startTransition(() => {
      void loadNotifications();
    });
  }, [loadNotifications, open]);

  useEffect(() => {
    startTransition(() => {
      void loadNotifications();
    });
  }, [loadNotifications]);

  useEffect(() => {
    onCountChange?.(items.length);
  }, [items.length, onCountChange]);

  const formatHandle = useCallback((userId: string) => {
    const profile = profileMap[userId];
    return profile?.username ?? profile?.display_name ?? 'usuario';
  }, [profileMap]);

  const notifications = useMemo(() => items.slice(0, 50), [items]);

  if (!open) return null;

  return (
    <div className="bw-notify-backdrop" onClick={onClose}>
      <aside className="bw-notify-drawer" role="dialog" aria-modal="true" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="bw-notify-header">
          <div className="bw-notify-title">
            <Notifications fontSize="small" />
            {t('notifications.title')}
          </div>
          <button type="button" className="bw-icon-button" onClick={onClose} aria-label={t('common.close')}>
            ✕
          </button>
        </div>

        <div className="bw-notify-body">
          {loading && <p className="bw-helper">{t('notifications.loading')}</p>}
          {error && <p className="bw-helper" style={{ color: 'red' }}>{error}</p>}
          {!loading && !error && notifications.length === 0 && (
            <p className="bw-helper">{t('notifications.noNotifications')}</p>
          )}

          {!loading && !error && notifications.length > 0 && (
            <div className="bw-notify-list">
              {notifications.map((item) => {
                if (item.type === 'like') {
                  const total = item.likerIds.length;
                  const firstId = item.likerIds[0];
                  const firstName = formatHandle(firstId);
                  const restCount = Math.max(0, total - 1);
                  let message = '';
                  if (total === 1) {
                    message = t('notifications.likedSingle', { name: firstName });
                  } else if (total <= 5) {
                    message = t('notifications.likedPlural', { name: firstName, count: restCount });
                  } else {
                    message = t('notifications.likedMany', { name: firstName });
                  }
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="bw-notify-item"
                      onClick={() => {
                        onOpenEntry(item.entryId);
                        onClose();
                      }}
                    >
                      <span className="bw-notify-icon bw-notify-like">
                        <Favorite fontSize="small" />
                      </span>
                      <span className="bw-notify-text">{message}</span>
                    </button>
                  );
                }
                if (item.type === 'comment') {
                  const total = item.commenterIds.length;
                  const firstId = item.commenterIds[0];
                  const firstName = formatHandle(firstId);
                  const restCount = Math.max(0, total - 1);
                  let message = '';
                  if (total === 1) {
                    message = t('notifications.commentedSingle', { name: firstName });
                  } else if (total <= 5) {
                    message = t('notifications.commentedPlural', { name: firstName, count: restCount });
                  } else {
                    message = t('notifications.commentedMany', { name: firstName });
                  }
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="bw-notify-item"
                      onClick={() => {
                        onOpenEntry(item.entryId);
                        onClose();
                      }}
                    >
                      <span className="bw-notify-icon bw-notify-comment">
                        <ChatBubbleOutline fontSize="small" />
                      </span>
                      <span className="bw-notify-text">{message}</span>
                    </button>
                  );
                }
                if (item.type === 'follow') {
                  const name = formatHandle(item.userId);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="bw-notify-item"
                      onClick={() => {
                        onOpenProfile(item.userId);
                        onClose();
                      }}
                    >
                      <span className="bw-notify-icon bw-notify-follow">
                        <PersonAdd fontSize="small" />
                      </span>
                      <span className="bw-notify-text">{t('notifications.followed', { name })}</span>
                    </button>
                  );
                }
                const inviterName = formatHandle(item.inviterId);
                const groupName = groupMap[item.groupId] ?? t('notifications.yourGroup');
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="bw-notify-item"
                    onClick={() => {
                      onOpenInvites();
                      onClose();
                    }}
                  >
                    <span className="bw-notify-icon bw-notify-invite">
                      <GroupAdd fontSize="small" />
                    </span>
                    <span className="bw-notify-text">
                      {t('notifications.invited', { inviter: inviterName, group: groupName })}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
