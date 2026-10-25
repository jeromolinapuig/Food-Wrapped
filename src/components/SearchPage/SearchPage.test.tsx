import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { Link, MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
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
  UserProfileModal: ({ open, userId, onViewPosts }: {
    open: boolean; userId: string | null;
    onViewPosts: (user: { id: string; username: string | null; displayName: string | null }) => void;
  }) => {
    userProfileState.open = open;
    userProfileState.userId = userId;
    return open ? <div>{`profile-modal-${userId}`}<button type="button"
      onClick={() => onViewPosts({ id: userId!, username: 'targetuser', displayName: null })}>View user posts</button></div> : null;
  },
}));

vi.mock('../common/ConfirmDialog', () => ({
  ConfirmDialog: () => null,
}));

vi.mock('../RestaurantSearchPage/RestaurantSearchPage', () => ({
  RestaurantSearchContent: () => <div>restaurant-search-content<Link to="/details">Open restaurant post</Link></div>,
}));

vi.mock('../BurgerCatalog/BurgerCatalog', () => ({
  BurgerExplore: () => <Link to="/details">Open burger</Link>,
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

const renderSearchPage = (initialEntry: string | { pathname: string; state: { activeSearchTab: string } } = '/search') => {
  const session: MockSession = { user: { id: 'user-1' } };
  function SearchRoute() {
    const navigate = useNavigate();
    return <SearchPage
      session={session as never}
      theme="light"
      onRequireLogin={() => {}}
      onOpenUserDashboard={() => navigate('/details')}
    />;
  }
  function DetailRoute() {
    const navigate = useNavigate();
    return <><button type="button" onClick={() => navigate(-1)}>Browser back</button>
      <button type="button" onClick={() => navigate('/search')}>Return to search</button></>;
  }
  return render(<MemoryRouter initialEntries={[initialEntry]}><Routes>
    <Route path="/search" element={<SearchRoute />} /><Route path="/details" element={<DetailRoute />} />
  </Routes></MemoryRouter>);
};

describe('SearchPage functional flows', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
    userProfileState.open = false;
    userProfileState.userId = null;
    sessionStorage.removeItem('bw-search-active-tab');
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

    await user.click(screen.getByRole('tab', { name: 'Restaurantes' }));
    expect(screen.getByText('restaurant-search-content')).toBeInTheDocument();
  });

  it.each([
    ['users', 'Usuarios'], ['restaurants', 'Restaurantes'], ['burgers', 'Burgers'],
  ])('restores the %s category when returning from a result', async (category, label) => {
    const user = userEvent.setup(); renderSearchPage();
    await user.click(screen.getByRole('tab', { name: label }));
    if (category === 'users') {
      await user.type(screen.getByRole('searchbox'), 'ta');
      await screen.findByText('targetuser');
      await user.click(screen.getByRole('button', { name: 'info' }));
      await user.click(screen.getByRole('button', { name: 'View user posts' }));
    } else {
      await user.click(screen.getByRole('link', { name: category === 'burgers' ? 'Open burger' : 'Open restaurant post' }));
    }
    // Burger detail uses browser history; user/post routes navigate explicitly to Search.
    await user.click(screen.getByRole('button', { name: category === 'burgers' ? 'Browser back' : 'Return to search' }));
    expect(screen.getByRole('tab', { name: label })).toHaveAttribute('aria-selected', 'true');
  });

  it.each([
    ['users', 'Usuarios'], ['restaurants', 'Restaurantes'], ['burgers', 'Burgers'],
  ])('honours an explicit %s category over the remembered category', (category, label) => {
    sessionStorage.setItem('bw-search-active-tab', category === 'burgers' ? 'restaurants' : 'burgers');
    renderSearchPage({ pathname: '/search', state: { activeSearchTab: category } });
    expect(screen.getByRole('tab', { name: label })).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps a newly selected category when going back to an older explicit category link', async () => {
    const user = userEvent.setup();
    renderSearchPage({ pathname: '/search', state: { activeSearchTab: 'restaurants' } });
    await user.click(screen.getByRole('tab', { name: 'Burgers' }));
    await user.click(screen.getByRole('link', { name: 'Open burger' }));
    await user.click(screen.getByRole('button', { name: 'Browser back' }));
    expect(screen.getByRole('tab', { name: 'Burgers' })).toHaveAttribute('aria-selected', 'true');
  });

  it('ignores invalid remembered categories', () => {
    sessionStorage.setItem('bw-search-active-tab', 'invalid'); renderSearchPage();
    expect(screen.getByRole('tab', { name: 'Usuarios' })).toHaveAttribute('aria-selected', 'true');
  });

  it('does not block category selection when its saved preference is unavailable', async () => {
    const user = userEvent.setup();
    const read = Storage.prototype.getItem, write = Storage.prototype.setItem;
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
      if (key === 'bw-search-active-tab') throw new Error('Preference unavailable');
      return read.call(this, key);
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === 'bw-search-active-tab') throw new Error('Preference unavailable');
      return write.call(this, key, value);
    });
    try {
      renderSearchPage(); await user.click(screen.getByRole('tab', { name: 'Restaurantes' }));
      expect(screen.getByText('restaurant-search-content')).toBeInTheDocument();
    } finally { getItem.mockRestore(); setItem.mockRestore(); }
  });
});
