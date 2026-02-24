import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEntryComments } from './useEntryComments';

type MockSupabase = {
  from: ReturnType<typeof vi.fn>;
};

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {
    from: vi.fn(),
  } satisfies MockSupabase,
}));

vi.mock('../../lib/supabaseClient', () => ({
  supabase: supabaseMock,
}));

const setupSupabase = () => {
  supabaseMock.from.mockImplementation((table: string) => {
    if (table === 'entry_comments') {
      return {
        select: () => ({
          in: () => ({
            order: () => ({
              limit: async () => ({
                data: [
                  { id: 'c1', entry_id: 'e1', user_id: 'u2', body: 'hola', created_at: '2026-01-01T10:00:00.000Z' },
                ],
                error: null,
              }),
            }),
          }),
          eq: () => ({
            order: () => ({
              limit: async () => ({
                data: [
                  { id: 'c1', entry_id: 'e1', user_id: 'u2', body: 'hola', created_at: '2026-01-01T10:00:00.000Z' },
                ],
                error: null,
              }),
            }),
          }),
        }),
        insert: async () => ({ error: null }),
        delete: () => ({
          eq: async () => ({ error: null }),
        }),
      };
    }

    if (table === 'profiles') {
      return {
        select: () => ({
          in: async () => ({
            data: [{ id: 'u2', username: 'user2', display_name: 'User 2', avatar_url: null }],
            error: null,
          }),
        }),
      };
    }

    return {
      select: () => ({
        in: async () => ({ data: [], error: null }),
      }),
    };
  });
};

describe('useEntryComments', () => {
  const entries = [{ id: 'e1' }];

  beforeEach(() => {
    supabaseMock.from.mockReset();
    setupSupabase();
  });

  it('loads preview comments for entries', async () => {
    const { result } = renderHook(() =>
      useEntryComments({
        entries,
        commentMode: 'preview',
        headerOnly: false,
        refreshKey: 0,
        viewerId: 'u1',
      })
    );

    await waitFor(() => {
      expect(result.current.entryComments.e1?.[0]?.body).toBe('hola');
      expect(result.current.commentCounts.e1).toBe(1);
    });
  });

  it('submits comment using draft and clears it', async () => {
    const { result } = renderHook(() =>
      useEntryComments({
        entries,
        commentMode: 'full',
        headerOnly: false,
        refreshKey: 0,
        viewerId: 'u1',
      })
    );

    act(() => {
      result.current.setCommentDraft('e1', 'nuevo comentario');
    });

    await act(async () => {
      await result.current.submitComment('e1');
    });

    expect(result.current.commentDrafts.e1).toBe('');
  });

  it('deletes selected comment and updates local list', async () => {
    const { result } = renderHook(() =>
      useEntryComments({
        entries,
        commentMode: 'full',
        headerOnly: false,
        refreshKey: 0,
        viewerId: 'u1',
      })
    );

    await waitFor(() => {
      expect(result.current.entryComments.e1?.length).toBeGreaterThan(0);
    });

    act(() => {
      result.current.setCommentConfirm({
        entryId: 'e1',
        comment: result.current.entryComments.e1[0],
      });
    });

    await act(async () => {
      await result.current.deleteComment();
    });

    expect(result.current.entryComments.e1).toEqual([]);
    expect(result.current.commentConfirm).toBeNull();
  });
});
