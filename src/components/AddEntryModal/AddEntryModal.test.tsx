import type { HTMLAttributes, ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AddEntryModal } from './AddEntryModal';

const supabaseMock = vi.hoisted(() => {
  const state = {
    restaurantRows: [] as Array<{ id: string; name: string }>,
    entriesInsert: vi.fn().mockResolvedValue({ error: null }),
    restaurantsUpsert: vi.fn(),
    restaurantOrQuery: '',
  };

  const createRestaurantQuery = () => {
    const query = {
      select: vi.fn(() => query),
      or: vi.fn((condition: string) => {
        state.restaurantOrQuery = condition;
        return query;
      }),
      order: vi.fn(() => query),
      limit: vi.fn().mockImplementation(async () => ({ data: state.restaurantRows, error: null })),
      upsert: state.restaurantsUpsert.mockImplementation((payload: { name: string }) => ({
        select: () => ({
          single: async () => ({ data: { id: 'new-restaurant', name: payload.name }, error: null }),
        }),
      })),
    };
    return query;
  };

  return {
    state,
    from: vi.fn((table: string) => {
      if (table === 'restaurants') return createRestaurantQuery();
      if (table === 'entries') {
        return {
          insert: state.entriesInsert,
          update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
        };
      }
      if (table === 'burgers') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              ilike: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                })),
              })),
            })),
          })),
          insert: vi.fn(() => ({
            select: () => ({
              single: async () => ({ data: { id: 'burger-1', name: 'Classic', meat_type: 'beef' }, error: null }),
            }),
          })),
        };
      }
      return {};
    }),
  };
});

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: supabaseMock.from,
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'photo-url' } })),
      }),
    },
  },
}));

vi.mock('react-image-crop', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  convertToPixelCrop: vi.fn(),
}));

vi.mock('@mui/material', () => ({
  Button: ({
    children,
    onClick,
    type = 'button',
    disabled,
  }: {
    children: ReactNode;
    onClick?: () => void;
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
  }) => (
    <button type={type} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  CssBaseline: () => null,
  TextField: ({
    id,
    label,
    value,
    onChange,
    select,
    children,
  }: {
    id?: string;
    label?: string;
    value?: string;
    onChange?: (event: { target: { value: string } }) => void;
    select?: boolean;
    children?: ReactNode;
  }) => (
    <label>
      {label}
      {select ? (
        <select id={id} value={value} onChange={(e) => onChange?.({ target: { value: e.target.value } })}>
          {children}
        </select>
      ) : (
        <input id={id} value={value} onChange={(e) => onChange?.({ target: { value: e.target.value } })} />
      )}
    </label>
  ),
  ThemeProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  MenuItem: ({ children, value }: { children: ReactNode; value: string }) => <option value={value}>{children}</option>,
}));

vi.mock('@mui/icons-material', () => {
  const Icon = (props: HTMLAttributes<HTMLSpanElement> & { sx?: unknown }) => <span {...props} />;
  return {
    Star: Icon,
    StarBorder: Icon,
    StarHalf: Icon,
  };
});

vi.mock('../../context/PreferencesContext', () => ({
  usePreferences: () => ({ currency: 'EUR' }),
}));

vi.mock('../../theme', () => ({
  createAppTheme: () => ({
    colors: { accent: '#f0f', textMuted: '#999' },
    muiTheme: {},
  }),
}));

describe('AddEntryModal', () => {
  it('no renderiza cuando está cerrado', () => {
    render(
      <AddEntryModal
        open={false}
        onClose={() => {}}
        onSaved={() => {}}
        session={{ user: { id: 'u1' } } as never}
        theme="light"
        mode="create"
      />
    );
    expect(screen.queryByText('addEntry.titleCreate')).not.toBeInTheDocument();
  });

  it('permite cerrar modal desde botón de cierre', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <AddEntryModal
        open
        onClose={onClose}
        onSaved={() => {}}
        session={{ user: { id: 'u1' } } as never}
        theme="light"
        mode="create"
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'common.close' })[0] as HTMLElement);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('no rellena fecha y hora automaticamente al crear una entrada', () => {
    render(
      <AddEntryModal
        open
        onClose={() => {}}
        onSaved={() => {}}
        session={{ user: { id: 'u1' } } as never}
        theme="light"
        mode="create"
      />
    );

    expect(screen.getByLabelText('addEntry.datetime')).toHaveValue('');
  });

  it('mantiene seleccionada la puntuacion al pulsar el mismo valor otra vez', () => {
    render(
      <AddEntryModal
        open
        onClose={() => {}}
        onSaved={() => {}}
        session={{ user: { id: 'u1' } } as never}
        theme="light"
        mode="create"
      />
    );

    const ratingButton = screen.getByRole('button', { name: 'addEntry.score 4.5' });

    fireEvent.click(ratingButton);
    expect(ratingButton).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(ratingButton);
    expect(ratingButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('muestra la opcion de anadir restaurante cuando no hay coincidencia exacta', async () => {
    supabaseMock.state.restaurantRows = [{ id: 'r1', name: 'Hundred' }];

    render(
      <AddEntryModal
        open
        onClose={() => {}}
        onSaved={() => {}}
        session={{ user: { id: 'u1' } } as never}
        theme="light"
        mode="create"
      />
    );

    fireEvent.change(screen.getByLabelText('addEntry.restaurantLabel'), {
      target: { value: 'Hundred Burgers' },
    });

    expect(await screen.findByText('Hundred')).toBeInTheDocument();
    expect(screen.getByText('addEntry.addRestaurantOption')).toBeInTheDocument();
    expect(supabaseMock.state.restaurantOrQuery).toContain('name.ilike.%hundred%');
  });

  it('abre la revision de restaurante al guardar sin seleccionar uno existente', async () => {
    supabaseMock.state.restaurantRows = [{ id: 'r1', name: 'Hundred' }];

    render(
      <AddEntryModal
        open
        onClose={() => {}}
        onSaved={() => {}}
        session={{ user: { id: 'u1' } } as never}
        theme="light"
        mode="create"
      />
    );

    fireEvent.change(screen.getByLabelText('addEntry.datetime'), {
      target: { value: '2026-01-02T12:00' },
    });
    fireEvent.change(screen.getByLabelText('addEntry.restaurantLabel'), {
      target: { value: 'Hundred Burgers' },
    });
    fireEvent.change(screen.getByLabelText('addEntry.burgerLabel'), {
      target: { value: 'Classic' },
    });
    fireEvent.change(screen.getByLabelText('addEntry.priceLabel'), {
      target: { value: '12.5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'addEntry.score 4.5' }));
    fireEvent.click(screen.getByRole('button', { name: 'addEntry.save' }));

    expect(await screen.findByText('addEntry.reviewRestaurantTitle')).toBeInTheDocument();
    expect(screen.getByText('Hundred')).toBeInTheDocument();
    expect(supabaseMock.state.restaurantsUpsert).not.toHaveBeenCalled();
    await waitFor(() => expect(supabaseMock.state.entriesInsert).not.toHaveBeenCalled());
  });

  it('crea un restaurante nuevo y vuelve al formulario con el restaurante seleccionado', async () => {
    supabaseMock.state.restaurantRows = [];

    render(
      <AddEntryModal
        open
        onClose={() => {}}
        onSaved={() => {}}
        session={{ user: { id: 'u1' } } as never}
        theme="light"
        mode="create"
      />
    );

    fireEvent.change(screen.getByLabelText('addEntry.restaurantLabel'), {
      target: { value: 'Hundred Burgers' },
    });

    fireEvent.click(await screen.findByText('addEntry.addRestaurantOption'));
    expect(await screen.findByText('addEntry.reviewRestaurantTitle')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'addEntry.reviewRestaurantCreate' }));

    expect(await screen.findByLabelText('addEntry.restaurantLabel')).toHaveValue('Hundred Burgers');
    expect(supabaseMock.state.restaurantsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Hundred Burgers' }),
      { onConflict: 'name_normalized' }
    );
    expect(screen.queryByText('addEntry.addRestaurantOption')).not.toBeInTheDocument();
    expect(screen.queryByText('Selecciona fecha y hora.')).not.toBeInTheDocument();
    expect(supabaseMock.state.entriesInsert).not.toHaveBeenCalled();
  });
});
