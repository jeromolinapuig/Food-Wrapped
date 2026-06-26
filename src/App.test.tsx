import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

type MockSession = {
  user: {
    id: string;
    email: string;
    user_metadata: Record<string, unknown>;
    app_metadata: Record<string, unknown>;
  };
};

type MockSupabase = {
  auth: {
    getSession: ReturnType<typeof vi.fn>;
    onAuthStateChange: ReturnType<typeof vi.fn>;
  };
  from: ReturnType<typeof vi.fn>;
};

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
    from: vi.fn(),
  } satisfies MockSupabase,
}));

vi.mock('./lib/supabaseClient', () => ({
  supabase: supabaseMock,
}));

vi.mock('@mui/icons-material', () => ({
  DynamicFeed: () => null,
  PlaylistAddCheck: () => null,
}));

vi.mock('./components/AuthScreen/AuthScreen', () => ({ AuthScreen: () => <div>auth-screen</div> }));
vi.mock('./components/AuthScreen/ResetPasswordScreen', () => ({ ResetPasswordScreen: () => <div>reset-password-screen</div> }));
vi.mock('./components/AuthScreen/UsernameSetupScreen', () => ({ UsernameSetupScreen: () => <div>username-setup-screen</div> }));
vi.mock('./components/BottomNav/BottomNav', () => ({ BottomNav: () => <div>bottom-nav</div> }));
vi.mock('./components/Dashboard/Dashboard', () => ({ Dashboard: () => <div>dashboard-page</div> }));
vi.mock('./components/FeedPage/FeedPage', () => ({ FeedPage: () => <div>feed-page</div> }));
vi.mock('./components/GlobalRankingPage/GlobalRankingPage', () => ({ GlobalRankingPage: () => <div>ranking-page</div> }));
vi.mock('./components/GroupsPage/GroupsPage', () => ({ GroupsPage: () => <div>groups-page</div> }));
vi.mock('./components/GroupPage/GroupPage', () => ({ GroupPage: () => <div>group-page</div> }));
vi.mock('./components/LandingPage/LandingPage', () => ({ LandingPage: () => <div>landing-page</div> }));
vi.mock('./components/ProfilePage/ProfilePage', () => ({ ProfilePage: () => <div>profile-page</div> }));
vi.mock('./components/PrivacyPage/PrivacyPage', () => ({ PrivacyPage: () => <div>privacy-page</div> }));
vi.mock('./components/UserDashboardPage/UserDashboardPage', () => ({ UserDashboardPage: () => <div>user-dashboard-page</div> }));
vi.mock('./components/AdminReportsPage/AdminReportsPage', () => ({ AdminReportsPage: () => <div>admin-reports-page</div> }));
vi.mock('./components/SavedPostsPage/SavedPostsPage', () => ({ SavedPostsPage: () => <div>saved-posts-page</div> }));
vi.mock('./components/BurgerWishlistPage/BurgerWishlistPage', () => ({ BurgerWishlistPage: () => <div>burger-wishlist-page</div> }));
vi.mock('./components/PostPage/PostPage', () => ({ PostPage: () => <div>post-page</div> }));
vi.mock('./components/SearchPage/SearchPage', () => ({ SearchPage: () => <div>search-page</div> }));
vi.mock('./components/MyTopBurgersPage/MyTopBurgersPage', () => ({ MyTopBurgersPage: () => <div>my-top-burgers-page</div> }));
vi.mock('./components/common/AppShell', () => ({ AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('./components/common/PageHeader', () => ({ PageHeader: ({ title }: { title: ReactNode }) => <h1>{title}</h1> }));
vi.mock('./components/common/LockedPlaceholders', () => ({
  FeedPlaceholder: () => <div>feed-placeholder</div>,
  GroupsPlaceholder: () => <div>groups-placeholder</div>,
  ProfilePlaceholder: () => <div>profile-placeholder</div>,
}));
vi.mock('./components/common/LoginOverlay', () => ({
  LockedContent: ({ onLogin }: { onLogin: () => void }) => (
    <div>
      <span>locked-content</span>
      <button type="button" onClick={onLogin}>go-login</button>
    </div>
  ),
}));

const mockProfileQuery = () => {
  const single = vi.fn(async () => ({ data: { username: 'tester' }, error: null }));
  const maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  const query = {
    eq: vi.fn(() => query),
    single,
    maybeSingle,
  };
  const select = vi.fn(() => query);

  supabaseMock.from.mockImplementation(() => ({ select }));
};

const mockProfileQueryWithUsername = (username: string | null) => {
  const single = vi.fn(async () => ({ data: { username }, error: null }));
  const maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  const query = {
    eq: vi.fn(() => query),
    single,
    maybeSingle,
  };
  const select = vi.fn(() => query);

  supabaseMock.from.mockImplementation(() => ({ select }));
};

const renderAppAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  supabaseMock.auth.getSession.mockResolvedValue({ data: { session: null } });
  supabaseMock.auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
  mockProfileQuery();
});

describe('App functional flows', () => {
  it('shows landing when user is logged out', async () => {
    renderAppAt('/');

    expect(await screen.findByText('landing-page')).toBeInTheDocument();
    expect(screen.getByText('bottom-nav')).toBeInTheDocument();
  });

  it('shows dashboard when user has an active session', async () => {
    const session: MockSession = {
      user: {
        id: 'user-1',
        email: 'user@example.com',
        user_metadata: {},
        app_metadata: {},
      },
    };
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session } });

    renderAppAt('/');

    expect(await screen.findByText('dashboard-page')).toBeInTheDocument();
  });

  it('redirects locked profile to login when pressing login action', async () => {
    const user = userEvent.setup();
    renderAppAt('/profile');

    expect(await screen.findByText('locked-content')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'go-login' }));

    expect(await screen.findByText('auth-screen')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('bottom-nav')).not.toBeInTheDocument();
    });
  });

  it('renders locked content for groups when logged out', async () => {
    renderAppAt('/groups');
    expect(await screen.findByText('locked-content')).toBeInTheDocument();
  });

  it('redirects /home to root page', async () => {
    renderAppAt('/home');
    expect(await screen.findByText('landing-page')).toBeInTheDocument();
  });

  it('scrolls to the top when rendering a route', async () => {
    renderAppAt('/feed');

    expect(await screen.findByText('feed-page')).toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0 });
  });

  it('redirects unknown routes to root page', async () => {
    renderAppAt('/some-unknown-route');
    expect(await screen.findByText('landing-page')).toBeInTheDocument();
  });

  it('redirects /login to dashboard when session exists', async () => {
    const session: MockSession = {
      user: {
        id: 'user-2',
        email: 'member@example.com',
        user_metadata: {},
        app_metadata: {},
      },
    };
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session } });

    renderAppAt('/login');
    expect(await screen.findByText('dashboard-page')).toBeInTheDocument();
  });

  it('forces setup username for google users without custom username', async () => {
    const session: MockSession = {
      user: {
        id: 'google-user',
        email: 'google@example.com',
        user_metadata: {
          username: 'google',
          username_set: false,
        },
        app_metadata: {
          provider: 'google',
          providers: ['google'],
        },
      },
    };
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session } });
    mockProfileQueryWithUsername('google');

    renderAppAt('/feed');

    expect(await screen.findByText('username-setup-screen')).toBeInTheDocument();
  });
});
