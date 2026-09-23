import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';
import { supabase } from '../../lib/supabaseClient';

const navigateMock = vi.fn();
const routerLocation = { pathname: '/dashboard', search: '' };
const localStorageMock = (() => {
  const values = new Map<string, string>();
  return {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, String(value)),
    get length() {
      return values.size;
    },
  } satisfies Storage;
})();

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: localStorageMock,
});

vi.mock('@mui/icons-material', () => ({
  EmojiEvents: () => null,
  Euro: () => null,
  House: () => null,
  LunchDining: () => null,
  Notifications: () => null,
  Star: () => null,
}));

vi.mock('border-beam', () => ({
  BorderBeam: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className} data-beam="test-beam">
      {children}
    </div>
  ),
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
const entryQueries: ReturnType<typeof createQuery>[] = [];

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
  AddEntryModal: ({
    open,
    mode,
    onSaved,
    onClose,
  }: {
    open: boolean;
    mode: 'create' | 'edit';
    onSaved: () => Promise<void> | void;
    onClose: () => void;
  }) => (
    <div data-testid="entry-modal" data-mode={mode}>
      {open ? 'add-modal-open' : 'add-modal-closed'}
      {open ? (
        <>
          <button type="button" onClick={() => void onSaved()}>
            save-entry
          </button>
          <button type="button" onClick={onClose}>
            close-entry
          </button>
        </>
      ) : null}
    </div>
  ),
}));

vi.mock('../FeedTabs/FeedTabs', () => ({
  FeedTabs: (props: {
    onOpenEntry?: (entryId: string) => void;
    refreshKey?: number;
    onEditEntry?: (entry: {
      id: string;
      datetime: string;
      rating: number;
      price: number;
      isBurger: boolean;
    }) => void;
  }) => {
    return (
      <div>
        <span data-testid="feed-refresh">{props.refreshKey ?? 0}</span>
        {props.onOpenEntry ? (
          <button type="button" onClick={() => props.onOpenEntry?.('entry-42')}>
            open-entry
          </button>
        ) : null}
        {props.onEditEntry ? (
          <button
            type="button"
            onClick={() =>
              props.onEditEntry?.({
                id: 'entry-42',
                datetime: '2026-02-10T10:00:00.000Z',
                rating: 4,
                price: 10,
                isBurger: true,
              })
            }
          >
            edit-entry
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
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-23T12:00:00Z'));
    entryQueries.length = 0;
    const fromMock = supabase.from as unknown as ReturnType<typeof vi.fn>;
    navigateMock.mockReset();
    routerLocation.pathname = '/dashboard';
    routerLocation.search = '';
    fromMock.mockReset();
    fromMock.mockImplementation((table: string) => {
      const queue = tableQueues.get(table) ?? [];
      const next = queue.length ? queue.shift() : { data: [], error: null };
      const query = createQuery(next ?? { data: [], error: null });
      if (table === 'entries') entryQueries.push(query);
      return query;
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

    expect(screen.queryByRole('button', { name: /Mi top burgers|myTopBurgers\.title/i })).not.toBeInTheDocument();
    const summaryTitle = screen.getAllByText(/Resumen 2026|burgerCalendar\.summaryTitle/i)[1];
    expect(summaryTitle.closest('button')?.closest('[data-beam]'))
      .toHaveClass('bw-annual-summary-beam');
    [
      /Fecha|dashboard\.dateFilter/i,
      /Precio|dashboard\.priceFilter/i,
      /Tipo|dashboard\.type/i,
    ].forEach((filterName) => {
      expect(screen.getByRole('button', { name: filterName }).closest('[data-beam]')).toBeNull();
    });
  });

  afterEach(() => vi.useRealTimers());

  it('en 2026 consulta el año actual y oculta la navegación anual', async () => {
    render(<Dashboard session={{ user: { id: 'viewer-1', email: 'viewer@example.com', user_metadata: {} } } as never} theme="light" />);
    await waitFor(() => expect(entryQueries).toHaveLength(1));
    expect(entryQueries[0].gte).toHaveBeenCalledWith('datetime', '2026-01-01');
    expect(entryQueries[0].lt).toHaveBeenCalledWith('datetime', '2027-01-01');
    expect(screen.queryByRole('navigation', { name: 'dashboard.yearNavigation' })).not.toBeInTheDocument();
    expect(screen.getAllByText(/burgerCalendar.summaryTitle/)).toHaveLength(2);
  });

  it('en 2027 oculta la navegación cuando no hay entradas anteriores', async () => {
    vi.setSystemTime(new Date('2027-09-23T12:00:00Z'));
    setTableResponses('entries', [{ data: [], error: null }, { data: [], error: null }]);
    render(<Dashboard session={{ user: { id: 'viewer-1', email: 'viewer@example.com', user_metadata: {} } } as never} theme="light" />);
    await waitFor(() => expect(entryQueries).toHaveLength(2));
    expect(entryQueries[1].gte).toHaveBeenCalledWith('datetime', '2026-01-01');
    expect(entryQueries[1].lt).toHaveBeenCalledWith('datetime', '2027-01-01');
    expect(screen.queryByRole('navigation', { name: 'dashboard.yearNavigation' })).not.toBeInTheDocument();
  });

  it('en 2027 permite consultar 2026, separa las cachés y bloquea años anteriores a 2026', async () => {
    vi.setSystemTime(new Date('2027-09-23T12:00:00Z'));
    const oldEntry = { id: 'old', datetime: '2026-02-10T10:00:00Z', rating: 5, price: 12, is_burger: true, burger_origin: 'restaurant', meat_type: 'beef', restaurant: { name: 'Old' }, burger: null };
    setTableResponses('entries', [{ data: [], error: null }, { data: [{ datetime: oldEntry.datetime }], error: null }, { data: [oldEntry], error: null }]);
    render(<Dashboard session={{ user: { id: 'viewer-1', email: 'viewer@example.com', user_metadata: {} } } as never} theme="light" />);
    await waitFor(() => expect(screen.getByRole('navigation', { name: 'dashboard.yearNavigation' })).toBeInTheDocument());
    expect(sessionStorage.getItem('bw-dashboard-entries-viewer-1-2027')).toBe('[]');
    expect(screen.getByRole('button', { name: 'dashboard.nextYear' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'dashboard.previousYear' }));
    await waitFor(() => expect(screen.getByText('2026')).toBeInTheDocument());
    await waitFor(() => expect(sessionStorage.getItem('bw-dashboard-entries-viewer-1-2026')).toContain('old'));
    expect(entryQueries[2].gte).toHaveBeenCalledWith('datetime', '2026-01-01');
    expect(entryQueries[2].lt).toHaveBeenCalledWith('datetime', '2027-01-01');
    expect(screen.getByRole('button', { name: 'dashboard.previousYear' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'dashboard.nextYear' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'dashboard.nextYear' }));
    expect(screen.getByRole('button', { name: 'dashboard.nextYear' })).toBeDisabled();
    expect(screen.getByTestId('stat-dashboard.burgers')).toHaveTextContent('0');
    expect(sessionStorage.getItem('bw-dashboard-entries-viewer-1-2026')).toContain('old');
    expect(sessionStorage.getItem('bw-dashboard-entries-viewer-1-2027')).toBe('[]');
  });

  it('muestra el error de carga sin conservar estadísticas de otro año', async () => {
    vi.setSystemTime(new Date('2027-09-23T12:00:00Z'));
    const currentEntry = { id: 'current', datetime: '2027-02-10T10:00:00Z', rating: 5, price: 12, is_burger: true, burger_origin: 'restaurant', meat_type: 'beef', restaurant: { name: 'Current' }, burger: null };
    setTableResponses('entries', [{ data: [currentEntry], error: null }, { data: [{ datetime: '2026-02-10T10:00:00Z' }], error: null }, { data: null, error: { message: 'Network error' } }]);
    render(<Dashboard session={{ user: { id: 'viewer-1', email: 'viewer@example.com', user_metadata: {} } } as never} theme="light" />);
    await waitFor(() => expect(screen.getByTestId('stat-dashboard.burgers')).toHaveTextContent('1'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'dashboard.previousYear' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'dashboard.previousYear' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Network error'));
    expect(screen.getByTestId('stat-dashboard.burgers')).toHaveTextContent('0');
    expect(sessionStorage.getItem('bw-dashboard-entries-viewer-1-2026')).toBeNull();
  });

  it('mantiene el modo edición hasta que termina de cerrar tras guardar', async () => {
    setTableResponses('entries', [
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
    ]);
    setTableResponses('entry_bookmarks', [{ data: [], error: null }]);
    setTableResponses('profiles', [
      { data: { username: 'canon-user', display_name: null }, error: null },
    ]);
    setTableResponses('follows', [{ data: [], error: null }]);
    setTableResponses('group_invitations', [{ data: [], error: null }]);

    render(
      <Dashboard
        session={{ user: { id: 'viewer-1', email: 'viewer@example.com', user_metadata: {} } } as never}
        theme="light"
      />
    );

    await screen.findByText('add-modal-closed');
    fireEvent.click(screen.getByRole('button', { name: 'edit-entry' }));
    expect(screen.getByTestId('entry-modal')).toHaveAttribute(
      'data-mode',
      'edit',
    );

    fireEvent.click(screen.getByRole('button', { name: 'save-entry' }));
    await waitFor(() =>
      expect(screen.getByTestId('feed-refresh')).toHaveTextContent('1'),
    );
    expect(screen.getByTestId('entry-modal')).toHaveAttribute(
      'data-mode',
      'edit',
    );

    fireEvent.click(screen.getByRole('button', { name: 'close-entry' }));
    expect(screen.getByText('add-modal-closed')).toBeInTheDocument();
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
