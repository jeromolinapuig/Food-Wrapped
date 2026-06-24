import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';
import { whereNotDeleted } from '../../lib/whereNotDeleted';
import type { BurgerCalendarEntry } from './types';
import { toLocalMonthBoundary } from './utils';

type UseBurgerCalendarResult = {
  entries: BurgerCalendarEntry[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};

type RawBurgerCalendarRow = {
  id: string;
  datetime: string;
  created_at?: string | null;
  photo_url?: string | null;
  rating?: number | null;
  price?: number | null;
  currency?: string | null;
  restaurant?: { name?: string | null } | { name?: string | null }[] | null;
  burger?: { name?: string | null; meat_type?: string | null } | { name?: string | null; meat_type?: string | null }[] | null;
};

const firstRelation = <T,>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

export function useBurgerCalendar(
  session: Session,
  year: number,
  month: number
): UseBurgerCalendarResult {
  const [entries, setEntries] = useState<BurgerCalendarEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refetch = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      const startDate = toLocalMonthBoundary(year, month, 1);
      const endDate = month === 11
        ? toLocalMonthBoundary(year + 1, 0, 1)
        : toLocalMonthBoundary(year, month + 1, 1);

      const query = whereNotDeleted(
        supabase
          .from('entries')
          .select(
            `
              id,
              datetime,
              created_at,
              photo_url,
              rating,
              price,
              currency,
              restaurant:restaurants ( name ),
              burger:burgers ( name, meat_type )
            `
          )
          .eq('user_id', session.user.id)
          .eq('is_burger', true)
          .gte('datetime', startDate)
          .lt('datetime', endDate)
          .order('datetime', { ascending: true })
      );

      const { data, error: loadError } = await query;

      if (cancelled) return;

      if (loadError) {
        setEntries([]);
        setError(loadError.message);
      } else {
        setEntries(((data ?? []) as RawBurgerCalendarRow[]).map((row) => ({
          id: row.id,
          datetime: row.datetime,
          created_at: row.created_at ?? null,
          photo_url: row.photo_url ?? null,
          rating: row.rating ?? null,
          price: row.price ?? null,
          currency: row.currency ?? null,
          restaurant: firstRelation(row.restaurant),
          burger: firstRelation(row.burger),
        })));
      }

      setIsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [month, reloadKey, session.user.id, year]);

  return { entries, isLoading, error, refetch };
}
