import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { RawGroupRow } from "../repos/groupRepository";
import {
  fetchGroupInvites,
  fetchGroupMembers,
  fetchGroupMemberships,
  fetchGroups,
  fetchProfiles,
} from "../repos/groupRepository";
import { useRevalidateOnFocus } from "../utils/useRevalidateOnFocus";

export type GroupCard = {
  id: string;
  name: string;
  members: number;
  membersPreview: Array<{
    id: string;
    initial: string;
    avatarUrl: string | null;
  }>;
  isOwner: boolean;
};

export type GroupInvite = {
  id: string;
  groupId: string;
  inviterId: string;
  inviterUsername: string | null;
  inviterDisplayName: string | null;
  createdAt: string | null;
};

const MAX_GROUPS = 6;

const readSessionCache = <T>(key: string) => {
  try {
    const cached = sessionStorage.getItem(key);
    if (!cached) return { value: null as T | null, hasCache: false };
    return { value: JSON.parse(cached) as T, hasCache: true };
  } catch {
    return { value: null as T | null, hasCache: false };
  }
};

export function useGroups(userId: string) {
  const groupCacheKey = `bw-groups-v2-${userId}`;
  const invitesCacheKey = `bw-group-invites-${userId}`;
  const groupCache = readSessionCache<GroupCard[]>(groupCacheKey);
  const inviteCache = readSessionCache<GroupInvite[]>(invitesCacheKey);
  const [groups, setGroups] = useState<GroupCard[]>(
    () => groupCache.value ?? []
  );
  const [invites, setInvites] = useState<GroupInvite[]>(
    () => inviteCache.value ?? []
  );
  const [loadingGroups, setLoadingGroups] = useState(
    () => !groupCache.hasCache
  );
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [loadingInvites, setLoadingInvites] = useState(
    () => !inviteCache.hasCache
  );
  const [invitesError, setInvitesError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [invitesRefreshKey, setInvitesRefreshKey] = useState(0);
  const lastRealtimeRef = useRef(0);

  const handleGroupData = (
    rawGroups: RawGroupRow[],
    memberRows: { group_id: string; user_id: string }[]
  ) => {
    void rawGroups;
    const memberMap = new Map<string, Set<string>>();
    memberRows.forEach((row) => {
      const { group_id, user_id } = row;
      if (!memberMap.has(group_id)) {
        memberMap.set(group_id, new Set());
      }
      memberMap.get(group_id)?.add(user_id);
    });

    const memberUserIds = Array.from(
      new Set(memberRows.map((row) => row.user_id))
    );
    return { memberMap, memberUserIds };
  };

  const runLoadGroups = useCallback(
    async (options?: { showLoading?: boolean; skipCache?: boolean }) => {
      const showLoading = options?.showLoading ?? true;
      if (showLoading) setLoadingGroups(true);
      setGroupsError(null);
  
      try {
        const { ownedIds, memberIds } = await fetchGroupMemberships(userId);
        const groupIds = Array.from(new Set([...ownedIds, ...memberIds]));
        if (!groupIds.length) {
          setGroups([]);
          setLoadingGroups(false);
          if (!options?.skipCache) {
            try {
              sessionStorage.setItem(groupCacheKey, JSON.stringify([]));
            } catch {
              //
            }
          }
          return;
        }

        const [groupsData, memberRows] = await Promise.all([
          fetchGroups(groupIds),
          fetchGroupMembers(groupIds),
        ]);

        const { memberMap, memberUserIds } = handleGroupData(
          groupsData,
          memberRows
        );
        const profiles = memberUserIds.length
          ? await fetchProfiles(memberUserIds)
          : [];
        const profileMap = new Map<
          string,
          {
            username: string | null;
            displayName: string | null;
            avatarUrl: string | null;
          }
        >();
        profiles.forEach((profile) => {
          profileMap.set(profile.id, {
            username: profile.username,
            displayName: profile.display_name,
            avatarUrl: profile.avatar_url,
          });
        });

        const mappedGroups = groupsData.map((group) => {
          const members = memberMap.get(group.id) ?? new Set();
          const membersPreview = Array.from(members)
            .slice(0, 4)
            .map((memberId) => {
              const profile = profileMap.get(memberId);
              const base = profile?.username ?? profile?.displayName ?? "?";
              return {
                id: memberId,
                initial: base.charAt(0).toUpperCase(),
                avatarUrl: profile?.avatarUrl ?? null,
              };
            });
          return {
            id: group.id,
            name: group.name,
            members: members.size,
            membersPreview,
            isOwner: group.owner_id === userId,
          };
        });

        setGroups(mappedGroups);
        if (!options?.skipCache) {
          try {
            sessionStorage.setItem(groupCacheKey, JSON.stringify(mappedGroups));
          } catch {
            //
          }
        }
      } catch {
        setGroupsError("No se pudieron cargar los grupos.");
      } finally {
        setLoadingGroups(false);
      }
    },
    [groupCacheKey, userId]
  );

  const runLoadInvites = useCallback(
    async (options?: { showLoading?: boolean; skipCache?: boolean }) => {
      const showLoading = options?.showLoading ?? true;
      if (showLoading) setLoadingInvites(true);
      setInvitesError(null);

      try {
        const invitesData = await fetchGroupInvites(userId);
        if (!invitesData.length) {
          setInvites([]);
          if (!options?.skipCache) {
            try {
              sessionStorage.setItem(invitesCacheKey, JSON.stringify([]));
            } catch {
              //
            }
          }
          setLoadingInvites(false);
          return;
        }

        const groupIds = Array.from(
          new Set(invitesData.map((row) => row.group_id))
        );
        const inviterIds = Array.from(
          new Set(invitesData.map((row) => row.inviter_id))
        );
        const [groupsData, profiles] = await Promise.all([
          fetchGroups(groupIds),
          inviterIds.length ? fetchProfiles(inviterIds) : [],
        ]);
        const groupMap = new Map(
          groupsData.map((group) => [group.id, group.name])
        );
        const inviterMap = new Map(
          profiles.map((profile) => [
            profile.id,
            { username: profile.username, displayName: profile.display_name },
          ])
        );

        const mapped = invitesData.map((invite) => {
          const inviter = inviterMap.get(invite.inviter_id);
          return {
            id: invite.id,
            groupId: invite.group_id,
            inviterId: invite.inviter_id,
            inviterUsername: inviter?.username ?? null,
            inviterDisplayName: inviter?.displayName ?? null,
            createdAt: invite.created_at,
            groupName: groupMap.get(invite.group_id) ?? null,
          };
        });

        setInvites(mapped);
        if (!options?.skipCache) {
          try {
            sessionStorage.setItem(invitesCacheKey, JSON.stringify(mapped));
          } catch {
            //
          }
        }
      } catch {
        setInvitesError("No se pudieron cargar las invitaciones.");
      } finally {
        setLoadingInvites(false);
      }
    },
    [invitesCacheKey, userId]
  );

  useEffect(() => {
    if (refreshKey === 0 && groupCache.hasCache) return;
    const timeout = window.setTimeout(() => {
      runLoadGroups();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [groupCache.hasCache, runLoadGroups, refreshKey]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      runLoadInvites({ showLoading: !inviteCache.hasCache });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [inviteCache.hasCache, runLoadInvites, invitesRefreshKey]);

  useEffect(() => {
    const shouldSkip = () => {
      if (document.visibilityState !== "visible") return true;
      const now = Date.now();
      if (now - lastRealtimeRef.current < 60000) return true;
      lastRealtimeRef.current = now;
      return false;
    };

    const channel = supabase
      .channel(`groups-rt-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_invitations",
          filter: `invitee_id=eq.${userId}`,
        },
        () => {
          if (shouldSkip()) return;
          runLoadInvites({ showLoading: false });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_members",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          if (shouldSkip()) return;
          runLoadGroups({ showLoading: false });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "groups",
          filter: `owner_id=eq.${userId}`,
        },
        () => {
          if (shouldSkip()) return;
          runLoadGroups({ showLoading: false });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [runLoadGroups, runLoadInvites, userId]);

  const refreshGroups = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  const refreshInvites = useCallback(() => {
    setInvitesRefreshKey((prev) => prev + 1);
  }, []);

  useRevalidateOnFocus(
    () => {
      runLoadGroups({ showLoading: false });
      runLoadInvites({ showLoading: false });
    },
    [runLoadGroups, runLoadInvites],
    { minIntervalMs: 180000, maxStaleMs: 900000, debounceMs: 500 }
  );

  const groupCount = groups.length;
  const hasGroupLimit = groupCount >= MAX_GROUPS;

  return {
    groups,
    loadingGroups,
    groupsError,
    invites,
    loadingInvites,
    invitesError,
    refreshGroups,
    refreshInvites,
    groupCount,
    hasGroupLimit,
  };
}
