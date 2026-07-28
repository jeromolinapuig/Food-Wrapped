import { supabase } from '../../lib/supabaseClient';

export type FollowListMode = 'followers' | 'following';

export type FollowListItem = {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  avatarFrame: 'gold' | 'silver' | 'bronze' | null;
  bio: string | null;
  isOutgoing: boolean;
  isIncoming: boolean;
  outgoingFollowId: number | null;
  incomingFollowId: number | null;
};

export async function loadFollowListItems(currentUserId: string, mode: FollowListMode) {
  const { data: baseData, error: baseError } = await supabase
    .from('follows')
    .select('id, follower_id, following_id')
    .eq(mode === 'followers' ? 'following_id' : 'follower_id', currentUserId);

  if (baseError) {
    return { items: [] as FollowListItem[], count: 0, error: baseError };
  }

  const rows = (baseData ?? []) as { id: number; follower_id: string; following_id: string }[];
  const userIds = Array.from(new Set(rows.map((r) => (mode === 'followers' ? r.follower_id : r.following_id))));

  const incomingBaseMap = mode === 'followers' ? Object.fromEntries(rows.map((r) => [r.follower_id, r.id])) : {};
  const outgoingBaseMap = mode === 'following' ? Object.fromEntries(rows.map((r) => [r.following_id, r.id])) : {};

  if (!userIds.length) {
    return { items: [] as FollowListItem[], count: 0, error: null };
  }

  const [{ data: profilesData, error: profilesError }, extraFollows] = await Promise.all([
    supabase.from('profiles').select('id, username, display_name, avatar_url, equipped_frame, bio').in('id', userIds),
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

  if (profilesError) {
    return { items: [] as FollowListItem[], count: userIds.length, error: profilesError };
  }

  if (extraFollows?.error) {
    console.error('Error cargando seguimientos', extraFollows.error);
  }

  const extraRows = (extraFollows?.data ?? []) as { id: number; follower_id: string; following_id: string }[];
  const outgoingExtraMap = mode === 'followers' ? Object.fromEntries(extraRows.map((r) => [r.following_id, r.id])) : {};
  const incomingExtraMap = mode === 'following' ? Object.fromEntries(extraRows.map((r) => [r.follower_id, r.id])) : {};

  const profilesById = new Map(
    (profilesData ?? []).map((profileRow) => [(profileRow as { id: string }).id, profileRow])
  );

  const items: FollowListItem[] = userIds.map((id) => {
    const p = profilesById.get(id);
    const outgoingFollowId = mode === 'following' ? outgoingBaseMap[id] ?? null : outgoingExtraMap[id] ?? null;
    const incomingFollowId = mode === 'followers' ? incomingBaseMap[id] ?? null : incomingExtraMap[id] ?? null;

    return {
      id,
      username: (p as { username?: string | null } | undefined)?.username ?? null,
      displayName: (p as { display_name?: string | null } | undefined)?.display_name ?? null,
      avatarUrl: (p as { avatar_url?: string | null } | undefined)?.avatar_url ?? null,
      avatarFrame: ((p as { equipped_frame?: 'gold' | 'silver' | 'bronze' | null } | undefined)?.equipped_frame ?? null),
      bio: (p as { bio?: string | null } | undefined)?.bio ?? null,
      isOutgoing: Boolean(outgoingFollowId),
      isIncoming: Boolean(incomingFollowId),
      outgoingFollowId,
      incomingFollowId,
    };
  });

  return { items, count: userIds.length, error: null };
}
