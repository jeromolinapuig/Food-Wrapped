import { supabase } from '../lib/supabaseClient';

export type RawGroupRow = {
  id: string;
  name: string;
  owner_id: string;
};

export type GroupInviteRow = {
  id: string;
  group_id: string;
  inviter_id: string;
  created_at: string | null;
};

export async function fetchGroupMemberships(userId: string) {
  const [{ data: owned }, { data: memberRows }] = await Promise.all([
    supabase.from('groups').select('id').eq('owner_id', userId),
    supabase.from('group_members').select('group_id').eq('user_id', userId),
  ]);
  const ownedIds = (owned ?? []).map((row) => (row as { id: string }).id);
  const memberIds = (memberRows ?? []).map((row) => (row as { group_id: string }).group_id);
  return { ownedIds, memberIds };
}

export async function fetchGroups(groupIds: string[]) {
  const { data } = await supabase
    .from('groups')
    .select('id, name, owner_id')
    .in('id', groupIds);
  return (data ?? []) as RawGroupRow[];
}

export async function fetchGroupMembers(groupIds: string[]) {
  const { data } = await supabase
    .from('group_members')
    .select('group_id, user_id')
    .in('group_id', groupIds);
  return (data ?? []) as { group_id: string; user_id: string }[];
}

export async function fetchProfiles(userIds: string[]) {
  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', userIds);
  return (data ?? []) as Array<{
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  }>;
}

export async function fetchGroupInvites(userId: string) {
  const { data } = await supabase
    .from('group_invitations')
    .select('id, group_id, inviter_id, created_at')
    .eq('invitee_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data ?? []) as GroupInviteRow[];
}
