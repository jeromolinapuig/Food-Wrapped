import { useCallback, useEffect, useRef, useState } from 'react';
import { Add, ChevronRight, PeopleOutline, Settings } from '@mui/icons-material';
import type { Session } from '@supabase/supabase-js';
import { Link } from 'react-router-dom';
import type { GroupCard, GroupInvite } from '../../types/groups';
import { supabase } from '../../lib/supabaseClient';
import { GroupInvitesModal } from '../GroupInvitesModal/GroupInvitesModal';
import { CreateGroupModal } from '../CreateGroupModal/CreateGroupModal';
import { GroupManageModal } from '../GroupManageModal/GroupManageModal';
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
