import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobalRankingPage } from './GlobalRankingPage';
import { supabase } from '../../lib/supabaseClient';

const navigateMock = vi.fn();

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
    limit: vi.fn(() => query),
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

vi.mock('../../lib/i18n', () => ({
  i18n: { language: 'es' },
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
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock('../StatCard/StatCard', () => ({
  StatCard: ({
    label,
    onClick,
    isActive,
  }: {
    label: string;
    onClick?: () => void;
    isActive?: boolean;
  }) => (
    <button type="button" data-testid={`stat-${label}`} data-active={isActive ? 'yes' : 'no'} onClick={onClick}>
      {label}
    </button>
  ),
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
      <div>
        <div>modal-user-{userId}</div>
        <button type="button" onClick={() => onViewPosts?.({ id: userId ?? '', username: 'ranked', displayName: null })}>
          modal-view-posts
        </button>
      </div>
    ) : null,
}));

describe('GlobalRankingPage', () => {
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

  it('carga y muestra ranking global con usuarios públicos', async () => {
    setTableResponses('entries', [
      {
        data: [
          {
            user_id: 'u1',
            datetime: '2026-02-01T10:00:00.000Z',
            price: 22,
            currency: 'EUR',
            is_burger: true,
          },
          {
            user_id: 'u2',
            datetime: '2026-02-02T10:00:00.000Z',
            price: 10,
            currency: 'EUR',
            is_burger: true,
          },
        ],
        error: null,
      },
    ]);
    setTableResponses('profiles', [
      {
        data: [
          { id: 'u1', username: 'alice', display_name: 'Alice', avatar_url: null },
          { id: 'u2', username: 'bob', display_name: 'Bob', avatar_url: null },
        ],
        error: null,
      },
    ]);

    render(<GlobalRankingPage session={{ user: { id: 'viewer-1' } } as never} />);

    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('EUR 22.00')).toBeInTheDocument();
  });

  it('abre perfil desde ranking y permite navegar a posts del usuario', async () => {
    setTableResponses('entries', [
      {
        data: [
          {
            user_id: 'u1',
            datetime: '2026-02-01T10:00:00.000Z',
            price: 12,
            currency: 'EUR',
            is_burger: true,
          },
        ],
        error: null,
      },
    ]);
    setTableResponses('profiles', [
      {
        data: [{ id: 'u1', username: 'alice', display_name: 'Alice', avatar_url: null }],
        error: null,
      },
    ]);

    render(<GlobalRankingPage session={{ user: { id: 'viewer-1' } } as never} />);

    fireEvent.click(await screen.findByRole('button', { name: /Alice/i }));
    expect(screen.getByText('modal-user-u1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'modal-view-posts' }));
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/users/u1', {
        state: { returnTo: '/ranking', returnProfileUserId: null },
      });
    });
  });
});
