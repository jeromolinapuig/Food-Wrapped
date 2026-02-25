import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GroupManageModal } from './GroupManageModal';
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
    delete: vi.fn(() => query),
    update: vi.fn(() => query),
    match: vi.fn(() => query),
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
  Delete: () => null,
  RadioButtonUnchecked: () => null,
}));

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('GroupManageModal', () => {
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

  it('permite renombrar grupo', async () => {
    setTableResponses('groups', [
      { data: { id: 'g1', owner_id: 'me', name: 'Grupo viejo' }, error: null },
      { data: [], error: null },
    ]);
    setTableResponses('group_members', [{ data: [{ user_id: 'u2' }], error: null }]);
    setTableResponses('profiles', [
      {
        data: [
          { id: 'me', username: 'me', display_name: 'Me', avatar_url: null },
          { id: 'u2', username: 'bob', display_name: 'Bob', avatar_url: null },
        ],
        error: null,
      },
      { data: [], error: null },
    ]);
    setTableResponses('follows', [
      { data: [{ following_id: 'u3' }], error: null },
      { data: [{ follower_id: 'u3' }], error: null },
    ]);

    const onChanged = vi.fn();
    render(
      <GroupManageModal
        currentUserId="me"
        groupId="g1"
        groupName="Grupo viejo"
        onClose={() => {}}
        onChanged={onChanged}
      />
    );

    fireEvent.change(await screen.findByPlaceholderText('groupManage.groupNamePlaceholder'), {
      target: { value: 'Grupo nuevo' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'groupManage.save' }));

    await waitFor(() => {
      expect(onChanged).toHaveBeenCalled();
    });
  });
});
