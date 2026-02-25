import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateGroupModal } from './CreateGroupModal';
import { supabase } from '../../lib/supabaseClient';

type QueryResult = { data?: unknown; error?: { message: string } | null };

function createQuery(result: QueryResult) {
  const query = {
    data: result.data ?? null,
    error: result.error ?? null,
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    insert: vi.fn(() => query),
    single: vi.fn(() => ({ data: result.data ?? null, error: result.error ?? null })),
  };
  return query;
}

const tableQueues = new Map<string, QueryResult[]>();
function setTableResponses(table: string, responses: QueryResult[]) {
  tableQueues.set(table, [...responses]);
}

vi.mock('@mui/icons-material', () => ({
  CheckCircle: () => null,
  Close: () => null,
  RadioButtonUnchecked: () => null,
}));

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('CreateGroupModal', () => {
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

  it('crea grupo e invita amigos seleccionados', async () => {
    setTableResponses('follows', [
      { data: [{ following_id: 'u2' }], error: null },
      { data: [{ follower_id: 'u2' }], error: null },
    ]);
    setTableResponses('profiles', [
      { data: [{ id: 'u2', username: 'bob', display_name: 'Bob', avatar_url: null }], error: null },
    ]);
    setTableResponses('groups', [{ data: { id: 'g1' }, error: null }]);
    setTableResponses('group_invitations', [{ data: [], error: null }]);
    setTableResponses('group_members', [{ data: [], error: null }]);

    const onCreated = vi.fn();
    render(
      <CreateGroupModal
        currentUserId="me"
        currentGroupCount={0}
        maxGroups={6}
        onClose={() => {}}
        onCreated={onCreated}
      />
    );

    fireEvent.change(await screen.findByLabelText('createGroup.groupNameLabel'), { target: { value: 'Mi grupo' } });
    fireEvent.click(screen.getByRole('button', { name: /@bob/i }));
    fireEvent.click(screen.getByRole('button', { name: 'createGroup.createButton' }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledTimes(1);
    });
  });
});
