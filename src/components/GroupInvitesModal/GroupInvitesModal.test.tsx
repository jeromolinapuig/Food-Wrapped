import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GroupInvitesModal } from './GroupInvitesModal';
import { supabase } from '../../lib/supabaseClient';

type QueryResult = { data?: unknown; error?: { message: string } | null };

function createQuery(result: QueryResult) {
  const query = {
    data: result.data ?? null,
    error: result.error ?? null,
    insert: vi.fn(() => query),
    delete: vi.fn(() => query),
    eq: vi.fn(() => query),
  };
  return query;
}

const tableQueues = new Map<string, QueryResult[]>();
function setTableResponses(table: string, responses: QueryResult[]) {
  tableQueues.set(table, [...responses]);
}

vi.mock('@mui/icons-material', () => ({
  Close: () => null,
}));

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('GroupInvitesModal', () => {
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

  it('acepta invitación y notifica cambios', async () => {
    setTableResponses('group_members', [{ data: [], error: null }]);
    setTableResponses('group_invitations', [{ data: [], error: null }]);

    const onChanged = vi.fn();
    render(
      <GroupInvitesModal
        currentUserId="me"
        currentGroupCount={0}
        maxGroups={6}
        invites={[
          {
            id: 'i1',
            groupId: 'g1',
            groupName: 'Grupo 1',
            inviterId: 'u2',
            inviterUsername: 'bob',
            inviterDisplayName: 'Bob',
          },
        ]}
        loading={false}
        error={null}
        onClose={() => {}}
        onChanged={onChanged}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'groupInvites.accept' }));
    fireEvent.click(screen.getByRole('button', { name: 'groupInvites.confirm' }));
    await waitFor(() => {
      expect(onChanged).toHaveBeenCalledTimes(1);
    });
  });
});
