import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';
import { supabase } from '../../lib/supabaseClient';

const navigateMock = vi.fn();
const routerLocation = { pathname: '/dashboard', search: '' };

vi.mock('@mui/icons-material', () => ({
  EmojiEvents: () => null,
  Euro: () => null,
  House: () => null,
  LocalDining: () => null,
  LunchDining: () => null,
  Notifications: () => null,
  Star: () => null,
}));

type QueryResult = { data?: unknown; error?: unknown };

function createQuery(result: QueryResult) {
  const query = {
    data: result.data ?? null,
    error: result.error ?? null,
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    gte: vi.fn(() => query),
    lt: vi.fn(() => query),
    order: vi.fn(() => query),
    in: vi.fn(() => query),
    neq: vi.fn(() => query),
    limit: vi.fn(() => query),
    delete: vi.fn(() => query),
    single: vi.fn(() => ({ data: result.data ?? null, error: result.error ?? null })),
  };
  return query;
}

const tableQueues = new Map<string, QueryResult[]>();

function setTableResponses(table: string, responses: QueryResult[]) {
  tableQueues.set(table, [...responses]);
}

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useLocation: () => routerLocation,
}));

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { user_metadata: { username: 'meta-user' } } },
        error: null,
      }),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(() => ({ id: 'channel-id' })),
    })),
    removeChannel: vi.fn(),
  },
}));

vi.mock('../../context/PreferencesContext', () => ({
  usePreferences: () => ({
    currency: 'EUR',
    formatCurrency: (amount: number) => `EUR ${amount.toFixed(2)}`,
    convertAmount: (amount: number) => amount,
  }),
}));

vi.mock('../../utils/useRevalidateOnFocus', () => ({
  useRevalidateOnFocus: vi.fn(),
}));

vi.mock('../common/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

vi.mock('../common/PageHeader', () => ({
  PageHeader: ({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {actions}
    </header>
  ),
}));

vi.mock('../StatCard/StatCard', () => ({
  StatCard: ({ label, value }: { label: string; value: string }) => <div data-testid={`stat-${label}`}>{value}</div>,
}));

vi.mock('../AddEntryModal/AddEntryModal', () => ({
  AddEntryModal: ({ open }: { open: boolean }) => <div>{open ? 'add-modal-open' : 'add-modal-closed'}</div>,
}));

vi.mock('../FeedTabs/FeedTabs', () => ({
  FeedTabs: (props: {
    onOpenEntry?: (entryId: string) => void;
  }) => {
    return (
      <div>
        {props.onOpenEntry ? (
          <button type="button" onClick={() => props.onOpenEntry?.('entry-42')}>
            open-entry
          </button>
        ) : null}
      </div>
    );
  },
}));

vi.mock('../NotificationsDrawer/NotificationsDrawer', () => ({
  NotificationsDrawer: ({ open }: { open: boolean }) => <div>{open ? 'notifications-open' : 'notifications-closed'}</div>,
}));

vi.mock('../UserProfileModal/UserProfileModal', () => ({
  UserProfileModal: () => null,
}));

vi.mock('../GroupInvitesModal/GroupInvitesModal', () => ({
  GroupInvitesModal: () => null,
}));

vi.mock('../common/ConfirmDialog', () => ({
  ConfirmDialog: ({ open, title }: { open: boolean; title: string }) => (open ? <div>{title}</div> : null),
}));

describe('Dashboard', () => {
  beforeEach(() => {
    const fromMock = supabase.from as unknown as ReturnType<typeof vi.fn>;
    navigateMock.mockReset();
    routerLocation.pathname = '/dashboard';
    routerLocation.search = '';
    fromMock.mockReset();
    fromMock.mockImplementation((table: string) => {
      const queue = tableQueues.get(table) ?? [];
      const next = queue.length ? queue.shift() : { data: [], error: null };
      return createQuery(next ?? { data: [], error: null });
    });
    tableQueues.clear();
    sessionStorage.clear();
    localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('calcula y muestra estadísticas principales', async () => {
    setTableResponses('entries', [
      {
        data: [
          {
            id: 'e1',
            datetime: '2026-02-10T10:00:00.000Z',
            rating: 4,
            price: 10,
            currency: 'EUR',
            is_burger: true,
            burger_origin: 'restaurant',
            meat_type: 'beef',
            restaurant: { name: 'Burger Place' },
            burger: { name: 'Cheese', meat_type: 'beef' },
          },
          {
            id: 'e2',
            datetime: '2026-02-12T11:00:00.000Z',
            rating: 5,
            price: 8,
            currency: 'EUR',
            is_burger: true,
            burger_origin: 'homemade',
            meat_type: 'chicken',
            restaurant: null,
            burger: { name: 'Home', meat_type: 'chicken' },
          },
        ],
        error: null,
      },
      { data: [], error: null },
    ]);
    setTableResponses('entry_bookmarks', [{ data: [], error: null }]);
    setTableResponses('profiles', [{ data: { username: 'canon-user', display_name: 'Canon User' }, error: null }]);
    setTableResponses('follows', [{ data: [], error: null }]);
    setTableResponses('group_invitations', [{ data: [], error: null }]);

    render(
      <Dashboard
        session={{ user: { id: 'viewer-1', email: 'viewer@example.com', user_metadata: {} } } as never}
        theme="light"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('stat-dashboard.burgers')).toHaveTextContent('1');
    });
    expect(screen.getByTestId('stat-dashboard.homemade')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-dashboard.avgRating')).toHaveTextContent('4.5');
    expect(screen.getByTestId('stat-dashboard.favorite')).toHaveTextContent('Burger Place');
    expect(screen.getByTestId('stat-dashboard.totalSpent')).toHaveTextContent('EUR 18.00');
  });

  it('abre el modal de creación y navega al abrir un post', async () => {
    setTableResponses('entries', [{ data: [], error: null }, { data: [], error: null }]);
    setTableResponses('entry_bookmarks', [{ data: [], error: null }]);
    setTableResponses('profiles', [{ data: { username: 'canon-user', display_name: null }, error: null }]);
    setTableResponses('follows', [{ data: [], error: null }]);
    setTableResponses('group_invitations', [{ data: [], error: null }]);

    render(
      <Dashboard
        session={{ user: { id: 'viewer-1', email: 'viewer@example.com', user_metadata: {} } } as never}
        theme="light"
      />
    );

    expect(await screen.findByText('add-modal-closed')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'common.addEntry' }));
    expect(screen.getByText('add-modal-open')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'open-entry' }));
    expect(navigateMock).toHaveBeenCalledWith('/posts/entry-42', { state: { returnTo: '/dashboard' } });
  });

  it('abre el modal de creación desde el destino de una notificación', async () => {
    routerLocation.pathname = '/';
    routerLocation.search = '?action=add-entry';
    setTableResponses('entries', [{ data: [], error: null }, { data: [], error: null }]);
    setTableResponses('entry_bookmarks', [{ data: [], error: null }]);
    setTableResponses('profiles', [{ data: { username: 'canon-user', display_name: null }, error: null }]);
    setTableResponses('follows', [{ data: [], error: null }]);
    setTableResponses('group_invitations', [{ data: [], error: null }]);

    render(
      <Dashboard
        session={{ user: { id: 'viewer-1', email: 'viewer@example.com', user_metadata: {} } } as never}
        theme="light"
      />
    );

    expect(await screen.findByText('add-modal-open')).toBeInTheDocument();
    expect(navigateMock).toHaveBeenCalledWith('/', { replace: true });
  });
});
