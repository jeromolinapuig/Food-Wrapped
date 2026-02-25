import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FollowListModal } from './FollowListModal';
import { supabase } from '../../lib/supabaseClient';

type QueryResult = { data?: unknown; error?: { message: string } | null };

function createQuery(result: QueryResult) {
  const query = {
    data: result.data ?? null,
    error: result.error ?? null,
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    delete: vi.fn(() => query),
    single: vi.fn(() => ({ data: result.data ?? null, error: result.error ?? null })),
  };
  return query;
}

const tableQueues = new Map<string, QueryResult[]>();
function setTableResponses(table: string, responses: QueryResult[]) {
  tableQueues.set(table, [...responses]);
}

vi.mock('@mui/icons-material', () => ({
  Close: () => null,
  GroupAdd: () => null,
  CheckCircleOutline: () => null,
  Clear: () => null,
}));

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(() => ({ id: 'c1' })),
    })),
    removeChannel: vi.fn(),
  },
}));

describe('FollowListModal', () => {
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

  it('carga lista following y permite dejar de seguir con confirmación', async () => {
    setTableResponses('follows', [
      { data: [{ id: 10, follower_id: 'me', following_id: 'u2' }], error: null },
      { data: [], error: null },
      { data: [], error: null },
    ]);
    setTableResponses('profiles', [
      { data: [{ id: 'u2', username: 'bob', display_name: 'Bob', avatar_url: null, bio: 'bio' }], error: null },
    ]);

    const onFollowingDelta = vi.fn();
    render(
      <FollowListModal
        open
        mode="following"
        currentUserId="me"
        onClose={() => {}}
        onFollowingDelta={onFollowingDelta}
      />
    );

    expect(await screen.findByText('@bob')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'followList.unfollow' })[0] as HTMLElement);
    fireEvent.click(screen.getAllByRole('button', { name: 'followList.unfollow' }).at(-1) as HTMLElement);

    await waitFor(() => {
      expect(onFollowingDelta).toHaveBeenCalledWith(-1);
    });
  });
});
