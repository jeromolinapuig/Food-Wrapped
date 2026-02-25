import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserProfileModal } from './UserProfileModal';
import { supabase } from '../../lib/supabaseClient';

type QueryResult = { data?: unknown; error?: { message: string } | null };

function createQuery(result: QueryResult) {
  const query = {
    data: result.data ?? null,
    error: result.error ?? null,
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    or: vi.fn(() => query),
    single: vi.fn(() => ({ data: result.data ?? null, error: result.error ?? null })),
    insert: vi.fn(() => query),
    delete: vi.fn(() => query),
  };
  return query;
}

const tableQueues = new Map<string, QueryResult[]>();
function setTableResponses(table: string, responses: QueryResult[]) {
  tableQueues.set(table, [...responses]);
}

vi.mock('@mui/icons-material', () => ({
  CheckCircleOutline: () => null,
  Close: () => null,
  GroupAdd: () => null,
}));

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('UserProfileModal', () => {
  beforeEach(() => {
    const fromMock = supabase.from as unknown as ReturnType<typeof vi.fn>;
    fromMock.mockReset();
    fromMock.mockImplementation((table: string) => {
      const queue = tableQueues.get(table) ?? [];
      const next = queue.length ? queue.shift() : { data: [], error: null };
      return createQuery(next ?? { data: [], error: null });
    });
    tableQueues.clear();
  });

  it('en guest muestra mensaje para iniciar sesión', async () => {
    setTableResponses('profiles', [
      {
        data: { id: 'u2', username: 'bob', display_name: 'Bob', avatar_url: null, bio: 'bio', is_private: false },
        error: null,
      },
    ]);
    render(
      <UserProfileModal open userId="u2" session={null} onClose={() => {}} />
    );

    expect(await screen.findByText('userProfileModal.loginToFollow')).toBeInTheDocument();
  });

  it('permite seguir usuario y notifica cambio', async () => {
    setTableResponses('profiles', [
      {
        data: { id: 'u2', username: 'bob', display_name: 'Bob', avatar_url: null, bio: 'bio', is_private: false },
        error: null,
      },
    ]);
    setTableResponses('follows', [
      { data: [], error: null },
      { data: { id: 33 }, error: null },
    ]);
    const onFollowChange = vi.fn();
    render(
      <UserProfileModal
        open
        userId="u2"
        session={{ user: { id: 'me' } } as never}
        onClose={() => {}}
        onFollowChange={onFollowChange}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: 'userProfileModal.follow' }));

    await waitFor(() => {
      expect(onFollowChange).toHaveBeenCalledWith('u2', true);
    });
  });
});
