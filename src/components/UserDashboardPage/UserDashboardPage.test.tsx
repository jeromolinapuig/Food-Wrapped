import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserDashboardPage } from './UserDashboardPage';
import { supabase } from '../../lib/supabaseClient';

const navigateMock = vi.fn();

vi.mock('@mui/icons-material', () => ({
  EmojiEvents: () => null,
  Euro: () => null,
  House: () => null,
  LunchDining: () => null,
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
    limit: vi.fn(() => query),
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

vi.mock('../../utils/useRevalidateOnFocus', () => ({
  useRevalidateOnFocus: vi.fn(),
}));

vi.mock('../../context/PreferencesContext', () => ({
  usePreferences: () => ({
    currency: 'EUR',
    formatCurrency: (amount: number) => `EUR ${amount.toFixed(2)}`,
    convertAmount: (amount: number) => amount,
  }),
}));

vi.mock('../common/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../common/PageHeader', () => ({
  PageHeader: ({ title, subtitle, leading }: { title: string; subtitle: string; leading?: ReactNode }) => (
    <header>
      {leading}
      <h1>{title}</h1>
      <p>{subtitle}</p>
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
  StatCard: ({ label, value }: { label: string; value: string }) => <div data-testid={`stat-${label}`}>{value}</div>,
}));

vi.mock('../FeedTabs/FeedTabs', () => ({
  FeedTabs: (props: {
    monthFilter?: string[];
    onOpenEntry?: (entryId: string) => void;
  }) => {
    return props.onOpenEntry ? (
      <>
        <div data-testid="feed-month-filter">{props.monthFilter?.join(',')}</div>
        <button type="button" onClick={() => props.onOpenEntry?.('entry-55')}>
          open-user-entry
        </button>
      </>
    ) : (
      <div>feed-tabs-header</div>
    );
  },
}));

describe('UserDashboardPage', () => {
  beforeEach(() => {
    const fromMock = supabase.from as unknown as ReturnType<typeof vi.fn>;
    navigateMock.mockReset();
    fromMock.mockReset();
    fromMock.mockImplementation((table: string) => {
      const queue = tableQueues.get(table) ?? [];
      const next = queue.length ? queue.shift() : { data: [], error: null };
      return createQuery(next ?? { data: [], error: null });
    });
    tableQueues.clear();
  });

  it('bloquea contenido cuando el perfil es privado y no hay viewer', async () => {
    setTableResponses('profiles', [
      {
        data: {
          username: 'private-user',
          display_name: 'Private User',
          avatar_url: null,
          is_private: true,
        },
        error: null,
      },
    ]);
    setTableResponses('entries', [{ data: [], error: null }]);

    render(
      <UserDashboardPage
        session={null}
        theme="light"
        onToggleTheme={() => {}}
        onNavigate={() => {}}
        userId="u-private"
        onBack={() => {}}
      />
    );

    expect(await screen.findByText('Este perfil es privado.')).toBeInTheDocument();
  });

  it('muestra estadísticas públicas y navega al abrir un post', async () => {
    setTableResponses('profiles', [
      {
        data: {
          username: 'public-user',
          display_name: 'Public User',
          avatar_url: null,
          is_private: false,
        },
        error: null,
      },
    ]);
    setTableResponses('entries', [
      {
        data: [
          {
            id: 'e1',
            datetime: '2026-02-10T10:00:00.000Z',
            rating: 4,
            price: 9,
            is_burger: true,
            burger_origin: 'restaurant',
            meat_type: 'beef',
            restaurant_id: 'r1',
            burger_id: 'b1',
            restaurant: { name: 'Burger Bar' },
            burger: { name: 'Classic', meat_type: 'beef' },
          },
          {
            id: 'e2',
            datetime: '2026-02-11T10:00:00.000Z',
            rating: 5,
            price: 6,
            is_burger: true,
            burger_origin: 'homemade',
            meat_type: 'chicken',
            restaurant_id: null,
            burger_id: null,
            restaurant: null,
            burger: { name: 'Home', meat_type: 'chicken' },
          },
        ],
        error: null,
      },
    ]);

    render(
      <UserDashboardPage
        session={{ user: { id: 'viewer-1' } } as never}
        theme="light"
        onToggleTheme={() => {}}
        onNavigate={() => {}}
        userId="u-public"
        onBack={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('stat-dashboard.burgers')).toHaveTextContent('1');
    });
    expect(screen.getByTestId('stat-dashboard.avgRating')).toHaveTextContent('4.5');
    expect(screen.getByTestId('stat-dashboard.favorite')).toHaveTextContent('Burger Bar');
    expect(screen.getByTestId('stat-Hamburguesas caseras')).toHaveTextContent('1');
    expect(screen.getByTestId('feed-month-filter')).toHaveTextContent('all');

    fireEvent.click(screen.getByRole('button', { name: 'open-user-entry' }));
    expect(navigateMock).toHaveBeenCalledWith('/posts/entry-55', {
      state: { returnTo: '/users/u-public' },
    });
  });
});
