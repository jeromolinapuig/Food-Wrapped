import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { whereNotDeleted } from '../../lib/whereNotDeleted';

type Relation = { name: string | null } | { name: string | null }[] | null;
export type Entry = {
  id: string;
  user_id: string;
  burger_id: string | null;
  restaurant_id: string | null;
  rating: number | null;
  photo_url: string | null;
  currency?: string | null;
  datetime: string;
  visibility: string | null;
  restaurant: Relation;
  burger: Relation;
  isPrivate: boolean;
  isLocked: boolean;
};

type Options = {
  userId?: string;
  viewerId?: string | null;
  publicOnly?: boolean;
  restaurantId?: string;
  burgerId?: string;
};
const EMPTY_ENTRIES: Entry[] = [];
const EMPTY_LIKES: Record<string, number> = {};

export function useBurgerEntries({ userId, viewerId, publicOnly = false, restaurantId, burgerId }: Options) {
  const [attempt, setAttempt] = useState(0);
  const retryPending = useRef(false);
  const key = JSON.stringify([userId, viewerId, publicOnly, restaurantId, burgerId, attempt]);
  const retry = useCallback(() => {
    if (retryPending.current) return;
    retryPending.current = true;
    setAttempt(value => value + 1);
  }, []);
  const [result, setResult] = useState({ key, entries: EMPTY_ENTRIES, likes: EMPTY_LIKES, loading: true, error: false });
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const rows: Entry[] = [];
        // Keep RLS in force, and fetch photos only after resolving visibility.
        for (let offset = 0; ; offset += 500) {
          let query = supabase.from('entries')
            .select('id,user_id,burger_id,restaurant_id,rating,currency,visibility,datetime,restaurant:restaurants(name),burger:burgers(name)')
            .eq('is_burger', true).eq('burger_origin', 'restaurant')
            .not('burger_id', 'is', null).not('restaurant_id', 'is', null)
            .order('datetime', { ascending: false }).order('id', { ascending: false })
            .range(offset, offset + 499);
          query = whereNotDeleted(query);
          if (publicOnly) query = query.eq('visibility', 'public');
          if (userId) query = query.eq('user_id', userId);
          if (restaurantId) query = query.eq('restaurant_id', restaurantId);
          if (burgerId) query = query.eq('burger_id', burgerId);
          const { data, error } = await query;
          if (!active) return;
          if (error) throw error;
          const batch = (data ?? []) as unknown as Entry[];
          rows.push(...batch);
          if (batch.length < 500) break;
        }

        const authors = [...new Set(rows.map(entry => entry.user_id))];
        const profiles = new Map<string, boolean>();
        for (let i = 0; i < authors.length; i += 100) {
          const ids = authors.slice(i, i + 100);
          const { data, error } = await supabase.from('profiles').select('id,is_private').in('id', ids);
          if (!active) return;
          if (error) throw error;
          for (const profile of data ?? []) profiles.set(profile.id, profile.is_private !== false);
        }

        const entries = rows.map((entry, index): Entry => {
          const profilePrivate = profiles.get(entry.user_id) !== false;
          const postPrivate = entry.visibility !== 'public';
          const isPrivate = profilePrivate || postPrivate;
          const isLocked = entry.user_id !== viewerId && isPrivate;
          return isLocked
            ? { ...entry, id: `private-${index}`, user_id: '', photo_url: null, datetime: '', rating: null, isPrivate, isLocked }
            : { ...entry, photo_url: null, isPrivate, isLocked };
        });
        const visible = entries.filter(entry => !entry.isLocked);
        for (let i = 0; i < visible.length; i += 100) {
          const batch = visible.slice(i, i + 100);
          const { data, error } = await whereNotDeleted(supabase.from('entries').select('id,photo_url').in('id', batch.map(entry => entry.id)));
          if (!active) return;
          if (error) throw error;
          const photos = new Map((data ?? []).map(row => [row.id, row.photo_url]));
          for (const entry of batch) entry.photo_url = photos.get(entry.id) ?? null;
        }
        const likes: Record<string, number> = {};
        for (let i = 0; i < visible.length; i += 100) {
          const ids = visible.slice(i, i + 100).map(entry => entry.id);
          for (let offset = 0; ; offset += 500) {
            const { data, error } = await supabase.from('entry_likes').select('entry_id,user_id')
              .in('entry_id', ids).order('entry_id', { ascending: true }).order('user_id', { ascending: true }).range(offset, offset + 499);
            if (!active) return;
            if (error) throw error;
            for (const row of data ?? []) likes[row.entry_id] = (likes[row.entry_id] ?? 0) + 1;
            if ((data ?? []).length < 500) break;
          }
        }
        // Publish posts and their likes together so covers never use provisional counts.
        if (active) setResult({ key, entries, likes, loading: false, error: false });
      } catch {
        if (active) setResult({ key, entries: EMPTY_ENTRIES, likes: EMPTY_LIKES, loading: false, error: true });
      }
    }
    void load().finally(() => { if (active) retryPending.current = false; });
    return () => { active = false; };
  }, [userId, viewerId, publicOnly, restaurantId, burgerId, key]);
  // Never show data from the previous viewer/route while a new request is pending.
  return { ...(result.key === key ? result : { entries: EMPTY_ENTRIES, likes: EMPTY_LIKES, loading: true, error: false }), retry };
}
