import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFeedEntries } from './useFeedEntries';

type MockSupabase = {
  from: ReturnType<typeof vi.fn>;
  channel: ReturnType<typeof vi.fn>;
  removeChannel: ReturnType<typeof vi.fn>;
};

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {
    from: vi.fn(),
    channel: vi.fn(),
    removeChannel: vi.fn(),
  } satisfies MockSupabase,
}));

vi.mock('../../lib/supabaseClient', () => ({
  supabase: supabaseMock,
}));

vi.mock('../../utils/useRevalidateOnFocus', () => ({
  useRevalidateOnFocus: () => {},
}));

vi.mock('../../lib/i18n', () => ({
  i18n: {
    language: 'es',
    t: (key: string) => key,
  },
}));

vi.mock('../../utils/datetime', () => ({
  getCurrentMonthValue: () => '2026-02',
}));

const setupSupabase = () => {
  supabaseMock.channel.mockReturnValue({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnValue({}),
  });

  supabaseMock.from.mockImplementation((table: string) => {
    if (table === 'entries') {
      return {
        select: (_columns?: string, options?: { count?: 'exact'; head?: boolean }) => {
          const payload = options?.head
            ? { count: 34, error: null, data: null }
            : {
                data: [
                  {
                    id: 'e1',
                    user_id: 'u1',
                    datetime: '2026-02-01T10:00:00.000Z',
                    price: 10,
                    rating: 4,
                    is_burger: true,
                    additional_notes: null,
                    restaurant_id: 'r1',
                    burger_id: 'b1',
                    meat_type: 'beef',
                    burger_origin: 'restaurant',
                    photo_url: null,
                    homemade_ingredients: null,
                    restaurants: { name: 'Rest' },
                    burgers: { name: 'Burger', meat_type: 'beef' },
                  },
                ],
                error: null,
              };
          const promise = Promise.resolve(payload);
          const query = {
            order: () => query,
            limit: () => query,
            eq: () => query,
            in: () => query,
            gte: () => query,
            lt: () => query,
            or: () => query,
            then: promise.then.bind(promise),
          };
          return query;
        },
      };
    }
    if (table === 'profiles') {
      return {
        select: () => ({
          in: async () => ({
            data: [{ id: 'u1', username: 'user1', display_name: 'User One', avatar_url: null, is_private: false }],
            error: null,
          }),
        }),
      };
    }
    return {
      select: () => ({
        in: async () => ({ data: [], error: null }),
        eq: async () => ({ data: [], error: null }),
      }),
    };
  });
};

describe('useFeedEntries', () => {
  beforeEach(() => {
    sessionStorage.clear();
    supabaseMock.from.mockReset();
    supabaseMock.channel.mockReset();
    supabaseMock.removeChannel.mockReset();
    setupSupabase();
  });

  it('starts in loading state before the first feed request resolves', async () => {
    const { result } = renderHook(() =>
      useFeedEntries({
        currentUserId: 'u1',
        isReadOnly: false,
        ignorePrivacy: true,
        headerOnly: false,
        hideHeader: true,
        refreshKey: 0,
      })
    );

    expect(result.current.loading).toBe(true);
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('returns empty feed immediately when read-only following is forced', async () => {
    const onCountChange = vi.fn();
    const { result } = renderHook(() =>
      useFeedEntries({
        currentUserId: null,
        isReadOnly: true,
        forcedTab: 'following',
        ignorePrivacy: false,
        onCountChange,
        headerOnly: false,
        hideHeader: false,
        refreshKey: 0,
      })
    );

    await waitFor(() => {
      expect(result.current.entries).toEqual([]);
      expect(result.current.hasMore).toBe(false);
    });
    expect(onCountChange).toHaveBeenCalledWith(0);
  });

  it('maps loaded entries for global feed', async () => {
    const onCountChange = vi.fn();
    const { result } = renderHook(() =>
      useFeedEntries({
        currentUserId: 'u1',
        isReadOnly: false,
        ignorePrivacy: true,
        onCountChange,
        headerOnly: false,
        hideHeader: true,
        refreshKey: 0,
      })
    );

    await waitFor(() => {
      expect(result.current.entries.length).toBe(1);
      expect(result.current.entries[0]).toMatchObject({
        id: 'e1',
        username: 'user1',
        restaurantName: 'Rest',
      });
    });
    await waitFor(() => {
      expect(onCountChange).toHaveBeenCalledWith(34);
    });
  });
});
