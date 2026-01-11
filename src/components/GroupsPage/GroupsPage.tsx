import { useCallback, useEffect, useRef, useState } from 'react';
import { Add, CheckCircle, ChevronRight, Close, Delete, PeopleOutline, RadioButtonUnchecked, Settings } from '@mui/icons-material';
import type { Session } from '@supabase/supabase-js';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { lockBodyScroll } from '../../utils/scrollLock';
import { useRevalidateOnFocus } from '../../utils/useRevalidateOnFocus';
import '../../styles/layout.css';
import '../../styles/shared.css';
import '../FollowListModal/FollowListModal.css';
import './GroupsPage.css';

type GroupsPageProps = {
  session: Session;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onNavigate: (page: 'dashboard' | 'feed' | 'profile' | 'groups') => void;
};

type GroupCard = {
  id: string;
  name: string;
  members: number;
  membersPreview: Array<{ id: string; initial: string; avatarUrl: string | null }>;
  isOwner: boolean;
};

type GroupInvite = {
  id: string;
  groupId: string;
  groupName: string | null;
  inviterId: string;
  inviterUsername: string | null;
  inviterDisplayName: string | null;
};

const readSessionCache = <T,>(key: string) => {
  try {
    const cached = sessionStorage.getItem(key);
    if (!cached) return { value: null as T | null, hasCache: false };
    return { value: JSON.parse(cached) as T, hasCache: true };
  } catch {
    return { value: null as T | null, hasCache: false };
  }
};

const MAX_GROUPS = 6;

const isGroupLimitError = (message?: string | null) => {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes('maximo') || lower.includes('limite');
};

export function GroupsPage({ session }: Readonly<GroupsPageProps>) {
  const groupsCacheKey = `bw-groups-v2-${session.user.id}`;
  const invitesCacheKey = `bw-group-invites-${session.user.id}`;
  const groupsCache = readSessionCache<GroupCard[]>(groupsCacheKey);
  const invitesCache = readSessionCache<GroupInvite[]>(invitesCacheKey);
  const initialGroups = groupsCache.value ?? [];
  const initialOwnedGroupIds = initialGroups.filter((group) => group.isOwner).map((group) => group.id);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [groups, setGroups] = useState<GroupCard[]>(() => initialGroups);
  const [ownedGroupIds, setOwnedGroupIds] = useState<string[]>(() => initialOwnedGroupIds);
  const [loadingGroups, setLoadingGroups] = useState(() => !groupsCache.hasCache);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [invites, setInvites] = useState<GroupInvite[]>(() => invitesCache.value ?? []);
  const [loadingInvites, setLoadingInvites] = useState(() => !invitesCache.hasCache);
  const [invitesError, setInvitesError] = useState<string | null>(null);
  const [isInvitesOpen, setIsInvitesOpen] = useState(false);
  const [manageGroupId, setManageGroupId] = useState<string | null>(null);
  const [manageGroupName, setManageGroupName] = useState<string | null>(null);
  const hasGroupsCache = groupsCache.hasCache;
  const hasInvitesCache = invitesCache.hasCache;
  const lastRealtimeRef = useRef(0);
  const groupCount = groups.length;
  const hasGroupLimit = groupCount >= MAX_GROUPS;

  const loadGroups = useCallback(async (options?: { showLoading?: boolean; skipCache?: boolean }) => {
    const showLoading = options?.showLoading ?? true;
    if (showLoading) setLoadingGroups(true);
    setGroupsError(null);

    const [{ data: ownedGroups, error: ownedError }, { data: memberRows, error: memberError }] = await Promise.all([
      supabase.from('groups').select('id, name').eq('owner_id', session.user.id),
      supabase.from('group_members').select('group_id').eq('user_id', session.user.id),
    ]);

    if (ownedError || memberError) {
      setGroupsError('No se pudieron cargar los grupos.');
      setLoadingGroups(false);
      return;
    }

    const ownedIds = (ownedGroups ?? []).map((row) => (row as { id: string }).id);
    const memberGroupIds = (memberRows ?? []).map((row) => (row as { group_id: string }).group_id);
    const groupIds = Array.from(new Set([...ownedIds, ...memberGroupIds]));
    setOwnedGroupIds(ownedIds);

    if (!groupIds.length) {
      setGroups([]);
      setLoadingGroups(false);
      if (!options?.skipCache) {
        try {
          sessionStorage.setItem(groupsCacheKey, JSON.stringify([]));
        } catch {
          // Ignore cache write errors (private mode, quota, etc.).
        }
      }
      return;
    }

    const { data: groupsData, error: groupsError } = await supabase
      .from('groups')
      .select('id, name, owner_id')
      .in('id', groupIds);

    if (groupsError) {
      setGroupsError('No se pudieron cargar los grupos.');
      setLoadingGroups(false);
      return;
    }

    const { data: allMembers, error: membersError } = await supabase
      .from('group_members')
      .select('group_id, user_id')
      .in('group_id', groupIds);

    if (membersError) {
      setGroupsError('No se pudieron cargar los grupos.');
      setLoadingGroups(false);
      return;
    }

    const memberMap = new Map<string, Set<string>>();
    (allMembers ?? []).forEach((row) => {
      const groupId = (row as { group_id: string }).group_id;
      const userId = (row as { user_id: string }).user_id;
      if (!memberMap.has(groupId)) {
        memberMap.set(groupId, new Set());
      }
      memberMap.get(groupId)?.add(userId);
    });

    const profileMap = new Map<
      string,
      { username: string | null; displayName: string | null; avatarUrl: string | null }
    >();
    const memberUserIds = Array.from(
      new Set((allMembers ?? []).map((row) => (row as { user_id: string }).user_id))
    );

    if (memberUserIds.length) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', memberUserIds);

      if (profilesError) {
        setGroupsError('No se pudieron cargar los grupos.');
        setLoadingGroups(false);
        return;
      }

      (profiles ?? []).forEach((profile) => {
        profileMap.set((profile as { id: string }).id, {
          username: (profile as { username: string | null }).username,
          displayName: (profile as { display_name: string | null }).display_name,
          avatarUrl: (profile as { avatar_url: string | null }).avatar_url,
        });
      });
    }

    const mappedGroups = (groupsData ?? []).map((group) => {
      const id = (group as { id: string }).id;
      const name = (group as { name: string }).name;
      const ownerId = (group as { owner_id: string }).owner_id;
      const members = memberMap.get(id) ?? new Set();
      const membersPreview = Array.from(members)
        .slice(0, 4)
        .map((userId) => {
          const profile = profileMap.get(userId);
          const base = profile?.username ?? profile?.displayName ?? '?';
          return {
            id: userId,
            initial: base.charAt(0).toUpperCase(),
            avatarUrl: profile?.avatarUrl ?? null,
          };
        });

      return {
        id,
        name,
        members: members.size,
        membersPreview,
        isOwner: ownerId === session.user.id,
      };
    });

    setOwnedGroupIds(
      (groupsData ?? [])
        .filter((group) => (group as { owner_id: string }).owner_id === session.user.id)
        .map((group) => (group as { id: string }).id)
    );
    setGroups(mappedGroups);
    setLoadingGroups(false);
    if (!options?.skipCache) {
      try {
        sessionStorage.setItem(groupsCacheKey, JSON.stringify(mappedGroups));
      } catch {
        // Ignore cache write errors (private mode, quota, etc.).
      }
    }
  }, [groupsCacheKey, session.user.id]);

  useEffect(() => {
    if (refreshKey === 0 && hasGroupsCache) return;
    const timeoutId = window.setTimeout(() => {
      loadGroups();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [hasGroupsCache, loadGroups, refreshKey]);

  const loadInvites = useCallback(async (options?: { showLoading?: boolean; skipCache?: boolean }) => {
    const showLoading = options?.showLoading ?? true;
    if (showLoading) setLoadingInvites(true);
    setInvitesError(null);

    const { data: inviteRows, error: inviteError } = await supabase
      .from('group_invitations')
      .select('id, group_id, inviter_id')
      .eq('invitee_id', session.user.id);

    if (inviteError) {
      setInvitesError('No se pudieron cargar las invitaciones.');
      setLoadingInvites(false);
      return;
    }

    const baseInvites = (inviteRows ?? []) as { id: string; group_id: string; inviter_id: string }[];

    if (!baseInvites.length) {
      setInvites([]);
      setLoadingInvites(false);
      if (!options?.skipCache) {
        try {
          sessionStorage.setItem(invitesCacheKey, JSON.stringify([]));
        } catch {
          // Ignore cache write errors (private mode, quota, etc.).
        }
      }
      return;
    }

    const groupIds = Array.from(new Set(baseInvites.map((row) => row.group_id)));
    const inviterIds = Array.from(new Set(baseInvites.map((row) => row.inviter_id)));

    const [{ data: groupsData, error: groupsError }, { data: profilesData, error: profilesError }] = await Promise.all([
      supabase.from('groups').select('id, name').in('id', groupIds),
      supabase.from('profiles').select('id, username, display_name').in('id', inviterIds),
    ]);

    if (groupsError || profilesError) {
      setInvitesError('No se pudieron cargar las invitaciones.');
      setLoadingInvites(false);
      return;
    }

    const groupMap = new Map<string, string>();
    (groupsData ?? []).forEach((group) => {
      groupMap.set((group as { id: string }).id, (group as { name: string }).name);
    });

    const inviterMap = new Map<string, { username: string | null; displayName: string | null }>();
    (profilesData ?? []).forEach((profile) => {
      inviterMap.set((profile as { id: string }).id, {
        username: (profile as { username: string | null }).username,
        displayName: (profile as { display_name: string | null }).display_name,
      });
    });

    const mapped = baseInvites.map((row) => {
      const inviter = inviterMap.get(row.inviter_id);
      return {
        id: row.id,
        groupId: row.group_id,
        groupName: groupMap.get(row.group_id) ?? null,
        inviterId: row.inviter_id,
        inviterUsername: inviter?.username ?? null,
        inviterDisplayName: inviter?.displayName ?? null,
      };
    });

    setInvites(mapped);
    setLoadingInvites(false);
    if (!options?.skipCache) {
      try {
        sessionStorage.setItem(invitesCacheKey, JSON.stringify(mapped));
      } catch {
        // Ignore cache write errors (private mode, quota, etc.).
      }
    }
  }, [invitesCacheKey, session.user.id]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadInvites({ showLoading: !hasInvitesCache });
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [hasInvitesCache, loadInvites, refreshKey]);

  useRevalidateOnFocus(
    () => {
      loadGroups({ showLoading: false, skipCache: true });
      loadInvites({ showLoading: false, skipCache: true });
    },
    [loadGroups, loadInvites],
    { minIntervalMs: 180000, maxStaleMs: 900000, debounceMs: 500 }
  );

  useEffect(() => {
    const shouldSkip = () => {
      if (document.visibilityState !== 'visible') return true;
      const now = Date.now();
      if (now - lastRealtimeRef.current < 60000) return true;
      lastRealtimeRef.current = now;
      return false;
    };
    const channel = supabase
      .channel(`groups-rt-${session.user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_invitations', filter: `invitee_id=eq.${session.user.id}` },
        () => {
          if (shouldSkip()) return;
          loadInvites({ showLoading: false, skipCache: true });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_members', filter: `user_id=eq.${session.user.id}` },
        () => {
          if (shouldSkip()) return;
          loadGroups({ showLoading: false, skipCache: true });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_members' },
        (payload) => {
          if (shouldSkip()) return;
          if (!ownedGroupIds.length) return;
          const row = (payload.new ?? payload.old) as { group_id?: string } | null;
          const groupId = row?.group_id;
          if (!groupId) return;
          if (!ownedGroupIds.includes(groupId)) return;
          loadGroups({ showLoading: false, skipCache: true });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'groups', filter: `owner_id=eq.${session.user.id}` },
        () => {
          if (shouldSkip()) return;
          loadGroups({ showLoading: false, skipCache: true });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadGroups, loadInvites, ownedGroupIds, session.user.id]);

  return (
    <div className="bw-app-root">
      <div className="bw-shell">
        <header className="bw-header">
          <div className="bw-header-icon">
            <img src="/logo.png" alt="Burger Wrapped" />
          </div>
          <div style={{ flex: 1 }}>
            <h1 className="bw-title">Grupos</h1>
            <p className="bw-subtitle">Rankings y estadisticas con tus amigos.</p>
          </div>

        </header>

        <main className="bw-main">
          {invites.length > 0 && (
            <button
              type="button"
              className="bw-group-invites-button"
              onClick={() => setIsInvitesOpen(true)}
            >
              Invitaciones a grupos ({invites.length})
            </button>
          )}
          <section className="bw-group-list">
            {loadingGroups && <p className="bw-helper">Cargando grupos...</p>}
            {groupsError && <p className="bw-helper" style={{ color: 'red' }}>{groupsError}</p>}
            {!loadingGroups && !groupsError && groups.length === 0 && (
              <p className="bw-helper">Aun no tienes grupos. Crea el primero.</p>
            )}
            {!loadingGroups && hasGroupLimit && (
              <p className="bw-helper">Has alcanzado el maximo de 6 grupos.</p>
            )}
            {groups.map((group) => (
              <Link
                key={group.id}
                to={`/groups/${group.id}`}
                className="bw-group-card"
                aria-label={`Ver grupo ${group.name}`}
              >
                <div className="bw-group-card-body">
                  <div className="bw-group-title">{group.name}</div>
                  <div className="bw-group-meta">
                    <PeopleOutline fontSize="small" />
                    <span>{group.members === 1 ? 'Por ahora estas solo' : `${group.members} miembros`}</span>
                  </div>
                  <div className="bw-group-avatars">
                    {group.membersPreview.map((member) => (
                      <div key={`${group.id}-${member.id}`} className="bw-group-avatar">
                        {member.avatarUrl ? (
                          <img src={member.avatarUrl} alt={member.initial} />
                        ) : (
                          member.initial
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bw-group-card-actions">
                  {group.isOwner && (
                    <button
                      type="button"
                      className="bw-group-settings"
                      aria-label="Configurar grupo"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setManageGroupId(group.id);
                        setManageGroupName(group.name);
                      }}
                    >
                      <Settings fontSize="small" />
                    </button>
                  )}
                  <ChevronRight className="bw-group-chevron" />
                </div>
              </Link>
            ))}

            <button
              type="button"
              className="bw-group-card bw-group-card-add"
              aria-label="Crear grupo"
              onClick={() => {
                if (hasGroupLimit) return;
                setIsCreateOpen(true);
              }}
              disabled={hasGroupLimit}
            >
              <Add fontSize="large" />
            </button>
          </section>
        </main>
      </div>

      {isCreateOpen && (
        <CreateGroupModal
          currentUserId={session.user.id}
          currentGroupCount={groupCount}
          maxGroups={MAX_GROUPS}
          onClose={() => setIsCreateOpen(false)}
          onCreated={() => {
            setIsCreateOpen(false);
            setRefreshKey((prev) => prev + 1);
          }}
        />
      )}
      {isInvitesOpen && (
        <GroupInvitesModal
          currentUserId={session.user.id}
          currentGroupCount={groupCount}
          maxGroups={MAX_GROUPS}
          invites={invites}
          loading={loadingInvites}
          error={invitesError}
          onClose={() => setIsInvitesOpen(false)}
          onChanged={() => setRefreshKey((prev) => prev + 1)}
        />
      )}
      {manageGroupId && (
        <GroupManageModal
          currentUserId={session.user.id}
          groupId={manageGroupId}
          groupName={manageGroupName}
          onClose={() => {
            setManageGroupId(null);
            setManageGroupName(null);
          }}
          onChanged={() => setRefreshKey((prev) => prev + 1)}
        />
      )}
    </div>
  );
}

type FriendItem = {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

type CreateGroupModalProps = {
  currentUserId: string;
  currentGroupCount: number;
  maxGroups: number;
  onClose: () => void;
  onCreated: () => void;
};

type GroupMemberItem = {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  isOwner: boolean;
};

type GroupManageModalProps = {
  currentUserId: string;
  groupId: string;
  groupName: string | null;
  onClose: () => void;
  onChanged: () => void;
};

function GroupManageModal({
  currentUserId,
  groupId,
  groupName,
  onClose,
  onChanged,
}: Readonly<GroupManageModalProps>) {
  const [members, setMembers] = useState<GroupMemberItem[]>([]);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [groupTitle, setGroupTitle] = useState(groupName ?? '');
  const [initialGroupTitle, setInitialGroupTitle] = useState(groupName ?? '');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => lockBodyScroll(), []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);

      const { data: groupRow, error: groupError } = await supabase
        .from('groups')
        .select('id, owner_id')
        .eq('id', groupId)
        .single();

      if (cancelled) return;

      if (groupError || !groupRow) {
        setError('No se pudo cargar el grupo.');
        setLoading(false);
        return;
      }

      const ownerId = (groupRow as { owner_id: string; name?: string | null }).owner_id;
      const name = (groupRow as { name?: string | null }).name ?? groupName ?? '';
      setGroupTitle(name);
      setInitialGroupTitle(name);

      const { data: memberRows, error: membersError } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId);

      if (cancelled) return;

      if (membersError) {
        setError('No se pudieron cargar los miembros.');
        setLoading(false);
        return;
      }

      const memberIds = new Set<string>();
      memberIds.add(ownerId);
      (memberRows ?? []).forEach((row) => memberIds.add((row as { user_id: string }).user_id));

      const memberIdList = Array.from(memberIds);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', memberIdList);

      if (cancelled) return;

      if (profilesError) {
        setError('No se pudieron cargar los miembros.');
        setLoading(false);
        return;
      }

      const mappedMembers = (profilesData ?? []).map((profile) => {
        const id = (profile as { id: string }).id;
        return {
          id,
          username: (profile as { username: string | null }).username,
          displayName: (profile as { display_name: string | null }).display_name,
          avatarUrl: (profile as { avatar_url: string | null }).avatar_url,
          isOwner: id === ownerId,
        };
      });
      setMembers(mappedMembers);

      const [{ data: outgoing }, { data: incoming }] = await Promise.all([
        supabase.from('follows').select('following_id').eq('follower_id', currentUserId),
        supabase.from('follows').select('follower_id').eq('following_id', currentUserId),
      ]);

      if (cancelled) return;

      const outgoingIds = new Set((outgoing ?? []).map((row) => (row as { following_id: string }).following_id));
      const incomingIds = new Set((incoming ?? []).map((row) => (row as { follower_id: string }).follower_id));
      const mutualIds = Array.from(outgoingIds).filter((id) => incomingIds.has(id));
      const inviteCandidates = mutualIds.filter((id) => !memberIds.has(id));

      if (!inviteCandidates.length) {
        setFriends([]);
        setLoading(false);
        return;
      }

      const { data: friendsData, error: friendsError } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', inviteCandidates);

      if (cancelled) return;

      if (friendsError) {
        setError('No se pudieron cargar los amigos.');
        setLoading(false);
        return;
      }

      const mappedFriends = (friendsData ?? []).map((profile) => ({
        id: (profile as { id: string }).id,
        username: (profile as { username: string | null }).username,
        displayName: (profile as { display_name: string | null }).display_name,
        avatarUrl: (profile as { avatar_url: string | null }).avatar_url,
      }));
      setFriends(mappedFriends);
      setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, groupId, groupName]);

  const handleRename = async () => {
    const nextName = groupTitle.trim();
    if (!nextName || saving) return;
    if (nextName === initialGroupTitle.trim()) return;
    setSaving(true);
    const { error: renameError } = await supabase
      .from('groups')
      .update({ name: nextName })
      .eq('id', groupId)
      .eq('owner_id', currentUserId);
    if (renameError) {
      setError('No se pudo cambiar el nombre del grupo.');
      setSaving(false);
      return;
    }
    setInitialGroupTitle(nextName);
    setSaving(false);
    onChanged();
  };

  const term = searchTerm.trim().toLowerCase();
  const filteredFriends = term
    ? friends.filter((friend) => {
        const u = (friend.username ?? '').toLowerCase();
        const d = (friend.displayName ?? '').toLowerCase();
        return u.includes(term) || d.includes(term);
      })
    : friends;

  const toggleSelected = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleInvite = async () => {
    if (!selectedIds.size || saving) return;
    setSaving(true);
    const payload = Array.from(selectedIds).map((userId) => ({
      group_id: groupId,
      inviter_id: currentUserId,
      invitee_id: userId,
    }));

    const { error: inviteError } = await supabase
      .from('group_invitations')
      .insert(payload);

    if (inviteError) {
      if (isGroupLimitError(inviteError.message)) {
        setError('Alguno de los usuarios ya tiene el maximo de 6 grupos.');
      } else {
        setError('No se pudieron enviar las invitaciones.');
      }
      setSaving(false);
      return;
    }

    setSelectedIds(new Set());
    setSaving(false);
    onChanged();
    window.dispatchEvent(new Event('bw-invites-updated'));
  };

  const handleDeleteGroup = async () => {
    if (saving) return;
    setSaving(true);
    const { error: deleteError } = await supabase
      .from('groups')
      .delete()
      .eq('id', groupId)
      .eq('owner_id', currentUserId);
    if (deleteError) {
      setError('No se pudo eliminar el grupo.');
      setSaving(false);
      return;
    }
    setSaving(false);
    setConfirmDelete(false);
    onChanged();
    onClose();
  };

  const handleRemoveMember = async (member: GroupMemberItem) => {
    if (saving || member.isOwner) return;
    const confirmRemove = window.confirm(`¿Eliminar a @${member.username ?? 'usuario'} del grupo?`);
    if (!confirmRemove) return;
    setSaving(true);
    const { error: removeError } = await supabase
      .from('group_members')
      .delete()
      .match({ group_id: groupId, user_id: member.id });
    if (removeError) {
      setError('No se pudo expulsar al miembro.');
      setSaving(false);
      return;
    }
    setMembers((prev) => prev.filter((row) => row.id !== member.id));
    setSaving(false);
    onChanged();
  };

  return (
    <div className="bw-modal-backdrop" onClick={onClose}>
      <div className="bw-modal bw-group-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bw-modal-header">
          <div>
            <h2 className="bw-modal-title">Configurar grupo</h2>
            <p className="bw-modal-subtitle">{groupName ?? 'Grupo'}</p>
          </div>
          <div className="bw-modal-header-actions">
            <button
              type="button"
              className="bw-icon-button bw-icon-danger"
              onClick={() => setConfirmDelete(true)}
              aria-label="Eliminar grupo"
            >
              <Delete fontSize="small" />
            </button>
            <button type="button" className="bw-icon-button" onClick={onClose} aria-label="Cerrar">
              <Close fontSize="small" />
            </button>
          </div>
        </div>

        <div className="bw-group-modal-body">
          {loading && <p className="bw-helper">Cargando...</p>}
          {error && <p className="bw-helper" style={{ color: 'red' }}>{error}</p>}

          {!loading && (
            <>
              <div className="bw-group-section">
                <div className="bw-group-section-title">Nombre del grupo</div>
                <div className="bw-group-rename">
                  <input
                    className="bw-input"
                    value={groupTitle}
                    onChange={(e) => setGroupTitle(e.target.value)}
                    placeholder="Nombre del grupo"
                  />
                  <button
                    type="button"
                    className="bw-btn bw-btn-primary"
                    onClick={handleRename}
                    disabled={saving || !groupTitle.trim() || groupTitle.trim() === initialGroupTitle.trim()}
                  >
                    Guardar
                  </button>
                </div>
              </div>
              <div className="bw-group-section">
                <div className="bw-group-section-title">Miembros</div>
                <div className="bw-group-members">
                  {members.map((member) => {
                    const name = member.displayName ?? member.username ?? 'Usuario';
                    return (
                      <div key={member.id} className="bw-group-member-row">
                        <div className="bw-group-member-info">
                          <div className="bw-avatar bw-avatar-sm">
                            {member.avatarUrl ? (
                              <img src={member.avatarUrl} alt={name} className="bw-avatar-image" />
                            ) : (
                              <div className="bw-avatar-placeholder">
                                {(member.username ?? '?').charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="bw-user-name">@{member.username ?? 'usuario'}</div>
                            <div className="bw-user-meta">{name}</div>
                          </div>
                        </div>
                        {member.isOwner ? (
                          <span className="bw-group-owner">Admin</span>
                        ) : (
                          <button
                            type="button"
                            className="bw-group-remove"
                            onClick={() => handleRemoveMember(member)}
                            disabled={saving}
                          >
                            Expulsar
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {!members.length && <p className="bw-helper">No hay miembros.</p>}
                </div>
              </div>

              <div className="bw-group-section">
                <div className="bw-group-section-title">Invitar amigos</div>
                <div className="bw-group-search">
                  <input
                    type="search"
                    className="bw-input"
                    placeholder="Buscar por nombre o username..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {!friends.length && <p className="bw-helper">No tienes amigos para invitar.</p>}
                {friends.length > 0 && (
                  <div className="bw-group-friends">
                    {filteredFriends.map((friend) => {
                      const isSelected = selectedIds.has(friend.id);
                      const displayName = friend.displayName ?? friend.username ?? 'Usuario';
                      return (
                        <button
                          key={friend.id}
                          type="button"
                          className="bw-user-card bw-group-friend-card"
                          onClick={() => toggleSelected(friend.id)}
                        >
                          <div className="bw-user-info">
                            <div className="bw-avatar bw-avatar-sm">
                              {friend.avatarUrl ? (
                                <img src={friend.avatarUrl} alt={displayName} className="bw-avatar-image" />
                              ) : (
                                <div className="bw-avatar-placeholder">
                                  {(friend.username ?? '?').charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="bw-user-name">@{friend.username ?? 'usuario'}</div>
                              <div className="bw-user-meta">{displayName}</div>
                            </div>
                          </div>
                          <span className={`bw-group-check ${isSelected ? 'is-selected' : ''}`} aria-hidden="true">
                            {isSelected ? <CheckCircle fontSize="small" /> : <RadioButtonUnchecked fontSize="small" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="bw-group-modal-actions bw-group-modal-actions-sticky">
                  <button
                    type="button"
                    className="bw-fab bw-group-create-button"
                    disabled={selectedIds.size === 0 || saving}
                    onClick={handleInvite}
                  >
                    {saving ? 'Enviando...' : 'Invitar'}
                  </button>
                </div>
              </div>

            </>
          )}
        </div>
      </div>

      {confirmDelete && (
        <div className="bw-confirm-backdrop" onClick={() => setConfirmDelete(false)}>
          <div className="bw-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="bw-confirm-title">¿Estas seguro que quieres eliminar el grupo?</h3>
            <p className="bw-confirm-text">Esta accion no se puede deshacer.</p>
            <div className="bw-confirm-actions">
              <button
                className="bw-btn bw-btn-ghost"
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                className="bw-btn bw-btn-primary"
                type="button"
                onClick={handleDeleteGroup}
                disabled={saving}
              >
                {saving ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateGroupModal({
  currentUserId,
  currentGroupCount,
  maxGroups,
  onClose,
  onCreated,
}: Readonly<CreateGroupModalProps>) {
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState('');
  const [saving, setSaving] = useState(false);
  const isAtLimit = currentGroupCount >= maxGroups;

  useEffect(() => lockBodyScroll(), []);

  useEffect(() => {
    let cancelled = false;

    const loadFriends = async () => {
      setLoading(true);
      setError(null);

      const [{ data: outgoing, error: outgoingError }, { data: incoming, error: incomingError }] = await Promise.all([
        supabase.from('follows').select('following_id').eq('follower_id', currentUserId),
        supabase.from('follows').select('follower_id').eq('following_id', currentUserId),
      ]);

      if (cancelled) return;

      if (outgoingError || incomingError) {
        setError('No se pudieron cargar tus amigos.');
        setLoading(false);
        return;
      }

      const outgoingIds = new Set((outgoing ?? []).map((row) => (row as { following_id: string }).following_id));
      const incomingIds = new Set((incoming ?? []).map((row) => (row as { follower_id: string }).follower_id));
      const mutualIds = Array.from(outgoingIds).filter((id) => incomingIds.has(id));

      if (!mutualIds.length) {
        setFriends([]);
        setLoading(false);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', mutualIds);

      if (cancelled) return;

      if (profilesError) {
        setError('No se pudieron cargar tus amigos.');
        setLoading(false);
        return;
      }

      const mapped = (profiles ?? []).map((profile) => ({
        id: (profile as { id: string }).id,
        username: (profile as { username: string | null }).username,
        displayName: (profile as { display_name: string | null }).display_name,
        avatarUrl: (profile as { avatar_url: string | null }).avatar_url,
      }));

      setFriends(mapped);
      setLoading(false);
    };

    loadFriends();

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  const term = searchTerm.trim().toLowerCase();
  const filteredFriends = term
    ? friends.filter((friend) => {
        const u = (friend.username ?? '').toLowerCase();
        const d = (friend.displayName ?? '').toLowerCase();
        return u.includes(term) || d.includes(term);
      })
    : friends;

  const toggleSelected = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleCreate = async () => {
    if (isAtLimit) {
      setError('No puedes crear mas de 6 grupos.');
      return;
    }
    if (saving || !groupName.trim() || selectedIds.size === 0) return;
    setSaving(true);
    setError(null);

    const { data: groupRow, error: groupError } = await supabase
      .from('groups')
      .insert({ name: groupName.trim(), owner_id: currentUserId })
      .select('id')
      .single();

    if (groupError || !groupRow) {
      if (isGroupLimitError(groupError?.message)) {
        setError('No puedes crear mas de 6 grupos.');
      } else {
        setError('No se pudo crear el grupo.');
      }
      setSaving(false);
      return;
    }

    const groupId = (groupRow as { id: string }).id;
    const invitePayload = Array.from(selectedIds)
      .filter((userId) => userId !== currentUserId)
      .map((userId) => ({
        group_id: groupId,
        inviter_id: currentUserId,
        invitee_id: userId,
      }));

    if (invitePayload.length) {
      const { error: invitesError } = await supabase
        .from('group_invitations')
        .insert(invitePayload);

      if (invitesError) {
        if (isGroupLimitError(invitesError.message)) {
          setError('Alguno de los usuarios ya tiene el maximo de 6 grupos.');
        } else {
          setError('No se pudieron enviar las invitaciones.');
        }
        setSaving(false);
        return;
      }
    }

    const { error: ownerMemberError } = await supabase
      .from('group_members')
      .insert({ group_id: groupId, user_id: currentUserId });

    if (ownerMemberError) {
      if (isGroupLimitError(ownerMemberError.message)) {
        setError('No puedes unirte a mas de 6 grupos.');
      } else {
        setError('No se pudo añadir al creador al grupo.');
      }
      setSaving(false);
      return;
    }

      setSaving(false);
      window.dispatchEvent(new Event('bw-invites-updated'));
      onCreated();
  };

  return (
    <div className="bw-modal-backdrop" onClick={onClose}>
      <div className="bw-modal bw-group-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bw-modal-header">
          <div>
            <h2 className="bw-modal-title">Crear grupo</h2>
            <p className="bw-modal-subtitle">Selecciona amigos con los que quieres formar el grupo.</p>
          </div>
          <button type="button" className="bw-icon-button" onClick={onClose} aria-label="Cerrar">
            <Close fontSize="small" />
          </button>
        </div>

        {isAtLimit && (
          <p className="bw-helper" style={{ color: 'red', marginBottom: 8 }}>
            Ya tienes el maximo de {maxGroups} grupos.
          </p>
        )}

        <div className="bw-field bw-group-name-field">
          <label className="bw-label" htmlFor="bw-group-name">Nombre del grupo</label>
          <input
            id="bw-group-name"
            className="bw-input"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Ej. Amigos del burger"
          />
        </div>

        {friends.length > 5 && (
          <div className="bw-group-search">
            <input
              type="search"
              className="bw-input"
              placeholder="Buscar por nombre de usuario..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}

        <div className="bw-group-modal-body">
          {loading && <p className="bw-helper">Cargando amigos...</p>}
          {error && <p className="bw-helper" style={{ color: 'red' }}>{error}</p>}
          {!loading && !error && !filteredFriends.length && (
            <p className="bw-helper">
              {friends.length ? 'No hay resultados.' : 'Aún no tienes amigos que te sigan y a los que sigas.'}
            </p>
          )}

          {!loading && !error && filteredFriends.length > 0 && (
            <div className="bw-group-friends">
              {filteredFriends.map((friend) => {
                const isSelected = selectedIds.has(friend.id);
                const displayName = friend.displayName ?? friend.username ?? 'Usuario';
                return (
                  <button
                    key={friend.id}
                    type="button"
                    className="bw-user-card bw-group-friend-card"
                    onClick={() => toggleSelected(friend.id)}
                  >
                    <div className="bw-user-info">
                      <div className="bw-avatar bw-avatar-sm">
                        {friend.avatarUrl ? (
                          <img src={friend.avatarUrl} alt={displayName} className="bw-avatar-image" />
                        ) : (
                          <div className="bw-avatar-placeholder">
                            {(friend.username ?? '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="bw-user-name">@{friend.username ?? 'usuario'}</div>
                        <div className="bw-user-meta">{displayName}</div>
                      </div>
                    </div>
                    <span className={`bw-group-check ${isSelected ? 'is-selected' : ''}`} aria-hidden="true">
                      {isSelected ? <CheckCircle fontSize="small" /> : <RadioButtonUnchecked fontSize="small" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="bw-group-modal-actions">
          <button
            type="button"
            className="bw-fab bw-group-create-button"
            disabled={isAtLimit || selectedIds.size === 0 || !groupName.trim() || saving}
            onClick={handleCreate}
          >
            {saving ? 'Creando...' : 'Crear grupo'}
          </button>
        </div>
      </div>
    </div>
  );
}

type GroupInvitesModalProps = {
  currentUserId: string;
  currentGroupCount: number;
  maxGroups: number;
  invites: GroupInvite[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onChanged: () => void;
};

function GroupInvitesModal({
  currentUserId,
  currentGroupCount,
  maxGroups,
  invites,
  loading,
  error,
  onClose,
  onChanged,
}: Readonly<GroupInvitesModalProps>) {
  const [confirmAction, setConfirmAction] = useState<{
    invite: GroupInvite;
    action: 'accept' | 'reject';
  } | null>(null);
  const [mutating, setMutating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const isAtLimit = currentGroupCount >= maxGroups;

  useEffect(() => lockBodyScroll(), []);

  const handleConfirm = async () => {
    if (!confirmAction) return;
    const { invite, action } = confirmAction;
    setMutating(true);
    setActionError(null);

    if (action === 'accept') {
      if (isAtLimit) {
        setActionError(`No puedes unirte a mas de ${maxGroups} grupos.`);
        setMutating(false);
        setConfirmAction(null);
        return;
      }
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({ group_id: invite.groupId, user_id: currentUserId });

      if (memberError) {
        if (isGroupLimitError(memberError.message)) {
          setActionError(`No puedes unirte a mas de ${maxGroups} grupos.`);
        }
        setMutating(false);
        return;
      }
    }

    const { error: deleteError } = await supabase
      .from('group_invitations')
      .delete()
      .eq('id', invite.id);

    if (deleteError) {
      setActionError('No se pudo actualizar la invitacion.');
      setMutating(false);
      return;
    }

    setMutating(false);
    setConfirmAction(null);
    onChanged();
    window.dispatchEvent(new Event('bw-invites-updated'));
  };

  return (
    <div className="bw-modal-backdrop" onClick={onClose}>
      <div className="bw-modal bw-group-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bw-modal-header">
          <div>
            <h2 className="bw-modal-title">
              Invitaciones a grupos{isAtLimit ? ` (no puedes unirte a mas de ${maxGroups})` : ''}
            </h2>
            <p className="bw-modal-subtitle">Gestiona las invitaciones pendientes.</p>
          </div>
          <button type="button" className="bw-icon-button" onClick={onClose} aria-label="Cerrar">
            <Close fontSize="small" />
          </button>
        </div>

        <div className="bw-group-modal-body">
          {loading && <p className="bw-helper">Cargando invitaciones...</p>}
          {error && <p className="bw-helper" style={{ color: 'red' }}>{error}</p>}
          {actionError && <p className="bw-helper" style={{ color: 'red' }}>{actionError}</p>}
          {!loading && !error && invites.length === 0 && (
            <p className="bw-helper">No tienes invitaciones pendientes.</p>
          )}

          {!loading && !error && invites.length > 0 && (
            <div className="bw-group-invites">
              {invites.map((invite) => {
                const inviterHandle = invite.inviterUsername ?? invite.inviterDisplayName ?? 'usuario';
                const groupLabel = invite.groupName ? `"${invite.groupName}"` : 'este grupo';
                return (
                  <div key={invite.id} className="bw-group-invite-card">
                    <p className="bw-group-invite-text">
                      @{inviterHandle} te ha invitado a unirte a {groupLabel}.
                    </p>
                    <div className="bw-group-invite-actions">
                      <button
                        type="button"
                        className="bw-btn bw-btn-ghost"
                        onClick={() => setConfirmAction({ invite, action: 'reject' })}
                        disabled={mutating}
                      >
                        Rechazar
                      </button>
                      <button
                        type="button"
                        className="bw-btn bw-btn-primary"
                        onClick={() => setConfirmAction({ invite, action: 'accept' })}
                        disabled={mutating || isAtLimit}
                      >
                        Aceptar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {confirmAction && (
        <div className="bw-confirm-backdrop" onClick={(e) => e.stopPropagation()}>
          <div className="bw-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="bw-confirm-title">
              {confirmAction.action === 'accept'
                ? '¿Estás seguro que quieres aceptar la invitación?'
                : '¿Estás seguro que quieres rechazar la invitación?'}
            </h3>
            <div className="bw-confirm-actions">
              <button
                className="bw-btn bw-btn-ghost"
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={mutating}
              >
                Cancelar
              </button>
              <button
                className="bw-btn bw-btn-primary"
                type="button"
                onClick={handleConfirm}
                disabled={mutating}
              >
                {mutating ? 'Procesando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
