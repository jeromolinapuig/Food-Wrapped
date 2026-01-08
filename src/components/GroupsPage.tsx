import { useCallback, useEffect, useState } from 'react';
import { Add, CheckCircle, ChevronRight, Close, PeopleOutline, RadioButtonUnchecked } from '@mui/icons-material';
import type { Session } from '@supabase/supabase-js';
import { TopMenu } from './TopMenu';
import { supabase } from '../lib/supabaseClient';
import '../styles/layout.css';
import '../styles/shared.css';
import '../styles/follow-list.css';
import '../styles/groups.css';

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

export function GroupsPage({ session, theme, onToggleTheme }: Readonly<GroupsPageProps>) {
  const groupsCacheKey = `bw-groups-${session.user.id}`;
  const invitesCacheKey = `bw-group-invites-${session.user.id}`;
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [groups, setGroups] = useState<GroupCard[]>(() => readSessionCache<GroupCard[]>(groupsCacheKey).value ?? []);
  const [ownedGroupIds, setOwnedGroupIds] = useState<string[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(() => !readSessionCache<GroupCard[]>(groupsCacheKey).hasCache);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [invites, setInvites] = useState<GroupInvite[]>(() => readSessionCache<GroupInvite[]>(invitesCacheKey).value ?? []);
  const [loadingInvites, setLoadingInvites] = useState(() => !readSessionCache<GroupInvite[]>(invitesCacheKey).hasCache);
  const [invitesError, setInvitesError] = useState<string | null>(null);
  const [isInvitesOpen, setIsInvitesOpen] = useState(false);
  const hasGroupsCache = Boolean(sessionStorage.getItem(groupsCacheKey));
  const hasInvitesCache = Boolean(sessionStorage.getItem(invitesCacheKey));

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
      .select('id, name')
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
      };
    });

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
    if (refreshKey === 0 && hasInvitesCache) return;
    const timeoutId = window.setTimeout(() => {
      loadInvites();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [hasInvitesCache, loadInvites, refreshKey]);

  useEffect(() => {
    const channel = supabase
      .channel(`groups-rt-${session.user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_invitations', filter: `invitee_id=eq.${session.user.id}` },
        () => {
          loadInvites({ showLoading: false, skipCache: true });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_members', filter: `user_id=eq.${session.user.id}` },
        () => {
          loadGroups({ showLoading: false, skipCache: true });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_members' },
        (payload) => {
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
          </div>

          <TopMenu theme={theme} onToggleTheme={onToggleTheme} />
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
              <p className="bw-helper">Aún no tienes grupos. Crea el primero.</p>
            )}
            {groups.map((group) => (
              <button key={group.id} type="button" className="bw-group-card">
                <div className="bw-group-card-body">
                  <div className="bw-group-title">{group.name}</div>
                  <div className="bw-group-meta">
                    <PeopleOutline fontSize="small" />
                    <span>{group.members === 1 ? 'Por ahora estás solo' : `${group.members} miembros`}</span>
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
                <ChevronRight className="bw-group-chevron" />
              </button>
            ))}

            <button
              type="button"
              className="bw-group-card bw-group-card-add"
              aria-label="Crear grupo"
              onClick={() => setIsCreateOpen(true)}
            >
              <Add fontSize="large" />
            </button>
          </section>
        </main>
      </div>

      {isCreateOpen && (
        <CreateGroupModal
          currentUserId={session.user.id}
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
          invites={invites}
          loading={loadingInvites}
          error={invitesError}
          onClose={() => setIsInvitesOpen(false)}
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
  onClose: () => void;
  onCreated: () => void;
};

function CreateGroupModal({ currentUserId, onClose, onCreated }: Readonly<CreateGroupModalProps>) {
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState('');
  const [saving, setSaving] = useState(false);

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
    if (saving || !groupName.trim() || selectedIds.size === 0) return;
    setSaving(true);
    setError(null);

    const { data: groupRow, error: groupError } = await supabase
      .from('groups')
      .insert({ name: groupName.trim(), owner_id: currentUserId })
      .select('id')
      .single();

    if (groupError || !groupRow) {
      setError('No se pudo crear el grupo.');
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
        setError('No se pudieron enviar las invitaciones.');
        setSaving(false);
        return;
      }
    }

    const { error: ownerMemberError } = await supabase
      .from('group_members')
      .insert({ group_id: groupId, user_id: currentUserId });

    if (ownerMemberError) {
      setError('No se pudo añadir al creador al grupo.');
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
              placeholder="Buscar por username..."
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
            disabled={selectedIds.size === 0 || !groupName.trim() || saving}
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
  invites: GroupInvite[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onChanged: () => void;
};

function GroupInvitesModal({
  currentUserId,
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

  const handleConfirm = async () => {
    if (!confirmAction) return;
    const { invite, action } = confirmAction;
    setMutating(true);

    if (action === 'accept') {
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({ group_id: invite.groupId, user_id: currentUserId });

      if (memberError) {
        setMutating(false);
        return;
      }
    }

    const { error: deleteError } = await supabase
      .from('group_invitations')
      .delete()
      .eq('id', invite.id);

    if (deleteError) {
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
            <h2 className="bw-modal-title">Invitaciones a grupos</h2>
            <p className="bw-modal-subtitle">Gestiona las invitaciones pendientes.</p>
          </div>
          <button type="button" className="bw-icon-button" onClick={onClose} aria-label="Cerrar">
            <Close fontSize="small" />
          </button>
        </div>

        <div className="bw-group-modal-body">
          {loading && <p className="bw-helper">Cargando invitaciones...</p>}
          {error && <p className="bw-helper" style={{ color: 'red' }}>{error}</p>}
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
                        disabled={mutating}
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
