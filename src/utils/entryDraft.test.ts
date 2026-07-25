import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteEntryDraft,
  deleteEntryDraftPhoto,
  loadEntryDraft,
  uploadEntryDraftPhoto,
  upsertEntryDraft,
  type EntryDraftInput,
} from './entryDraft';

const supabaseMock = vi.hoisted(() => {
  const state = {
    loadedDraft: null as Record<string, unknown> | null,
    upsertedDraft: null as Record<string, unknown> | null,
    loadUserId: '',
    deleteUserId: '',
    upsert: vi.fn(),
    upload: vi.fn(),
    remove: vi.fn(),
    publicUrl: 'https://example.com/draft.jpg',
  };

  return {
    state,
    from: vi.fn((table: string) => {
      if (table !== 'entry_drafts') return {};
      return {
        select: () => ({
          eq: (_field: string, userId: string) => {
            state.loadUserId = userId;
            return {
              maybeSingle: async () => ({
                data: state.loadedDraft,
                error: null,
              }),
            };
          },
        }),
        upsert: state.upsert.mockImplementation(
          (payload: Record<string, unknown>) => ({
            select: () => ({
              single: async () => ({
                data: state.upsertedDraft ?? payload,
                error: null,
              }),
            }),
          }),
        ),
        delete: () => ({
          eq: async (_field: string, userId: string) => {
            state.deleteUserId = userId;
            return { error: null };
          },
        }),
      };
    }),
    storageFrom: vi.fn(() => ({
      upload: state.upload,
      getPublicUrl: () => ({
        data: { publicUrl: state.publicUrl },
      }),
      remove: state.remove,
    })),
  };
});

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: supabaseMock.from,
    storage: {
      from: supabaseMock.storageFrom,
    },
  },
}));

const draftInput: EntryDraftInput = {
  user_id: 'user-1',
  current_step: 3,
  datetime_input: '2026-07-25T13:00',
  datetime_manually_edited: false,
  burger_origin: 'homemade',
  restaurant_id: null,
  restaurant_name: null,
  restaurant_approved_name: null,
  burger_id: null,
  burger_name: null,
  meat_type: 'beef',
  homemade_ingredients: 'Cheddar',
  rating_input: '',
  price_input: '',
  currency: 'EUR',
  additional_notes: '',
  photo_url: null,
  photo_path: null,
};

beforeEach(() => {
  supabaseMock.state.loadedDraft = null;
  supabaseMock.state.upsertedDraft = null;
  supabaseMock.state.loadUserId = '';
  supabaseMock.state.deleteUserId = '';
  supabaseMock.state.upsert.mockClear();
  supabaseMock.state.upload.mockReset().mockResolvedValue({ error: null });
  supabaseMock.state.remove.mockReset().mockResolvedValue({ error: null });
});

describe('entryDraft', () => {
  it('carga el único borrador del usuario', async () => {
    supabaseMock.state.loadedDraft = { id: 'draft-1', ...draftInput };

    await expect(loadEntryDraft('user-1')).resolves.toEqual(
      expect.objectContaining({ id: 'draft-1', user_id: 'user-1' }),
    );
    expect(supabaseMock.state.loadUserId).toBe('user-1');
  });

  it('actualiza o crea el borrador por user_id', async () => {
    await upsertEntryDraft(draftInput);

    expect(supabaseMock.state.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        current_step: 3,
        updated_at: expect.any(String),
      }),
      { onConflict: 'user_id' },
    );
  });

  it('sube la foto bajo el prefijo privado del usuario', async () => {
    const photo = new File(['burger'], 'burger.jpg', {
      type: 'image/jpeg',
    });

    const uploaded = await uploadEntryDraftPhoto('user-1', photo);

    expect(uploaded.path).toMatch(
      /^user-1\/drafts\/[\w-]+\.jpg$/,
    );
    expect(uploaded.url).toBe('https://example.com/draft.jpg');
    expect(supabaseMock.state.upload).toHaveBeenCalledWith(
      uploaded.path,
      photo,
      { cacheControl: '3600', upsert: false },
    );
  });

  it('elimina el registro y la foto del borrador', async () => {
    await deleteEntryDraft('user-1');
    await deleteEntryDraftPhoto('user-1/drafts/photo.jpg');

    expect(supabaseMock.state.deleteUserId).toBe('user-1');
    expect(supabaseMock.state.remove).toHaveBeenCalledWith([
      'user-1/drafts/photo.jpg',
    ]);
  });
});
