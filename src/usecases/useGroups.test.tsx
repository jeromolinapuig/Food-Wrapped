import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGroups } from './useGroups';

const {
  fetchGroupMembershipsMock,
  fetchGroupsMock,
  fetchGroupMembersMock,
  fetchProfilesMock,
  fetchGroupInvitesMock,
  supabaseChannelMock,
  supabaseRemoveChannelMock,
} = vi.hoisted(() => ({
  fetchGroupMembershipsMock: vi.fn(),
  fetchGroupsMock: vi.fn(),
  fetchGroupMembersMock: vi.fn(),
  fetchProfilesMock: vi.fn(),
  fetchGroupInvitesMock: vi.fn(),
  supabaseChannelMock: vi.fn(),
  supabaseRemoveChannelMock: vi.fn(),
}));

vi.mock('../repos/groupRepository', () => ({
  fetchGroupMemberships: fetchGroupMembershipsMock,
  fetchGroups: fetchGroupsMock,
  fetchGroupMembers: fetchGroupMembersMock,
  fetchProfiles: fetchProfilesMock,
  fetchGroupInvites: fetchGroupInvitesMock,
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    channel: supabaseChannelMock,
    removeChannel: supabaseRemoveChannelMock,
  },
}));

vi.mock('../utils/useRevalidateOnFocus', () => ({
  useRevalidateOnFocus: () => {},
}));

describe('useGroups', () => {
  beforeEach(() => {
    sessionStorage.clear();
    fetchGroupMembershipsMock.mockReset();
    fetchGroupsMock.mockReset();
    fetchGroupMembersMock.mockReset();
    fetchProfilesMock.mockReset();
    fetchGroupInvitesMock.mockReset();
    supabaseChannelMock.mockReset();
    supabaseRemoveChannelMock.mockReset();

    supabaseChannelMock.mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({}),
    });

    fetchGroupMembershipsMock.mockResolvedValue({
      ownedIds: ['g1'],
      memberIds: ['g2'],
    });
    fetchGroupsMock.mockImplementation(async (ids: string[]) =>
      ids.map((id) => ({
        id,
        name: id === 'g1' ? 'Grupo 1' : 'Grupo 2',
        owner_id: id === 'g1' ? 'u1' : 'u2',
      }))
    );
    fetchGroupMembersMock.mockResolvedValue([
      { group_id: 'g1', user_id: 'u1' },
      { group_id: 'g1', user_id: 'u2' },
      { group_id: 'g2', user_id: 'u1' },
    ]);
    fetchProfilesMock.mockResolvedValue([
      { id: 'u1', username: 'uno', display_name: 'Uno', avatar_url: null },
      { id: 'u2', username: 'dos', display_name: 'Dos', avatar_url: null },
    ]);
    fetchGroupInvitesMock.mockResolvedValue([
      { id: 'inv1', group_id: 'g1', inviter_id: 'u2', created_at: '2026-01-01T00:00:00.000Z' },
    ]);
  });

  it('loads groups and invites on mount', async () => {
    const { result } = renderHook(() => useGroups('u1'));

    await waitFor(() => {
      expect(result.current.groups.length).toBe(2);
      expect(result.current.invites.length).toBe(1);
    });

    expect(result.current.groupCount).toBe(2);
    expect(result.current.hasGroupLimit).toBe(false);
  });

  it('refreshGroups triggers group reload', async () => {
    const { result } = renderHook(() => useGroups('u1'));

    await waitFor(() => {
      expect(fetchGroupMembershipsMock).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      result.current.refreshGroups();
    });

    await waitFor(() => {
      expect(fetchGroupMembershipsMock).toHaveBeenCalledTimes(2);
    });
  });
});
