import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GroupPage } from './GroupPage';
import { supabase } from '../../lib/supabaseClient';

const navigateMock = vi.fn();
const feedTabsSpy = vi.fn();

vi.mock('@mui/icons-material', () => ({
  Euro: () => null,
  LunchDining: () => null,
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
}));

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('../../context/PreferencesContext', () => ({
  usePreferences: () => ({
    currency: 'EUR',
    convertAmount: (amount: number) => amount,
    formatCurrency: (amount: number) => `EUR ${amount.toFixed(2)}`,
  }),
}));

vi.mock('../../utils/useRevalidateOnFocus', () => ({
  useRevalidateOnFocus: vi.fn(),
}));

vi.mock('../common/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../common/PageHeader', () => ({
  PageHeader: ({ title, leading }: { title: string; leading?: ReactNode }) => (
    <header>
      {leading}
      <h1>{title}</h1>
    </header>
  ),
}));

vi.mock('../common/BackButton', () => ({
  BackButton: ({ onClick }: { onClick: () => void }) => (
    <button type="button" onClick={onClick}>
      back
    </button>
  ),
}));

vi.mock('../StatCard/StatCard', () => ({
  StatCard: ({
    label,
    value,
    onClick,
  }: {
    label: string;
    value: string;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick} data-testid={`stat-${label}`}>
      {value}
    </button>
  ),
}));

vi.mock('../FeedTabs/FeedTabs', () => ({
  FeedTabs: (props: {
    onOpenEntry?: (entryId: string) => void;
    onOpenProfile?: (userId: string) => void;
    monthFilter?: string;
    hideMonthFilter?: boolean;
  }) => {
    feedTabsSpy(props);
    return (
      <div>
        <button type="button" onClick={() => props.onOpenEntry?.('entry-77')}>
          open-group-entry
        </button>
        <button type="button" onClick={() => props.onOpenProfile?.('u2')}>
          open-group-profile
        </button>
      </div>
    );
  },
}));

vi.mock('../UserProfileModal/UserProfileModal', () => ({
  UserProfileModal: ({
    open,
    userId,
    onViewPosts,
  }: {
    open: boolean;
    userId: string | null;
    onViewPosts?: (user: { id: string; username: string | null; displayName: string | null }) => void;
  }) =>
    open ? (
      <button type="button" onClick={() => onViewPosts?.({ id: userId ?? '', username: 'member', displayName: null })}>
        modal-go-posts
      </button>
    ) : null,
}));

describe('GroupPage', () => {
  beforeEach(() => {
    const fromMock = supabase.from as unknown as ReturnType<typeof vi.fn>;
    navigateMock.mockReset();
    feedTabsSpy.mockReset();
    fromMock.mockReset();
    fromMock.mockImplementation((table: string) => {
      const queue = tableQueues.get(table) ?? [];
      const next = queue.length ? queue.shift() : { data: [], error: null };
      return createQuery(next ?? { data: [], error: null });
    });
    tableQueues.clear();
  });

  it('muestra mensaje cuando el grupo no existe', async () => {
    setTableResponses('groups', [
      { data: null, error: { code: 'PGRST116', message: 'not found' } },
    ]);

    render(
      <GroupPage
        session={{ user: { id: 'viewer-1' } } as never}
        theme="light"
        onToggleTheme={() => {}}
        groupId="missing-group"
        onBack={() => {}}
      />
    );

    expect(await screen.findByText('groups.groupMissing')).toBeInTheDocument();
  });

  it('carga miembros, cambia a ranking y permite abrir posts de un miembro', async () => {
    setTableResponses('groups', [{ data: { id: 'g1', name: 'Grupo 1', owner_id: 'u1' }, error: null }]);
    setTableResponses('group_members', [{ data: [{ user_id: 'u2' }], error: null }]);
    setTableResponses('profiles', [
      {
        data: [
          { id: 'u1', username: 'alice', display_name: 'Alice', avatar_url: null },
          { id: 'u2', username: 'bob', display_name: 'Bob', avatar_url: null },
        ],
        error: null,
      },
    ]);
    setTableResponses('entries', [
      {
        data: [
          {
            id: 'e1',
            user_id: 'u1',
            datetime: '2026-02-01T10:00:00.000Z',
            rating: 4,
            price: 20,
            currency: 'EUR',
            is_burger: true,
            restaurant_id: 'r1',
            burger_id: 'b1',
            restaurant: { name: 'A' },
            burger: { name: 'A', meat_type: 'beef' },
          },
          {
            id: 'e2',
            user_id: 'u2',
            datetime: '2026-02-02T10:00:00.000Z',
            rating: 5,
            price: 10,
            currency: 'EUR',
            is_burger: true,
            restaurant_id: 'r2',
            burger_id: 'b2',
            restaurant: { name: 'B' },
            burger: { name: 'B', meat_type: 'chicken' },
          },
        ],
        error: null,
      },
    ]);

    render(
      <GroupPage
        session={{ user: { id: 'viewer-1' } } as never}
        theme="light"
        onToggleTheme={() => {}}
        groupId="g1"
        onBack={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Ranking' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Ranking' }));
    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Bob/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'modal-go-posts' }));

    expect(navigateMock).toHaveBeenCalledWith('/users/u2', {
      state: { returnTo: '/groups/g1', returnProfileUserId: null },
    });
    expect(feedTabsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        hideMonthFilter: true,
        monthFilter: 'all',
      })
    );
  });
});
