import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchPage } from './SearchPage';

type MockSession = {
  user: {
    id: string;
  };
};

type MockSupabase = {
  from: ReturnType<typeof vi.fn>;
};

const { supabaseMock, userProfileState } = vi.hoisted(() => ({
  supabaseMock: {
    from: vi.fn(),
  } satisfies MockSupabase,
  userProfileState: {
    open: false,
    userId: null as string | null,
  },
}));

vi.mock('@mui/icons-material', () => ({
  CheckCircleOutline: () => null,
  Clear: () => null,
  GroupAdd: () => null,
  Search: () => null,
  SyncAlt: () => null,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useLocation: () => ({ pathname: '/search', state: null }),
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
  ConfirmDialog: () => null,
}));

vi.mock('../RestaurantSearchPage/RestaurantSearchPage', () => ({
  RestaurantSearchContent: () => <div>restaurant-search-content</div>,
}));

const setupSupabase = () => {
  supabaseMock.from.mockImplementation((table: string) => {
    if (table === 'follows') {
      return {
        select: () => ({
          or: async () => ({ data: [], error: null }),
        }),
      };
    }

    if (table === 'profiles') {
      return {
        select: () => ({
          ilike: () => ({
            limit: () => ({
              neq: async () => ({
                data: [
                  {
                    id: 'target-1',
                    username: 'targetuser',
                    display_name: 'Target User',
                    avatar_url: null,
                    equipped_frame: null,
                    bio: 'hola',
                  },
                ],
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

const renderSearchPage = () => {
  const session: MockSession = { user: { id: 'user-1' } };
  return render(
    <SearchPage
      session={session as never}
      theme="light"
      onRequireLogin={() => {}}
    />
  );
};

describe('SearchPage functional flows', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
    userProfileState.open = false;
    userProfileState.userId = null;
    setupSupabase();
  });

  it('searches users and opens the profile modal', async () => {
    const user = userEvent.setup();
    renderSearchPage();

    await user.type(screen.getByRole('searchbox'), 'ta');
    expect(await screen.findByText('targetuser')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'info' }));
    expect(userProfileState.open).toBe(true);
    expect(userProfileState.userId).toBe('target-1');
  });

  it('shows restaurant search content from the restaurants tab', async () => {
    const user = userEvent.setup();
    renderSearchPage();

    await user.click(screen.getByRole('tab', { name: 'Restaurants' }));
    expect(screen.getByText('restaurant-search-content')).toBeInTheDocument();
  });
});
