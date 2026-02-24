import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsernameSetupScreen } from './UsernameSetupScreen';

type MockSupabase = {
  from: ReturnType<typeof vi.fn>;
  auth: {
    getSession: ReturnType<typeof vi.fn>;
    updateUser: ReturnType<typeof vi.fn>;
  };
};

const { supabaseMock, navigateMock } = vi.hoisted(() => ({
  supabaseMock: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { user: { id: 'user-1' } } } })),
      updateUser: vi.fn(async () => ({ error: null })),
    },
  } satisfies MockSupabase,
  navigateMock: vi.fn(),
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

const setupSupabase = () => {
  supabaseMock.from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return {
        select: (columns: string) => {
          if (columns === 'username, display_name') {
            return {
              eq: () => ({
                single: async () => ({
                  data: { username: 'olduser', display_name: 'Old User' },
                  error: null,
                }),
              }),
            };
          }
          return {
            eq: () => ({
              limit: async () => ({
                data: [],
                error: null,
              }),
            }),
          };
        },
        update: () => ({
          eq: async () => ({ error: null }),
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

describe('UsernameSetupScreen functional flows', () => {
  beforeEach(() => {
    vi.useRealTimers();
    navigateMock.mockReset();
    supabaseMock.from.mockReset();
    supabaseMock.auth.getSession.mockClear();
    supabaseMock.auth.updateUser.mockClear();
    setupSupabase();
  });

  it('redirects to login when there is no session', async () => {
    supabaseMock.auth.getSession.mockResolvedValueOnce({ data: { session: null } } as never);
    render(<UsernameSetupScreen />);
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true });
    });
  });

  it('saves username and redirects home', async () => {
    const user = userEvent.setup();
    render(<UsernameSetupScreen />);

    const input = await screen.findByLabelText('auth.usernameLabel');
    await user.clear(input);
    await user.type(input, 'newuser');
    await user.click(screen.getByRole('button', { name: 'common.save' }));

    await waitFor(() => {
      expect(supabaseMock.auth.updateUser).toHaveBeenCalledWith({
        data: { username: 'newuser', username_set: true },
      });
      expect(screen.getByText('All set. You can enter now.')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/', { replace: true });
    }, { timeout: 2500 });
  });
});
