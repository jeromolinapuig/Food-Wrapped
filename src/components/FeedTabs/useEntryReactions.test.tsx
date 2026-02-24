import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEntryReactions } from './useEntryReactions';

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
    if (table === 'entry_likes') {
      return {
        select: () => ({
          in: async () => ({
            data: [
              { entry_id: 'e1', user_id: 'u1' },
              { entry_id: 'e1', user_id: 'u2' },
            ],
            error: null,
          }),
        }),
        insert: async () => ({ error: null }),
        delete: () => ({
          match: async () => ({ error: null }),
        }),
      };
    }
    if (table === 'entry_bookmarks') {
      return {
        select: () => ({
          eq: () => ({
            in: async () => ({
              data: [{ entry_id: 'e1' }],
              error: null,
            }),
          }),
        }),
        insert: async () => ({ error: null }),
        delete: () => ({
          match: async () => ({ error: null }),
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

describe('useEntryReactions', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
    setupSupabase();
  });

  it('loads like/save state for entries', async () => {
    const { result } = renderHook(() =>
      useEntryReactions({ viewerId: 'u1', isReadOnly: false })
    );

    await act(async () => {
      await result.current.loadEntryReactions(['e1']);
    });

    expect(result.current.entryReactions.e1).toEqual({
      likeCount: 2,
      liked: true,
      saved: true,
    });
  });

  it('requires login when toggling like in readonly mode', async () => {
    const onRequireLogin = vi.fn();
    const { result } = renderHook(() =>
      useEntryReactions({ viewerId: null, isReadOnly: true, onRequireLogin })
    );

    await act(async () => {
      await result.current.toggleLike('e1');
    });

    expect(onRequireLogin).toHaveBeenCalledTimes(1);
  });

  it('toggles bookmark and emits refresh event', async () => {
    const eventSpy = vi.spyOn(window, 'dispatchEvent');
    const { result } = renderHook(() =>
      useEntryReactions({ viewerId: 'u1', isReadOnly: false })
    );

    await act(async () => {
      await result.current.toggleSave('e1');
    });

    await waitFor(() => {
      expect(result.current.entryReactions.e1?.saved).toBe(true);
    });
    expect(eventSpy).toHaveBeenCalled();
    eventSpy.mockRestore();
  });
});
