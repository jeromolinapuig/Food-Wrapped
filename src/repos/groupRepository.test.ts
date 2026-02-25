import { describe, expect, it, vi } from 'vitest';
import {
  fetchGroupInvites,
  fetchGroupMembers,
  fetchGroupMemberships,
  fetchGroups,
  fetchProfiles,
} from './groupRepository';

type MockSupabase = {
  from: ReturnType<typeof vi.fn>;
};

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {
    from: vi.fn(),
  } satisfies MockSupabase,
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: supabaseMock,
}));

const setupSupabase = () => {
  supabaseMock.from.mockImplementation((table: string) => {
    if (table === 'groups') {
      return {
        select: (columns: string) => {
          if (columns === 'id') {
            return {
              eq: async () => ({ data: [{ id: 'g1' }], error: null }),
            };
          }
          return {
            in: async () => ({
              data: [{ id: 'g1', name: 'Group 1', owner_id: 'u1' }],
              error: null,
            }),
          };
        },
      };
    }

    if (table === 'group_members') {
      return {
        select: () => ({
          eq: async () => ({ data: [{ group_id: 'g1' }], error: null }),
          in: async () => ({ data: [{ group_id: 'g1', user_id: 'u1' }], error: null }),
        }),
      };
    }

    if (table === 'profiles') {
      return {
        select: () => ({
          in: async () => ({
            data: [{ id: 'u1', username: 'uno', display_name: 'Uno', avatar_url: null }],
            error: null,
          }),
        }),
      };
    }

    if (table === 'group_invitations') {
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: async () => ({
                data: [{ id: 'inv1', group_id: 'g1', inviter_id: 'u2', created_at: '2026-01-01T00:00:00.000Z' }],
                error: null,
              }),
            }),
          }),
        }),
      };
    }

    return {
      select: () => ({
        eq: async () => ({ data: [], error: null }),
      }),
    };
  });
};

describe('groupRepository', () => {
  it('fetches memberships, groups, members, profiles and invites', async () => {
    setupSupabase();

    await expect(fetchGroupMemberships('u1')).resolves.toEqual({
      ownedIds: ['g1'],
      memberIds: ['g1'],
    });
    await expect(fetchGroups(['g1'])).resolves.toEqual([
      { id: 'g1', name: 'Group 1', owner_id: 'u1' },
    ]);
    await expect(fetchGroupMembers(['g1'])).resolves.toEqual([
      { group_id: 'g1', user_id: 'u1' },
    ]);
    await expect(fetchProfiles(['u1'])).resolves.toEqual([
      { id: 'u1', username: 'uno', display_name: 'Uno', avatar_url: null },
    ]);
    await expect(fetchGroupInvites('u1')).resolves.toEqual([
      { id: 'inv1', group_id: 'g1', inviter_id: 'u2', created_at: '2026-01-01T00:00:00.000Z' },
    ]);
  });
});
