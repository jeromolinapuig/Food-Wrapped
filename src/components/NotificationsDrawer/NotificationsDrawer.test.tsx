import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsDrawer } from './NotificationsDrawer';

type MockSupabase = {
  from: ReturnType<typeof vi.fn>;
};

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {
    from: vi.fn(),
  } satisfies MockSupabase,
}));

vi.mock('@mui/icons-material', () => ({
  ChatBubbleOutline: () => null,
  Favorite: () => null,
  GroupAdd: () => null,
  Notifications: () => null,
  PersonAdd: () => null,
}));

vi.mock('../../lib/supabaseClient', () => ({
  supabase: supabaseMock,
}));

vi.mock('../../utils/scrollLock', () => ({
  lockBodyScroll: () => () => {},
}));

const setupSupabase = () => {
  supabaseMock.from.mockImplementation((table: string) => {
    if (table === 'entries') {
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: async () => ({
                data: [{ id: 'entry-1', datetime: '2026-02-01T10:00:00.000Z' }],
                error: null,
              }),
            }),
          }),
        }),
      };
    }

    if (table === 'entry_likes') {
      return {
        select: () => ({
          in: () => ({
            neq: () => ({
              order: () => ({
                limit: async () => ({
                  data: [{ entry_id: 'entry-1', user_id: 'u-like', created_at: '2026-02-03T09:00:00.000Z' }],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };
    }

    if (table === 'entry_comments') {
      return {
        select: () => ({
          in: () => ({
            neq: () => ({
              order: () => ({
                limit: async () => ({
                  data: [{ entry_id: 'entry-1', user_id: 'u-comment', created_at: '2026-02-02T09:00:00.000Z' }],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };
    }

    if (table === 'follows') {
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: async () => ({
                data: [{ follower_id: 'u-follow', created_at: '2026-02-01T09:00:00.000Z' }],
                error: null,
              }),
            }),
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
                data: [{ id: 'inv-1', inviter_id: 'u-inviter', group_id: 'g-1', created_at: '2026-02-02T12:00:00.000Z' }],
                error: null,
              }),
            }),
          }),
        }),
      };
    }

    if (table === 'profiles') {
      return {
        select: () => ({
          in: async () => ({
            data: [
              { id: 'u-like', username: 'liker', display_name: null },
              { id: 'u-comment', username: 'commenter', display_name: null },
              { id: 'u-follow', username: 'follower', display_name: null },
              { id: 'u-inviter', username: 'inviter', display_name: null },
            ],
            error: null,
          }),
        }),
      };
    }

    if (table === 'groups') {
      return {
        select: () => ({
          in: async () => ({
            data: [{ id: 'g-1', name: 'Group One' }],
            error: null,
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

describe('NotificationsDrawer functional flows', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
    setupSupabase();
  });

  it('loads notifications and opens entry on like item click', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onOpenEntry = vi.fn();
    const onCountChange = vi.fn();
    const onLatestChange = vi.fn();

    render(
      <NotificationsDrawer
        open
        currentUserId="user-1"
        onClose={onClose}
        onOpenEntry={onOpenEntry}
        onOpenProfile={() => {}}
        onOpenInvites={() => {}}
        onCountChange={onCountChange}
        onLatestChange={onLatestChange}
      />
    );

    const likeItem = await screen.findByRole('button', { name: 'notifications.likedSingle' });
    await user.click(likeItem);

    expect(onOpenEntry).toHaveBeenCalledWith('entry-1');
    expect(onClose).toHaveBeenCalled();
    await waitFor(() => {
      expect(onCountChange).toHaveBeenCalledWith(4);
      expect(onLatestChange).toHaveBeenCalledWith('2026-02-03T09:00:00.000Z');
    });
  });
});
