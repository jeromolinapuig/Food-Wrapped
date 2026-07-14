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

type DatabaseNotificationRow = {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'group_invite';
  actor_id: string | null;
  entry_id: string | null;
  group_id: string | null;
  invitation_id: string | null;
  created_at: string | null;
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

    const { data, error: notificationsError } = await supabase
      .from('notifications')
      .select('id, type, actor_id, entry_id, group_id, invitation_id, created_at')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (notificationsError) {
      console.error('Error loading notifications', notificationsError);
      setError(t('notifications.loading'));
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as DatabaseNotificationRow[];

    const likesByEntry = new Map<string, { likerIds: string[]; createdAt: string | null }>();
    const commentsByEntry = new Map<string, { commenterIds: string[]; createdAt: string | null }>();
    const actorIds = new Set<string>();
    const groupIds = new Set<string>();

    rows.forEach((row) => {
      if (row.actor_id) actorIds.add(row.actor_id);
      if (row.group_id) groupIds.add(row.group_id);
      if (row.type !== 'like' || !row.entry_id || !row.actor_id) return;
      const existing = likesByEntry.get(row.entry_id);
      if (!existing) {
        likesByEntry.set(row.entry_id, { likerIds: [row.actor_id], createdAt: row.created_at });
        return;
      }
      if (!existing.likerIds.includes(row.actor_id)) {
        existing.likerIds.push(row.actor_id);
      }
      if (row.created_at && (!existing.createdAt || row.created_at > existing.createdAt)) {
        existing.createdAt = row.created_at;
      }
    });

    rows.forEach((row) => {
      if (row.type !== 'comment' || !row.entry_id || !row.actor_id) return;
      const existing = commentsByEntry.get(row.entry_id);
      if (!existing) {
        commentsByEntry.set(row.entry_id, { commenterIds: [row.actor_id], createdAt: row.created_at });
        return;
      }
      if (!existing.commenterIds.includes(row.actor_id)) {
        existing.commenterIds.push(row.actor_id);
      }
      if (row.created_at && (!existing.createdAt || row.created_at > existing.createdAt)) {
        existing.createdAt = row.created_at;
      }
    });

    const userIds = Array.from(actorIds);

    const [profilesResponse, groupsResponse] = await Promise.all([
      userIds.length
        ? supabase.from('profiles').select('id, username, display_name').in('id', userIds)
        : Promise.resolve({ data: [], error: null }),
      groupIds.size
        ? supabase.from('groups').select('id, name').in('id', Array.from(groupIds))
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

    const followItems: NotificationItem[] = rows.filter(
      (row): row is DatabaseNotificationRow & { actor_id: string } => row.type === 'follow' && Boolean(row.actor_id)
    ).map((row) => ({
      id: row.id,
      type: 'follow',
      userId: row.actor_id,
      createdAt: row.created_at,
    }));

    const inviteItems: NotificationItem[] = rows.filter(
      (row): row is DatabaseNotificationRow & { actor_id: string; group_id: string } =>
        row.type === 'group_invite' && Boolean(row.actor_id) && Boolean(row.group_id)
    ).map((row) => ({
      id: row.id,
      type: 'invite',
      inviteId: row.invitation_id ?? row.id,
      inviterId: row.actor_id,
      groupId: row.group_id,
      createdAt: row.created_at,
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
  }, [currentUserId, onLatestChange, t]);

  useEffect(() => {
    if (!open) return;
    startTransition(() => {
      void loadNotifications();
    });
  }, [loadNotifications, open]);

  useEffect(() => {
    if (!open) return;
    const markAsRead = async () => {
      const { error: markReadError } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', currentUserId)
        .is('read_at', null);
      if (markReadError) {
        console.error('Error marking notifications as read', markReadError);
      }
    };
    void markAsRead();
  }, [currentUserId, open]);

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
