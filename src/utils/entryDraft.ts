import { supabase } from '../lib/supabaseClient';

export type DraftBurgerSource = 'restaurant' | 'homemade';
export type DraftMeatType = 'beef' | 'chicken' | 'vegan' | 'other';

export type EntryDraft = {
  id: string;
  user_id: string;
  current_step: number;
  datetime_input: string;
  datetime_manually_edited: boolean;
  burger_origin: DraftBurgerSource | null;
  restaurant_id: string | null;
  restaurant_name: string | null;
  restaurant_approved_name: string | null;
  burger_id: string | null;
  burger_name: string | null;
  meat_type: DraftMeatType;
  homemade_ingredients: string;
  rating_input: string;
  price_input: string;
  currency: string;
  additional_notes: string;
  photo_url: string | null;
  photo_path: string | null;
  created_at: string;
  updated_at: string;
};

export type EntryDraftInput = Omit<
  EntryDraft,
  'id' | 'created_at' | 'updated_at'
>;

const DRAFT_SELECT = `
  id,
  user_id,
  current_step,
  datetime_input,
  datetime_manually_edited,
  burger_origin,
  restaurant_id,
  restaurant_name,
  restaurant_approved_name,
  burger_id,
  burger_name,
  meat_type,
  homemade_ingredients,
  rating_input,
  price_input,
  currency,
  additional_notes,
  photo_url,
  photo_path,
  created_at,
  updated_at
`;

export async function loadEntryDraft(userId: string) {
  const { data, error } = await supabase
    .from('entry_drafts')
    .select(DRAFT_SELECT)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return (data as EntryDraft | null) ?? null;
}

export async function upsertEntryDraft(input: EntryDraftInput) {
  const { data, error } = await supabase
    .from('entry_drafts')
    .upsert(
      {
        ...input,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select(DRAFT_SELECT)
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to save entry draft');
  }
  return data as EntryDraft;
}

export async function deleteEntryDraft(userId: string) {
  const { error } = await supabase
    .from('entry_drafts')
    .delete()
    .eq('user_id', userId);
  if (error) throw error;
}

export async function uploadEntryDraftPhoto(
  userId: string,
  photo: File,
) {
  const extension = photo.name.split('.').pop()?.toLowerCase() || 'jpg';
  const uniquePart =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${userId}/drafts/${uniquePart}.${extension}`;
  const bucket = supabase.storage.from('food-photos');
  const { error } = await bucket.upload(path, photo, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;

  const { data } = bucket.getPublicUrl(path);
  return {
    path,
    url: data?.publicUrl ?? null,
  };
}

export async function deleteEntryDraftPhoto(path: string | null) {
  if (!path) return;
  const { error } = await supabase.storage
    .from('food-photos')
    .remove([path]);
  if (error) throw error;
}
