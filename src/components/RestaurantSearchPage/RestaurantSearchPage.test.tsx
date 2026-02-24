import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RestaurantSearchPage } from './RestaurantSearchPage';

type MockSession = {
  user: {
    id: string;
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
    pathname: '/restaurants',
    state: null as { selectedRestaurantId?: string; selectedRestaurantName?: string } | null,
  },
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

vi.mock('../common/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../common/PageHeader', () => ({
  PageHeader: ({ title }: { title: ReactNode }) => <h1>{title}</h1>,
}));

vi.mock('../FeedTabs/FeedTabs', () => ({
  FeedTabs: ({ restaurantIdFilter, focusUserId, onOpenEntry }: {
    restaurantIdFilter: string;
    focusUserId: string | null;
    onOpenEntry: (entryId: string) => void;
  }) => (
    <div>
      <span>{`feedtabs-${restaurantIdFilter}-${focusUserId}`}</span>
      <button type="button" onClick={() => onOpenEntry('entry-1')}>open-entry</button>
    </div>
  ),
}));

vi.mock('../AddEntryModal/AddEntryModal', () => ({
  AddEntryModal: ({ open, onSaved, onClose }: { open: boolean; onSaved: () => void; onClose: () => void }) => (
    <div>
      {open ? <span>add-modal-open</span> : null}
      <button type="button" onClick={onSaved}>modal-save</button>
      <button type="button" onClick={onClose}>modal-close</button>
    </div>
  ),
}));

const makeThenableQuery = <T,>(payload: T) => {
  const query = Promise.resolve(payload) as Promise<T> & {
    order: () => typeof query;
    limit: () => typeof query;
    or: () => typeof query;
  };
  query.order = () => query;
  query.limit = () => query;
  query.or = () => query;
  return query;
};

const setupSupabase = () => {
  supabaseMock.from.mockImplementation((table: string) => {
    if (table === 'follows') {
      return {
        select: () => ({
          eq: async (column: string) => {
            if (column === 'follower_id') {
              return { data: [{ following_id: 'friend-1' }], error: null };
            }
            return { data: [{ follower_id: 'friend-1' }], error: null };
          },
        }),
      };
    }

    if (table === 'restaurants') {
      return {
        select: () =>
          makeThenableQuery({
            data: [{ id: 'r1', name: 'Burger Town' }],
            error: null,
          }),
      };
    }

    if (table === 'entries') {
      return {
        select: (_columns: string, options?: { count?: string; head?: boolean }) => {
          if (options?.head) {
            return {
              eq: () => ({
                eq: async () => ({ count: 2, error: null }),
              }),
            };
          }
          return {
            in: async () => ({
              data: [{ restaurant_id: 'r1', user_id: 'user-1', visibility: 'public' }],
              error: null,
            }),
          };
        },
      };
    }

    if (table === 'profiles') {
      return {
        select: () => ({
          in: async () => ({
            data: [{ id: 'friend-1', is_private: false }],
            error: null,
          }),
        }),
      };
    }

    return {
      select: () =>
        makeThenableQuery({
          data: [],
          error: null,
        }),
    };
  });
};

describe('RestaurantSearchPage functional flows', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    supabaseMock.from.mockReset();
    routerState.pathname = '/restaurants';
    routerState.state = null;
    setupSupabase();
  });

  it('shows search results, selects restaurant and opens a post', async () => {
    const user = userEvent.setup();
    const session: MockSession = { user: { id: 'user-1' } };

    render(<RestaurantSearchPage session={session as never} theme="light" />);
    await user.click(await screen.findByRole('button', { name: /Burger Town/i }, { timeout: 4000 }));

    expect(await screen.findByText('Restaurante seleccionado')).toBeInTheDocument();
    expect(screen.getByText('feedtabs-r1-user-1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'open-entry' }));
    expect(navigateMock).toHaveBeenCalledWith('/posts/entry-1', { state: { returnTo: '/restaurants' } });
  });

  it('hydrates selected restaurant from location state and clears route state', async () => {
    const session: MockSession = { user: { id: 'user-1' } };
    routerState.state = {
      selectedRestaurantId: 'r1',
      selectedRestaurantName: 'Burger Town',
    };

    render(<RestaurantSearchPage session={session as never} theme="light" />);

    expect(await screen.findByText('Restaurante seleccionado')).toBeInTheDocument();
    expect(navigateMock).toHaveBeenCalledWith('/restaurants', { replace: true, state: {} });
  });

  it('opens and closes add entry modal from selected restaurant view', async () => {
    const user = userEvent.setup();
    const session: MockSession = { user: { id: 'user-1' } };

    render(<RestaurantSearchPage session={session as never} theme="light" />);
    await user.click(await screen.findByRole('button', { name: /Burger Town/i }, { timeout: 4000 }));

    await user.click(screen.getByRole('button', { name: 'common.addEntry' }));
    expect(screen.getByText('add-modal-open')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'modal-save' }));
    expect(screen.queryByText('add-modal-open')).not.toBeInTheDocument();
  });
});
