import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePage } from './ProfilePage';

type MockSession = {
  user: {
    id: string;
    email: string;
    user_metadata: {
      username?: string;
    };
  };
};

type MockSupabase = {
  from: ReturnType<typeof vi.fn>;
  auth: {
    signOut: ReturnType<typeof vi.fn>;
    updateUser: ReturnType<typeof vi.fn>;
    refreshSession: ReturnType<typeof vi.fn>;
  };
  channel: ReturnType<typeof vi.fn>;
  removeChannel: ReturnType<typeof vi.fn>;
};

const { supabaseMock, navigateMock, prefsMock } = vi.hoisted(() => ({
  supabaseMock: {
    from: vi.fn(),
    auth: {
      signOut: vi.fn(async () => ({ error: null })),
      updateUser: vi.fn(async () => ({ error: null })),
      refreshSession: vi.fn(async () => ({ data: null, error: null })),
    },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  } satisfies MockSupabase,
  navigateMock: vi.fn(),
  prefsMock: {
    language: 'en',
    currency: 'USD',
    setLanguage: vi.fn(),
    setCurrency: vi.fn(),
    formatCurrency: vi.fn(),
    convertAmount: vi.fn(),
  },
}));

vi.mock('@mui/icons-material', () => ({
  Block: () => null,
  BookmarksOutlined: () => null,
  Check: () => null,
  Close: () => null,
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

vi.mock('../../utils/cropImage', () => ({
  cropImageFile: vi.fn(),
}));

vi.mock('../../utils/image', () => ({
  compressImage: vi.fn(),
}));

vi.mock('../../utils/useRevalidateOnFocus', () => ({
  useRevalidateOnFocus: () => {},
}));

vi.mock('../../context/PreferencesContext', () => ({
  usePreferences: () => prefsMock,
}));

vi.mock('../TopMenu/TopMenu', () => ({
  TopMenu: () => <div>top-menu</div>,
}));

vi.mock('../common/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../common/PageHeader', () => ({
  PageHeader: ({ title }: { title: ReactNode }) => <h1>{title}</h1>,
}));

vi.mock('../FollowListModal/FollowListModal', () => ({
  FollowListModal: ({ open, mode }: { open: boolean; mode: string | null }) => (
    <div>{open ? `follow-modal-${mode}` : 'follow-modal-closed'}</div>
  ),
}));

vi.mock('react-easy-crop', () => ({
  default: () => null,
}));

const setupSupabase = () => {
  const channelStub = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnValue({}),
  };
  supabaseMock.channel.mockReturnValue(channelStub);

  supabaseMock.from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return {
        select: (columns: string) => {
          if (columns === '*') {
            return {
              eq: () => ({
                single: async () => ({
                  data: {
                    username: 'olduser',
                    display_name: 'Old User',
                    avatar_url: null,
                    bio: 'hello',
                    is_private: false,
                    preferred_language: 'en',
                    preferred_currency: 'USD',
                  },
                  error: null,
                }),
              }),
            };
          }
          return {
            eq: () => ({
              neq: () => ({
                limit: async () => ({
                  data: [],
                  error: null,
                }),
              }),
            }),
          };
        },
        update: () => ({
          eq: () => ({
            select: () => ({
              single: async () => ({
                data: {
                  username: 'newuser',
                  display_name: 'newuser',
                  avatar_url: null,
                  bio: 'hello',
                  is_private: false,
                  preferred_language: 'en',
                  preferred_currency: 'USD',
                },
                error: null,
              }),
            }),
          }),
        }),
      };
    }

    if (table === 'follows') {
      return {
        select: () => ({
          or: async () => ({
            data: [{ follower_id: 'friend-1', following_id: 'user-1' }],
            error: null,
          }),
        }),
      };
    }

    if (table === 'entries') {
      const query = {
        select: () => query,
        eq: () => query,
        is: () => query,
        gte: () => query,
        lt: async () => ({ data: [], error: null }),
      };
      return query;
    }

    if (table === 'monthly_frame_results') {
      return {
        select: () => ({
          order: () => ({
            limit: async () => ({ data: [], error: null }),
          }),
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      };
    }

    return {
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null, error: null }),
        }),
      }),
    };
  });
};

const renderProfilePage = () => {
  const session: MockSession = {
    user: {
      id: 'user-1',
      email: 'user@example.com',
      user_metadata: { username: 'olduser' },
    },
  };

  return render(
    <ProfilePage
      session={session as never}
      theme="light"
      onToggleTheme={() => {}}
      onOpenUserDashboard={() => {}}
    />
  );
};

describe('ProfilePage functional flows', () => {
  beforeEach(() => {
    sessionStorage.clear();
    navigateMock.mockReset();
    supabaseMock.from.mockReset();
    supabaseMock.channel.mockReset();
    supabaseMock.removeChannel.mockReset();
    supabaseMock.auth.signOut.mockClear();
    supabaseMock.auth.updateUser.mockClear();
    prefsMock.setLanguage.mockClear();
    prefsMock.setCurrency.mockClear();
    setupSupabase();
  });

  it('navigates to saved posts when clicking bookmark action', async () => {
    const user = userEvent.setup();
    renderProfilePage();

    await user.click(await screen.findByRole('button', { name: 'profile.savedPosts' }));
    expect(navigateMock).toHaveBeenCalledWith('/saved');
  });

  it('saves profile changes and syncs user preferences', async () => {
    const user = userEvent.setup();
    renderProfilePage();

    const usernameInput = await screen.findByLabelText('profile.usernameLabel');
    await user.clear(usernameInput);
    await user.type(usernameInput, 'newuser');
    await user.click(screen.getByRole('button', { name: 'profile.saveChanges' }));

    await waitFor(() => {
      expect(supabaseMock.auth.updateUser).toHaveBeenCalled();
      expect(prefsMock.setLanguage).toHaveBeenCalledWith('en');
      expect(prefsMock.setCurrency).toHaveBeenCalledWith('USD');
    });
  });

  it('signs out current user', async () => {
    const user = userEvent.setup();
    renderProfilePage();

    await user.click(await screen.findByRole('button', { name: 'profile.signOut' }));
    expect(supabaseMock.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it('opens following list modal from profile counts', async () => {
    const user = userEvent.setup();
    renderProfilePage();

    await user.click(await screen.findByRole('button', { name: /common.following/i }));
    expect(screen.getByText('follow-modal-following')).toBeInTheDocument();
  });

  it('confirms bottom navigation when profile changes are unsaved', async () => {
    const user = userEvent.setup();
    renderProfilePage();

    const usernameInput = await screen.findByLabelText('profile.usernameLabel');
    await user.clear(usernameInput);
    await user.type(usernameInput, 'changed-user');

    const event = new CustomEvent('bw-bottom-nav-before-navigate', {
      cancelable: true,
      detail: { path: '/feed' },
    });
    act(() => {
      window.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(await screen.findByText('profile.unsavedLeaveTitle')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'profile.unsavedLeaveConfirm' }));
    expect(navigateMock).toHaveBeenCalledWith('/feed');
  });
});
