import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddEntryModal } from './AddEntryModal';

const photoMetadataMock = vi.hoisted(() => vi.fn());
const cropImageMock = vi.hoisted(() => vi.fn());
const compressImageMock = vi.hoisted(() => vi.fn());
const preparePhotoForCropMock = vi.hoisted(() => vi.fn());

const supabaseMock = vi.hoisted(() => {
  const state = {
    restaurantRows: [] as Array<{ id: string; name: string }>,
    restaurantOrQuery: '',
    entriesInsert: vi.fn().mockResolvedValue({ error: null }),
    entriesUpdate: vi.fn(),
    restaurantsUpsert: vi.fn(),
    burgersInsert: vi.fn(),
    wishlistMatch: vi.fn().mockResolvedValue({ error: null }),
    storageUpload: vi.fn().mockResolvedValue({ error: null }),
  };

  const createRestaurantQuery = () => {
    const query = {
      select: vi.fn(() => query),
      or: vi.fn((condition: string) => {
        state.restaurantOrQuery = condition;
        return query;
      }),
      order: vi.fn(() => query),
      limit: vi
        .fn()
        .mockImplementation(async () => ({
          data: state.restaurantRows,
          error: null,
        })),
      upsert: state.restaurantsUpsert.mockImplementation(
        (payload: { name: string }) => ({
          select: () => ({
            single: async () => ({
              data: { id: 'new-restaurant', name: payload.name },
              error: null,
            }),
          }),
        }),
      ),
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
          update: state.entriesUpdate.mockImplementation(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        };
      }
      if (table === 'burgers') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              ilike: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi
                    .fn()
                    .mockResolvedValue({ data: [], error: null }),
                })),
              })),
            })),
          })),
          insert: state.burgersInsert.mockImplementation(
            (payload: { name: string; meat_type: string }) => ({
              select: () => ({
                single: async () => ({
                  data: {
                    id: 'burger-1',
                    name: payload.name,
                    meat_type: payload.meat_type,
                  },
                  error: null,
                }),
              }),
            }),
          ),
        };
      }
      if (table === 'burger_wishlist') {
        return {
          delete: () => ({ match: state.wishlistMatch }),
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
        upload: supabaseMock.state.storageUpload,
        getPublicUrl: vi.fn(() => ({
          data: { publicUrl: 'https://example.com/photo.jpg' },
        })),
      }),
    },
  },
}));

vi.mock('../../utils/photoMetadata', () => ({
  getPhotoTakenDateTime: photoMetadataMock,
}));

vi.mock('../../utils/cropImage', () => ({
  cropImageFile: cropImageMock,
}));

vi.mock('../../utils/image', () => ({
  compressImage: compressImageMock,
}));

vi.mock('../../utils/photoFile', () => ({
  preparePhotoForCrop: preparePhotoForCropMock,
}));

vi.mock('react-image-crop', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  convertToPixelCrop: vi.fn(() => ({
    x: 0,
    y: 0,
    width: 400,
    height: 300,
  })),
}));

vi.mock('@mui/material', () => ({
  Button: ({
    children,
    onClick,
    type = 'button',
    disabled,
    component,
    startIcon,
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    children: ReactNode;
    component?: string;
    startIcon?: ReactNode;
  }) => {
    if (component === 'label') {
      return (
        <label aria-disabled={disabled}>
          {startIcon}
          {children}
        </label>
      );
    }
    return (
      <button
        type={type}
        disabled={disabled}
        onClick={onClick}
      >
        {startIcon}
        {children}
      </button>
    );
  },
  CssBaseline: () => null,
  TextField: ({
    id,
    label,
    value,
    onChange,
    select,
    children,
    type,
    helperText,
    inputProps,
    error,
  }: {
    id?: string;
    label?: string;
    value?: string;
    onChange?: (event: { target: { value: string } }) => void;
    select?: boolean;
    children?: ReactNode;
    type?: string;
    helperText?: ReactNode;
    inputProps?: InputHTMLAttributes<HTMLInputElement>;
    error?: boolean;
  }) => (
    <label>
      {label}
      {select ? (
        <select
          id={id}
          value={value}
          aria-invalid={error}
          onChange={(event) =>
            onChange?.({ target: { value: event.target.value } })
          }
        >
          {children}
        </select>
      ) : (
        <input
          {...inputProps}
          id={id}
          type={type}
          value={value}
          aria-invalid={error}
          onChange={(event) =>
            onChange?.({ target: { value: event.target.value } })
          }
        />
      )}
      {helperText ? <span>{helperText}</span> : null}
    </label>
  ),
  ThemeProvider: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  MenuItem: ({
    children,
    value,
  }: {
    children: ReactNode;
    value: string;
  }) => <option value={value}>{children}</option>,
}));

vi.mock('@mui/icons-material', () => {
  const Icon = (
    props: HTMLAttributes<HTMLSpanElement> & { sx?: unknown },
  ) => <span {...props} />;
  return {
    ArrowBackRounded: Icon,
    CameraAltRounded: Icon,
    CloseRounded: Icon,
    HomeRounded: Icon,
    PhotoLibraryRounded: Icon,
    RestaurantRounded: Icon,
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

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onSaved: vi.fn(),
  session: { user: { id: 'u1' } } as never,
  theme: 'light' as const,
  mode: 'create' as const,
};

const restaurantEntry = {
  id: 'entry-1',
  datetime: '2026-04-01T12:00:00.000Z',
  rating: 4,
  price: 12,
  currency: 'EUR',
  is_burger: true,
  restaurantId: 'r1',
  restaurantName: 'Hundred',
  burgerId: 'b1',
  burgerName: 'Classic',
  meatType: 'beef' as const,
  burgerOrigin: 'restaurant' as const,
  photoUrl: 'https://example.com/original.jpg',
};

const renderModal = (
  props: Partial<Parameters<typeof AddEntryModal>[0]> = {},
) => render(<AddEntryModal {...defaultProps} {...props} />);

const clickContinue = () =>
  fireEvent.click(
    screen.getByRole('button', {
      name: /addEntry\.(continue|continueWithoutPhoto)/,
    }),
  );

const selectOrigin = (origin: 'restaurant' | 'homemade') =>
  fireEvent.click(
    screen.getByRole('radio', { name: new RegExp(`addEntry.${origin}`) }),
  );

async function goToRestaurantIdentity() {
  selectOrigin('restaurant');
  clickContinue();
  expect(
    await screen.findByText('addEntry.steps.2.title'),
  ).toBeInTheDocument();
  clickContinue();
  expect(
    await screen.findByText('addEntry.restaurantIdentityTitle'),
  ).toBeInTheDocument();
}

async function selectRestaurantAndFillBurger() {
  supabaseMock.state.restaurantRows = [{ id: 'r1', name: 'Hundred' }];
  await act(async () => {
    fireEvent.change(screen.getByLabelText('addEntry.restaurantLabel'), {
      target: { value: 'Hundred' },
    });
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Hundred' }));
  await act(async () => {
    fireEvent.change(screen.getByLabelText('addEntry.burgerLabel'), {
      target: { value: 'Classic' },
    });
  });
}

async function goToRestaurantRating() {
  await goToRestaurantIdentity();
  await selectRestaurantAndFillBurger();
  clickContinue();
  expect(
    await screen.findByText('addEntry.steps.4.title'),
  ).toBeInTheDocument();
}

function fillRatingAndPrice() {
  fireEvent.click(
    screen.getByRole('button', { name: 'addEntry.score 4.5' }),
  );
  fireEvent.change(screen.getByLabelText('addEntry.restaurantPriceLabel'), {
    target: { value: '15.9' },
  });
}

beforeEach(() => {
  supabaseMock.state.restaurantRows = [];
  photoMetadataMock.mockResolvedValue(null);
  const processedFile = new File(['processed'], 'burger.jpg', {
    type: 'image/jpeg',
  });
  cropImageMock.mockResolvedValue(processedFile);
  compressImageMock.mockResolvedValue(processedFile);
  preparePhotoForCropMock.mockImplementation(
    async (file: File) => file,
  );
  vi.stubGlobal(
    'URL',
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:photo'),
      revokeObjectURL: vi.fn(),
    }),
  );
});

describe('AddEntryModal wizard', () => {
  it('no renderiza cuando está cerrado', () => {
    renderModal({ open: false });
    expect(
      screen.queryByText('addEntry.steps.1.title'),
    ).not.toBeInTheDocument();
  });

  it('empieza en el paso de tipo y no avanza sin elegirlo', () => {
    renderModal();
    expect(screen.getByText('addEntry.steps.1.title')).toBeInTheDocument();
    clickContinue();
    expect(screen.getByText('addEntry.errors.originRequired')).toBeInTheDocument();
    expect(screen.getByText('addEntry.steps.1.title')).toBeInTheDocument();
  });

  it('bloquea el paso de valoración si faltan nota y precio', async () => {
    renderModal();
    selectOrigin('homemade');
    clickContinue();
    await screen.findByText('addEntry.steps.2.title');
    clickContinue();
    await screen.findByText('addEntry.homemadeIdentityTitle');
    fireEvent.change(document.getElementById('bw-ingredients')!, {
      target: { value: 'Cheddar' },
    });
    clickContinue();
    await screen.findByText('addEntry.steps.4.title');
    clickContinue();
    expect(
      await screen.findByText('addEntry.errors.ratingRequired'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('addEntry.errors.priceRequired'),
    ).toBeInTheDocument();
    expect(screen.getByText('addEntry.steps.4.title')).toBeInTheDocument();
  });

  it('permite omitir la foto y conserva los datos al volver', async () => {
    renderModal();
    await goToRestaurantIdentity();
    await selectRestaurantAndFillBurger();
    fireEvent.click(screen.getByRole('button', { name: 'addEntry.back' }));
    expect(screen.getByText('addEntry.steps.2.title')).toBeInTheDocument();
    clickContinue();
    await screen.findByText('addEntry.restaurantIdentityTitle');
    expect(document.getElementById('bw-restaurant')).toHaveValue(
      'Hundred',
    );
    expect(document.getElementById('bw-burger-name')).toHaveValue(
      'Classic',
    );
  });

  it('abre el selector de archivos al pulsar la tarjeta de foto vacía', async () => {
    renderModal();
    selectOrigin('homemade');
    clickContinue();
    await screen.findByText('addEntry.steps.2.title');

    const fileInput = document.getElementById(
      'bw-photo-card-input',
    ) as HTMLInputElement;
    const inputClickSpy = vi.spyOn(fileInput, 'click');

    fireEvent.click(
      screen.getByRole('button', { name: 'addEntry.choosePhoto' }),
    );

    expect(inputClickSpy).toHaveBeenCalledOnce();
  });

  it('publica el flujo de restaurante sin control de visibilidad', async () => {
    const onSaved = vi.fn();
    renderModal({ onSaved });
    await goToRestaurantRating();
    fillRatingAndPrice();
    clickContinue();

    expect(
      await screen.findByText('addEntry.steps.5.title'),
    ).toBeInTheDocument();
    expect(supabaseMock.state.entriesInsert).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByText('Hundred')).toBeInTheDocument();
    expect(screen.queryByText(/visibility/i)).not.toBeInTheDocument();
    const scrollRegion = document.querySelector('.bw-wizard-fields');
    expect(scrollRegion).toContainElement(screen.getByText('Hundred'));
    expect(scrollRegion).not.toContainElement(
      screen.getByRole('button', { name: 'addEntry.publish' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'addEntry.publish' }),
    );

    await waitFor(() =>
      expect(supabaseMock.state.entriesInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'u1',
          restaurant_id: 'r1',
          burger_origin: 'restaurant',
          photo_url: null,
        }),
      ),
    );
    const payload = supabaseMock.state.entriesInsert.mock.calls.at(-1)?.[0];
    expect(payload).not.toHaveProperty('visibility');
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it('publica el flujo casero con ingredientes y sin nombre de burger', async () => {
    renderModal();
    selectOrigin('homemade');
    clickContinue();
    await screen.findByText('addEntry.steps.2.title');
    clickContinue();
    expect(
      await screen.findByText('addEntry.homemadeIdentityTitle'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('addEntry.burgerLabel')).not.toBeInTheDocument();
    fireEvent.change(document.getElementById('bw-ingredients')!, {
      target: { value: 'Smash, cheddar y bacon' },
    });
    clickContinue();
    await screen.findByText('addEntry.steps.4.title');
    fireEvent.click(
      screen.getByRole('button', { name: 'addEntry.score 4.5' }),
    );
    fireEvent.change(screen.getByLabelText('addEntry.homemadePriceLabel'), {
      target: { value: '6.5' },
    });
    clickContinue();
    await screen.findByText('addEntry.steps.5.title');
    fireEvent.click(
      screen.getByRole('button', { name: 'addEntry.publish' }),
    );

    await waitFor(() =>
      expect(supabaseMock.state.entriesInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurant_id: null,
          burger_id: null,
          burger_origin: 'homemade',
          homemade_ingredients: 'Smash, cheddar y bacon',
        }),
      ),
    );
  });

  it('usa la fecha EXIF de una foto después de recortarla', async () => {
    photoMetadataMock.mockResolvedValue('2026-03-04T12:30');
    renderModal();
    selectOrigin('homemade');
    clickContinue();
    await screen.findByText('addEntry.steps.2.title');

    const galleryLabel = screen
      .getByText('addEntry.choosePhoto')
      .closest('label');
    const file = new File(['photo'], 'burger.jpg', {
      type: 'image/jpeg',
    });
    fireEvent.change(galleryLabel?.querySelector('input') as Element, {
      target: { files: [file] },
    });

    const cropImage = await screen.findByAltText('addEntry.cropAlt');
    Object.defineProperty(cropImage, 'naturalWidth', { value: 800 });
    Object.defineProperty(cropImage, 'naturalHeight', { value: 600 });
    fireEvent.load(cropImage);
    fireEvent.click(screen.getByRole('button', { name: 'addEntry.crop' }));
    await waitFor(() => expect(compressImageMock).toHaveBeenCalled());

    clickContinue();
    await screen.findByText('addEntry.homemadeIdentityTitle');
    fireEvent.change(document.getElementById('bw-ingredients')!, {
      target: { value: 'Cheddar y cebolla' },
    });
    clickContinue();
    await screen.findByText('addEntry.steps.4.title');
    fireEvent.click(
      screen.getByRole('button', { name: 'addEntry.score 4.5' }),
    );
    fireEvent.change(screen.getByLabelText('addEntry.homemadePriceLabel'), {
      target: { value: '5' },
    });
    clickContinue();
    await screen.findByText('addEntry.steps.5.title');
    expect(document.getElementById('bw-datetime')).toHaveValue(
      '2026-03-04T12:30',
    );
    expect(supabaseMock.state.storageUpload).not.toHaveBeenCalled();
  });

  it('cierra el recortador y muestra un error si la foto no carga', async () => {
    renderModal();
    selectOrigin('homemade');
    clickContinue();
    await screen.findByText('addEntry.steps.2.title');

    const galleryLabel = screen
      .getByText('addEntry.choosePhoto')
      .closest('label');
    fireEvent.change(galleryLabel?.querySelector('input') as Element, {
      target: {
        files: [
          new File(['invalid'], 'burger.jpg', { type: 'image/jpeg' }),
        ],
      },
    });

    const cropImage = await screen.findByAltText('addEntry.cropAlt');
    fireEvent.error(cropImage);

    expect(
      await screen.findByText('addEntry.errors.photoProcess'),
    ).toBeInTheDocument();
    expect(
      screen.queryByAltText('addEntry.cropAlt'),
    ).not.toBeInTheDocument();
  });

  it('no sobrescribe una fecha modificada al cambiar la foto', async () => {
    photoMetadataMock.mockResolvedValue('2026-03-04T12:30');
    renderModal({ mode: 'edit', entry: restaurantEntry });
    clickContinue();
    await screen.findByText('addEntry.steps.2.title');
    clickContinue();
    await screen.findByText('addEntry.restaurantIdentityTitle');
    clickContinue();
    await screen.findByText('addEntry.steps.4.title');
    clickContinue();
    await screen.findByText('addEntry.steps.5.title');
    fireEvent.change(document.getElementById('bw-datetime')!, {
      target: { value: '2026-04-02T18:45' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'addEntry.back' }));
    fireEvent.click(screen.getByRole('button', { name: 'addEntry.back' }));
    fireEvent.click(screen.getByRole('button', { name: 'addEntry.back' }));
    await screen.findByText('addEntry.steps.2.title');
    const changePhotoLabel = screen
      .getByText('addEntry.changePhoto')
      .closest('label');
    fireEvent.change(changePhotoLabel?.querySelector('input') as Element, {
      target: {
        files: [
          new File(['new-photo'], 'new.jpg', { type: 'image/jpeg' }),
        ],
      },
    });
    const cropImage = await screen.findByAltText('addEntry.cropAlt');
    Object.defineProperty(cropImage, 'naturalWidth', { value: 800 });
    Object.defineProperty(cropImage, 'naturalHeight', { value: 600 });
    fireEvent.load(cropImage);
    fireEvent.click(screen.getByRole('button', { name: 'addEntry.crop' }));
    await waitFor(() => expect(compressImageMock).toHaveBeenCalled());

    clickContinue();
    await screen.findByText('addEntry.restaurantIdentityTitle');
    clickContinue();
    await screen.findByText('addEntry.steps.4.title');
    clickContinue();
    await screen.findByText('addEntry.steps.5.title');
    expect(document.getElementById('bw-datetime')).toHaveValue(
      '2026-04-02T18:45',
    );
  });

  it('rechaza fechas futuras y anteriores al mínimo', async () => {
    renderModal({ mode: 'edit', entry: restaurantEntry });
    clickContinue();
    await screen.findByText('addEntry.steps.2.title');
    clickContinue();
    await screen.findByText('addEntry.restaurantIdentityTitle');
    clickContinue();
    await screen.findByText('addEntry.steps.4.title');
    clickContinue();
    await screen.findByText('addEntry.steps.5.title');

    fireEvent.change(document.getElementById('bw-datetime')!, {
      target: { value: '2027-01-01T12:00' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'addEntry.saveChanges' }),
    );
    expect(
      await screen.findByText('addEntry.errors.datetimeFuture'),
    ).toBeInTheDocument();

    fireEvent.change(document.getElementById('bw-datetime')!, {
      target: { value: '2025-12-31T23:59' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'addEntry.saveChanges' }),
    );
    expect(
      await screen.findByText('addEntry.errors.datetimeMinimum'),
    ).toBeInTheDocument();
    expect(supabaseMock.state.entriesUpdate).not.toHaveBeenCalled();
  });

  it('guarda cambios en edición sin crear una entrada nueva', async () => {
    const onSaved = vi.fn();
    renderModal({
      mode: 'edit',
      entry: restaurantEntry,
      onSaved,
    });
    clickContinue();
    await screen.findByText('addEntry.steps.2.title');
    clickContinue();
    await screen.findByText('addEntry.restaurantIdentityTitle');
    clickContinue();
    await screen.findByText('addEntry.steps.4.title');
    clickContinue();
    await screen.findByText('addEntry.steps.5.title');
    fireEvent.change(document.getElementById('bw-notes')!, {
      target: { value: 'Muy buena' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'addEntry.saveChanges' }),
    );

    await waitFor(() =>
      expect(supabaseMock.state.entriesUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ additional_notes: 'Muy buena' }),
      ),
    );
    expect(supabaseMock.state.entriesInsert).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it('abre la revisión y crea un restaurante antes de continuar', async () => {
    renderModal();
    await goToRestaurantIdentity();
    fireEvent.change(screen.getByLabelText('addEntry.restaurantLabel'), {
      target: { value: 'Nuevo Local' },
    });
    fireEvent.change(document.getElementById('bw-burger-name')!, {
      target: { value: 'Classic' },
    });
    clickContinue();

    expect(
      await screen.findByText('addEntry.reviewRestaurantTitle'),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'addEntry.reviewRestaurantCreate',
      }),
    );
    await waitFor(() =>
      expect(screen.getByText('addEntry.steps.4.title')).toBeInTheDocument(),
    );
    expect(supabaseMock.state.restaurantsUpsert).not.toHaveBeenCalled();
    fillRatingAndPrice();
    clickContinue();
    await screen.findByText('addEntry.steps.5.title');
    fireEvent.click(
      screen.getByRole('button', { name: 'addEntry.publish' }),
    );
    await waitFor(() =>
      expect(supabaseMock.state.restaurantsUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Nuevo Local' }),
        { onConflict: 'name_normalized' },
      ),
    );
  });

  it('pide confirmación al cambiar de tipo con datos incompatibles', async () => {
    renderModal();
    await goToRestaurantIdentity();
    await selectRestaurantAndFillBurger();
    fireEvent.click(screen.getByRole('button', { name: 'addEntry.back' }));
    fireEvent.click(screen.getByRole('button', { name: 'addEntry.back' }));
    selectOrigin('homemade');

    expect(
      screen.getByText('addEntry.changeTypeConfirm.title'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));
    expect(
      screen.getByRole('radio', { name: /addEntry.restaurant/ }),
    ).toHaveAttribute('aria-checked', 'true');

    selectOrigin('homemade');
    fireEvent.click(
      screen.getByRole('button', {
        name: 'addEntry.changeTypeConfirm.confirm',
      }),
    );
    expect(
      screen.getByRole('radio', { name: /addEntry.homemade/ }),
    ).toHaveAttribute('aria-checked', 'true');
  });

  it('cierra directamente por backdrop sin cambios', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.mouseDown(document.querySelector('.bw-modal-backdrop')!);
    act(() => vi.advanceTimersByTime(300));
    expect(onClose).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('protege el progreso al cerrar, conserva datos y permite salir', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    renderModal({ onClose });
    selectOrigin('homemade');
    fireEvent.click(
      screen.getByRole('button', { name: 'common.close' }),
    );

    expect(screen.getByText('¿Salir sin guardar?')).toBeInTheDocument();
    expect(
      screen.getByText('Si sales se perderá el progreso.'),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'addEntry.exitConfirm.keepEditing',
      }),
    );
    expect(
      screen.getByRole('radio', { name: /addEntry.homemade/ }),
    ).toHaveAttribute('aria-checked', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByText('¿Salir sin guardar?')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'addEntry.exitConfirm.exit' }),
    );
    act(() => vi.advanceTimersByTime(300));
    expect(onClose).toHaveBeenCalledOnce();
    expect(supabaseMock.state.storageUpload).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('en edición no avisa sin cambios y sí después de modificar', () => {
    vi.useFakeTimers();
    const firstClose = vi.fn();
    const first = renderModal({
      mode: 'edit',
      entry: restaurantEntry,
      onClose: firstClose,
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'common.close' }),
    );
    act(() => vi.advanceTimersByTime(300));
    expect(firstClose).toHaveBeenCalledOnce();
    first.unmount();

    const secondClose = vi.fn();
    renderModal({
      mode: 'edit',
      entry: restaurantEntry,
      onClose: secondClose,
    });
    selectOrigin('homemade');
    fireEvent.click(
      screen.getByRole('button', {
        name: 'addEntry.changeTypeConfirm.confirm',
      }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'common.close' }),
    );
    expect(screen.getByText('¿Salir sin guardar?')).toBeInTheDocument();
    expect(secondClose).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
