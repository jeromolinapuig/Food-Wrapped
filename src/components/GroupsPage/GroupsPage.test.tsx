import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GroupsPage } from './GroupsPage';

type MockSession = {
  user: {
    id: string;
  };
};

type MockSupabase = {
  from: ReturnType<typeof vi.fn>;
  channel: ReturnType<typeof vi.fn>;
  removeChannel: ReturnType<typeof vi.fn>;
};

const { supabaseMock, deleteMatchMock } = vi.hoisted(() => ({
  supabaseMock: {
    from: vi.fn(),
    channel: vi.fn(),
    removeChannel: vi.fn(),
  } satisfies MockSupabase,
  deleteMatchMock: vi.fn(async () => ({ error: null })),
}));

vi.mock('@mui/icons-material', () => ({
  Add: () => null,
  ChevronRight: () => null,
  DeleteOutline: () => null,
  PeopleOutline: () => null,
  Settings: () => null,
}));

vi.mock('../../lib/supabaseClient', () => ({
  supabase: supabaseMock,
}));

vi.mock('../../utils/useRevalidateOnFocus', () => ({
  useRevalidateOnFocus: () => {},
}));

vi.mock('../GroupInvitesModal/GroupInvitesModal', () => ({
  GroupInvitesModal: () => <div>group-invites-modal</div>,
}));

vi.mock('../CreateGroupModal/CreateGroupModal', () => ({
  CreateGroupModal: () => <div>create-group-modal</div>,
}));

vi.mock('../GroupManageModal/GroupManageModal', () => ({
  GroupManageModal: () => <div>group-manage-modal</div>,
}));

const setupSupabase = () => {
  const channelStub = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnValue({}),
  };
  supabaseMock.channel.mockReturnValue(channelStub);

  supabaseMock.from.mockImplementation((table: string) => {
    if (table === 'groups') {
      return {
        select: (columns: string) => {
          if (columns === 'id, name') {
            return {
              eq: async () => ({
                data: [{ id: 'g1', name: 'Owners Group' }],
                error: null,
              }),
              in: async () => ({
                data: [
                  { id: 'g1', name: 'Owners Group' },
                  { id: 'g2', name: 'Member Group' },
                ],
                error: null,
              }),
            };
          }
          if (columns === 'id, name, owner_id') {
            return {
              in: async () => ({
                data: [
                  { id: 'g1', name: 'Owners Group', owner_id: 'user-1' },
                  { id: 'g2', name: 'Member Group', owner_id: 'owner-2' },
                ],
                error: null,
              }),
            };
          }
          return {
            in: async () => ({
              data: [
                { id: 'g1', name: 'Owners Group' },
                { id: 'g2', name: 'Member Group' },
              ],
              error: null,
            }),
          };
        },
      };
    }

    if (table === 'group_members') {
      return {
        select: (columns: string) => {
          if (columns === 'group_id') {
            return {
              eq: async () => ({
                data: [{ group_id: 'g1' }, { group_id: 'g2' }],
                error: null,
              }),
            };
          }
          return {
            in: async () => ({
              data: [
                { group_id: 'g1', user_id: 'user-1' },
                { group_id: 'g1', user_id: 'friend-1' },
                { group_id: 'g2', user_id: 'user-1' },
              ],
              error: null,
            }),
          };
        },
        delete: () => ({
          match: deleteMatchMock,
        }),
      };
    }

    if (table === 'group_invitations') {
      return {
        select: () => ({
          eq: async () => ({
            data: [{ id: 'inv-1', group_id: 'g1', inviter_id: 'friend-1' }],
            error: null,
          }),
        }),
      };
    }

    if (table === 'profiles') {
      return {
        select: (columns: string) => {
          if (columns === 'id, username, display_name, avatar_url') {
            return {
              in: async () => ({
                data: [
                  { id: 'user-1', username: 'me', display_name: 'Me', avatar_url: null },
                  { id: 'friend-1', username: 'friend', display_name: 'Friend', avatar_url: null },
                ],
                error: null,
              }),
            };
          }
          return {
            in: async () => ({
              data: [{ id: 'friend-1', username: 'friend', display_name: 'Friend' }],
              error: null,
            }),
          };
        },
      };
    }

    return {
      select: () => ({
        eq: async () => ({ data: [], error: null }),
      }),
    };
  });
};

const renderGroupsPage = () => {
  const session: MockSession = { user: { id: 'user-1' } };
  return render(
    <MemoryRouter>
      <GroupsPage
        session={session as never}
        theme="light"
        onToggleTheme={() => {}}
        onNavigate={() => {}}
      />
    </MemoryRouter>
  );
};

describe('GroupsPage functional flows', () => {
  beforeEach(() => {
    sessionStorage.clear();
    deleteMatchMock.mockClear();
    supabaseMock.from.mockReset();
    supabaseMock.channel.mockReset();
    supabaseMock.removeChannel.mockReset();
    setupSupabase();
  });

  it('loads groups and shows invitations button', async () => {
    renderGroupsPage();
    expect(await screen.findByText('Owners Group')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'groups.invitations' })).toBeInTheDocument();
  });

  it('opens create and manage modals from group actions', async () => {
    const user = userEvent.setup();
    renderGroupsPage();

    await screen.findByText('Owners Group');
    await user.click(screen.getByRole('button', { name: 'groups.createButton' }));
    expect(screen.getByText('create-group-modal')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'groups.settingsAriaLabel' }));
    expect(screen.getByText('group-manage-modal')).toBeInTheDocument();
  });

  it('allows leaving a non-owner group after confirmation', async () => {
    const user = userEvent.setup();
    renderGroupsPage();

    await screen.findByText('Member Group');
    const leaveOpenButtons = screen.getAllByRole('button', { name: 'groups.leave' });
    await user.click(leaveOpenButtons[0]);

    const confirmButtons = screen.getAllByRole('button', { name: 'groups.leave' });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(deleteMatchMock).toHaveBeenCalledWith({ group_id: 'g2', user_id: 'user-1' });
    });
  });
});
