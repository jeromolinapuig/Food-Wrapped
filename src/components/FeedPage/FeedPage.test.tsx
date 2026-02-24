import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedPage } from './FeedPage';

type MockSession = {
  user: {
    id: string;
  };
};

type MockSupabase = {
  from: ReturnType<typeof vi.fn>;
};

const { supabaseMock, navigateMock, userProfileState } = vi.hoisted(() => ({
  supabaseMock: {
    from: vi.fn(),
  } satisfies MockSupabase,
  navigateMock: vi.fn(),
  userProfileState: {
    open: false,
    userId: null as string | null,
  },
}));

vi.mock('@mui/icons-material', () => ({
  CheckCircleOutline: () => null,
  GroupAdd: () => null,
  Search: () => null,
  SyncAlt: () => null,
  Clear: () => null,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../lib/supabaseClient', () => ({
  supabase: supabaseMock,
}));

vi.mock('../../utils/scrollLock', () => ({
  lockBodyScroll: () => () => {},
}));

vi.mock('../common/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../common/PageHeader', () => ({
  PageHeader: ({ title }: { title: ReactNode }) => <h1>{title}</h1>,
}));

vi.mock('../common/BackButton', () => ({
  BackButton: ({ onClick, ariaLabel }: { onClick: () => void; ariaLabel: string }) => (
    <button type="button" onClick={onClick} aria-label={ariaLabel}>back</button>
  ),
}));

vi.mock('../FeedTabs/FeedTabs', () => ({
  FeedTabs: ({ onOpenEntry }: { onOpenEntry?: (entryId: string) => void }) => (
    <div>
      <span>feed-tabs</span>
      {onOpenEntry ? <button type="button" onClick={() => onOpenEntry('entry-1')}>open-entry</button> : null}
    </div>
  ),
}));

vi.mock('../common/UserCard', () => ({
  UserCard: ({
    handle,
    infoButton,
    onInfoClick,
    action,
  }: {
    handle: string;
    infoButton?: boolean;
    onInfoClick?: () => void;
    action?: ReactNode;
  }) => (
    <div>
      <span>{handle}</span>
      {infoButton ? <button type="button" onClick={onInfoClick}>info</button> : null}
      {action}
    </div>
  ),
}));

vi.mock('../UserProfileModal/UserProfileModal', () => ({
  UserProfileModal: ({ open, userId }: { open: boolean; userId: string | null }) => {
    userProfileState.open = open;
    userProfileState.userId = userId;
    return open ? <div>{`profile-modal-${userId}`}</div> : null;
  },
}));

vi.mock('../common/ConfirmDialog', () => ({
  ConfirmDialog: ({
    open,
    title,
    actions,
  }: {
    open: boolean;
    title: string;
    actions: ReactNode;
  }) => (
    open ? (
      <div>
        <div>{title}</div>
        {actions}
      </div>
    ) : null
  ),
}));

const makeProfilesQuery = (rows: Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null; bio: string | null }>) => ({
  ilike: () => ({
    limit: () => ({
      neq: async () => ({ data: rows, error: null }),
    }),
  }),
});

const setupSupabase = () => {
  supabaseMock.from.mockImplementation((table: string) => {
    if (table === 'follows') {
      return {
        select: () => ({
          or: async () => ({
            data: [{ id: 44, follower_id: 'user-1', following_id: 'target-1' }],
            error: null,
          }),
        }),
        insert: () => ({
          select: () => ({
            single: async () => ({
              data: { id: 45, follower_id: 'user-1', following_id: 'target-2' },
              error: null,
            }),
          }),
        }),
        delete: () => ({
          match: async () => ({ error: null }),
        }),
      };
    }

    if (table === 'profiles') {
      return {
        select: () =>
          makeProfilesQuery([
            {
              id: 'target-1',
              username: 'targetuser',
              display_name: 'Target User',
              avatar_url: null,
              bio: 'hola',
            },
          ]),
      };
    }

    return {
      select: () => ({
        eq: async () => ({ data: [], error: null }),
      }),
    };
  });
};

const renderFeedPage = (session: MockSession | null, onRequireLogin = vi.fn()) =>
  render(
    <FeedPage
      session={session as never}
      theme="light"
      onToggleTheme={() => {}}
      onNavigate={() => {}}
      onRequireLogin={onRequireLogin}
    />
  );

describe('FeedPage functional flows', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    supabaseMock.from.mockReset();
    userProfileState.open = false;
    userProfileState.userId = null;
    setupSupabase();
  });

  it('searches users and opens profile modal from user card info action', async () => {
    const user = userEvent.setup();
    const session: MockSession = { user: { id: 'user-1' } };
    renderFeedPage(session);

    await user.type(screen.getByRole('searchbox'), 'ta');
    expect(await screen.findByText('targetuser')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'info' }));
    expect(userProfileState.open).toBe(true);
    expect(userProfileState.userId).toBe('target-1');
  });

  it('opens unfollow confirm dialog and confirms action', async () => {
    const user = userEvent.setup();
    const session: MockSession = { user: { id: 'user-1' } };
    renderFeedPage(session);

    await user.type(screen.getByRole('searchbox'), 'ta');
    await user.click(await screen.findByTitle('Unfollow'));

    expect(await screen.findByText('feedPage.confirmUnfollow')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'feedPage.yes' }));

    await waitFor(() => {
      expect(screen.queryByText('feedPage.confirmUnfollow')).not.toBeInTheDocument();
    });
  });

  it('navigates to post details from feed entries', async () => {
    const user = userEvent.setup();
    const session: MockSession = { user: { id: 'user-1' } };
    renderFeedPage(session);

    await user.click(screen.getByRole('button', { name: 'open-entry' }));
    expect(navigateMock).toHaveBeenCalledWith('/posts/entry-1', { state: { returnTo: '/feed' } });
  });
});
