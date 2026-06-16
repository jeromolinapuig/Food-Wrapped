import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BottomNav } from './BottomNav';

type MockSession = {
  user: {
    id: string;
    email: string;
  };
};

type MockSupabase = {
  from: ReturnType<typeof vi.fn>;
};

const { supabaseMock, navigateMock, routerState } = vi.hoisted(() => ({
  supabaseMock: {
    from: vi.fn(),
  } satisfies MockSupabase,
  navigateMock: vi.fn(),
  routerState: {
    pathname: '/',
    state: null as { returnTo?: string } | null,
  },
}));

vi.mock('@mui/icons-material', () => ({
  Close: () => null,
  DynamicFeed: () => null,
  EmojiEvents: () => null,
  Groups: () => null,
  Home: () => null,
  LocalDining: () => null,
  MoreHoriz: () => null,
  PersonOutline: () => null,
  Store: () => null,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => routerState,
  };
});

vi.mock('../../lib/supabaseClient', () => ({
  supabase: supabaseMock,
}));

vi.mock('../../utils/useRevalidateOnFocus', () => ({
  useRevalidateOnFocus: () => {},
}));

const setupSupabase = (inviteCount: number) => {
  supabaseMock.from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: { avatar_url: null, username: 'jero', display_name: null },
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === 'group_invitations') {
      return {
        select: () => ({
          eq: async () => ({ count: inviteCount, error: null }),
        }),
      };
    }

    return {
      select: () => ({
        eq: async () => ({ data: null, error: null }),
      }),
    };
  });
};

describe('BottomNav functional flows', () => {
  beforeEach(() => {
    window.localStorage.clear();
    navigateMock.mockReset();
    supabaseMock.from.mockReset();
    routerState.pathname = '/';
    routerState.state = null;
    setupSupabase(0);
  });

  it('requires login when guest clicks profile', async () => {
    const user = userEvent.setup();
    const onRequireLogin = vi.fn();

    render(<BottomNav session={null} onRequireLogin={onRequireLogin} />);
    await user.click(screen.getByRole('button', { name: 'profile.title' }));

    expect(onRequireLogin).toHaveBeenCalledTimes(1);
    expect(navigateMock).not.toHaveBeenCalledWith('/profile');
  });

  it('opens More menu and navigates to ranking', async () => {
    const user = userEvent.setup();
    const session: MockSession = { user: { id: 'user-1', email: 'user@example.com' } };

    render(<BottomNav session={session as never} />);
    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(screen.getByRole('menuitem', { name: 'Ranking' }));

    expect(navigateMock).toHaveBeenCalledWith('/ranking');
  });

  it('shows invite dot when there are pending group invitations', async () => {
    const session: MockSession = { user: { id: 'user-1', email: 'user@example.com' } };
    setupSupabase(3);

    const { container } = render(<BottomNav session={session as never} />);

    await waitFor(() => {
      expect(container.querySelector('.bw-bottom-nav-dot')).toBeInTheDocument();
    });
  });

  it('dismisses the incomplete profile suggestion', async () => {
    const user = userEvent.setup();
    const session: MockSession = { user: { id: 'user-1', email: 'user@example.com' } };

    render(<BottomNav session={session as never} />);

    expect(await screen.findByText('dashboard.profileReminderTitle')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(screen.queryByText('dashboard.profileReminderTitle')).not.toBeInTheDocument();
    });
    expect(window.localStorage.getItem('bw-profile-suggestion-dismissed-user-1')).toBe('true');
  });
});
