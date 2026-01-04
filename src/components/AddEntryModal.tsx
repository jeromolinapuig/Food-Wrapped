import { type FormEvent, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import {
  Button,
  CssBaseline,
  Switch,
  TextField,
  ThemeProvider,
  createTheme,
  Rating,
} from '@mui/material';
type MeatType = 'beef' | 'chicken' | 'vegan' | 'other';

type RestaurantOption = {
  id: string;
  name: string;
};

type BurgerOption = {
  id: string;
  name: string | null;
  meat_type: MeatType | null;
};

type AddEntryModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  session: Session;
  theme: 'light' | 'dark';
  mode: 'create' | 'edit';
  entry?: {
    id: string;
    datetime: string;
    rating: number | null;
    price: number | null;
    is_burger: boolean;
    restaurantId?: string | null;
    restaurantName?: string | null;
    burgerId?: string | null;
    burgerName?: string | null;
    meatType?: MeatType | null;
    photoUrl?: string | null;
  };
};

export function AddEntryModal({
  open,
  onClose,
  onSaved,
  session,
  theme,
  mode,
  entry,
}: AddEntryModalProps) {
  const [datetimeInput, setDatetimeInput] = useState('');
  const [restaurantInput, setRestaurantInput] = useState('');
  const [restaurantSuggestions, setRestaurantSuggestions] = useState<RestaurantOption[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantOption | null>(null);

  const [isBurger, setIsBurger] = useState(true);
  const [burgerType, setBurgerType] = useState<MeatType>('beef');
  const [burgerInput, setBurgerInput] = useState('');
  const [burgerSuggestions, setBurgerSuggestions] = useState<BurgerOption[]>([]);
  const [selectedBurger, setSelectedBurger] = useState<BurgerOption | null>(null);

  const [priceInput, setPriceInput] = useState('');
  const [ratingInput, setRatingInput] = useState('5');
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const paletteMap = {
    light: {
      bg: '#f3f3f7',
      surface: '#ffffff',
      text: '#111111',
      textMuted: '#666666',
      accent: '#ff3b8d',
    },
    dark: {
      bg: '#050509',
      surface: '#181824',
      text: '#f5f5ff',
      textMuted: '#a0a0b5',
      accent: '#ff3b8d',
    },
  } as const;

  const colors = paletteMap[theme] ?? paletteMap.light;

  const muiTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: theme === 'dark' ? 'dark' : 'light',
          primary: { main: colors.accent },
          background: {
            default: colors.bg,
            paper: colors.surface,
          },
          text: {
            primary: colors.text,
            secondary: colors.textMuted,
          },
        },
        components: {
          MuiOutlinedInput: {
            styleOverrides: {
              root: {
                backgroundColor: colors.surface,
              },
              notchedOutline: {
                borderColor: colors.textMuted,
              },
            },
          },
          MuiFormLabel: {
            styleOverrides: {
              root: {
                color: colors.textMuted,
                backgroundColor: colors.surface,
                padding: '0 6px',
                borderRadius: 8,
              },
            },
          },
          MuiInputLabel: {
            styleOverrides: {
              outlined: {
                '&.MuiInputLabel-shrink': {
                  transform: 'translate(14px, -8px) scale(0.75)',
                  backgroundColor: colors.surface,
                  padding: '0 6px',
                  borderRadius: 8,
                },
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundColor: colors.surface,
                color: colors.text,
              },
            },
          },
          MuiCheckbox: {
            styleOverrides: {
              root: {
                color: colors.textMuted,
              },
            },
          },
        },
      }),
    [colors.accent, colors.bg, colors.surface, colors.text, colors.textMuted, theme]
  );

  // Reset form when opening
  useEffect(() => {
    if (!open) return;
    setIsClosing(false);
    if (mode === 'edit' && entry) {
      const date = new Date(entry.datetime);
      const iso = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16); // yyyy-MM-ddTHH:mm
      setDatetimeInput(iso);
      setRestaurantInput(entry.restaurantName ?? '');
      setRestaurantSuggestions([]);
      setSelectedRestaurant(
        entry.restaurantId ? { id: entry.restaurantId, name: entry.restaurantName ?? '' } : null
      );
      setIsBurger(entry.is_burger);
      setBurgerType(entry.meatType ?? 'beef');
      setBurgerInput(entry.burgerName ?? '');
      setBurgerSuggestions([]);
      setSelectedBurger(
        entry.burgerId
          ? { id: entry.burgerId, name: entry.burgerName ?? null, meat_type: entry.meatType ?? null }
          : null
      );
      setPriceInput(entry.price != null ? String(entry.price) : '');
      setRatingInput(entry.rating != null ? String(entry.rating) : '5');
      setPhotoFile(null);
      setPhotoPreview(entry.photoUrl ?? null);
    } else {
      const now = new Date();
      const iso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16); // yyyy-MM-ddTHH:mm
      setDatetimeInput(iso);
      setRestaurantInput('');
      setRestaurantSuggestions([]);
      setSelectedRestaurant(null);
      setIsBurger(true);
      setBurgerType('beef');
      setBurgerInput('');
      setBurgerSuggestions([]);
      setSelectedBurger(null);
      setPriceInput('');
      setRatingInput('5');
      setPhotoFile(null);
      setPhotoPreview(null);
    }
    setFormError(null);
  }, [open, mode, entry]);

  const requestClose = () => {
    if (formLoading) return;
    setIsClosing(true);
    setTimeout(() => onClose(), 260);
  };

  if (!open) return null;

  const handleBackdrop = () => {
    requestClose();
  };

  const handleRestaurantChange = async (value: string) => {
    setRestaurantInput(value);
    setSelectedRestaurant(null);

    if (!value.trim()) {
      setRestaurantSuggestions([]);
      return;
    }

    const { data, error } = await supabase
      .from('restaurants')
      .select('id, name')
      .ilike('name', `%${value.trim()}%`)
      .order('name')
      .limit(10);

    if (error) {
      console.error(error);
      setRestaurantSuggestions([]);
    } else {
      setRestaurantSuggestions((data ?? []) as RestaurantOption[]);
    }
  };

  const selectRestaurant = (option: RestaurantOption) => {
    setSelectedRestaurant(option);
    setRestaurantInput(option.name);
    setRestaurantSuggestions([]);
    setSelectedBurger(null);
    setBurgerInput('');
    setBurgerSuggestions([]);
  };

  const handlePhotoChange = (file?: File | null) => {
    if (!file) {
      setPhotoFile(null);
      setPhotoPreview(null);
      return;
    }
    setPhotoFile(file);
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
  };

  const removePhoto = () => handlePhotoChange(null);

  const handleBurgerChange = async (value: string) => {
    setBurgerInput(value);
    setSelectedBurger(null);

    if (!value.trim() || !selectedRestaurant) {
      setBurgerSuggestions([]);
      return;
    }

    const { data, error } = await supabase
      .from('burgers')
      .select('id, name, meat_type')
      .eq('restaurant_id', selectedRestaurant.id)
      .ilike('name', `%${value.trim()}%`)
      .order('name')
      .limit(10);

    if (error) {
      console.error(error);
      setBurgerSuggestions([]);
    } else {
      setBurgerSuggestions((data ?? []) as BurgerOption[]);
    }
  };

  const selectBurger = (option: BurgerOption) => {
    setSelectedBurger(option);
    setBurgerInput(option.name ?? '');
    setBurgerSuggestions([]);
    if (option.meat_type) setBurgerType(option.meat_type);
  };

  const handleAddEntry = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!datetimeInput) {
      setFormError('Selecciona fecha y hora.');
      return;
    }

    if (!restaurantInput.trim()) {
      setFormError('Escribe o selecciona un restaurante.');
      return;
    }

    if (!priceInput.trim()) {
      setFormError('Indica el precio por persona.');
      return;
    }

    if (isBurger && !burgerInput.trim()) {
      setFormError('Escribe el nombre de la hamburguesa.');
      return;
    }

    const entryId = mode === 'edit' && entry ? entry.id : null;

    const price = Number(priceInput.replace(',', '.'));
    if (Number.isNaN(price) || price < 0) {
      setFormError('El precio no es válido.');
      return;
    }

    const rating = Number(ratingInput);
    if (rating < 1 || rating > 5) {
      setFormError('La puntuación debe estar entre 1 y 5.');
      return;
    }

    setFormLoading(true);

    try {
      let photoUrl: string | null = photoPreview ?? null;

      // 0) Subir foto si hay file nuevo
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop();
        const filePath = `${session.user.id}/${Date.now()}.${fileExt ?? 'jpg'}`;
        const { error: uploadError } = await supabase.storage
          .from('food-photos')
          .upload(filePath, photoFile, { cacheControl: '3600', upsert: false });
        if (uploadError) {
          throw uploadError;
        }
        const { data: publicUrlData } = supabase.storage.from('food-photos').getPublicUrl(filePath);
        photoUrl = publicUrlData?.publicUrl ?? null;
      }

      // 1) Asegurar restaurante
      let restaurantId = selectedRestaurant?.id ?? (mode === 'edit' ? entry?.restaurantId ?? null : null);

      if (!restaurantId) {
        const { data, error } = await supabase
          .from('restaurants')
          .insert({
            name: restaurantInput.trim(),
            is_chain: false,
            created_by: session.user.id,
          })
          .select('id, name')
          .single();

        if (error || !data) {
          throw error ?? new Error('No se pudo crear el restaurante');
        }

        restaurantId = data.id;
        setSelectedRestaurant({ id: data.id, name: data.name });
      }

      // 2) Asegurar hamburguesa (si corresponde)
      let burgerId: string | null = null;

      if (isBurger) {
        if (selectedBurger?.id) {
          burgerId = selectedBurger.id;
        } else if (burgerInput.trim()) {
          const { data, error } = await supabase
            .from('burgers')
            .insert({
              restaurant_id: restaurantId,
              name: burgerInput.trim(),
              meat_type: burgerType,
              created_by: session.user.id,
            })
            .select('id, name, meat_type')
            .single();

          if (error || !data) {
            throw error ?? new Error('No se pudo crear la hamburguesa');
          }

          burgerId = data.id;
          setSelectedBurger({
            id: data.id,
            name: data.name,
            meat_type: data.meat_type,
          });
        } else if (mode === 'edit') {
          burgerId = entry?.burgerId ?? null;
        }
      } else {
        burgerId = null;
      }

      // 3) Crear/actualizar la entry
      const iso = new Date(datetimeInput).toISOString();

      if (mode === 'edit' && entryId) {
        const { error: updateError } = await supabase
          .from('entries')
          .update({
            restaurant_id: restaurantId,
            burger_id: burgerId,
            datetime: iso,
            is_burger: isBurger,
            rating,
            price,
            photo_url: photoUrl,
          })
          .eq('id', entryId);

        if (updateError) {
          throw updateError;
        }
      } else {
        const { error: insertError } = await supabase.from('entries').insert({
          user_id: session.user.id,
          restaurant_id: restaurantId,
          burger_id: burgerId,
          datetime: iso,
          is_burger: isBurger,
          rating,
          price,
          photo_url: photoUrl,
        });

        if (insertError) {
          throw insertError;
        }
      }

      await onSaved();
      requestClose();
    } catch (err: unknown) {
      console.error(err);
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'Error al guardar la entrada.';
      setFormError(message);
    } finally {
      setFormLoading(false);
    }
  };

  const isSubmitDisabled =
    formLoading ||
    !datetimeInput ||
    !restaurantInput.trim() ||
    !priceInput.trim() ||
    (isBurger && !burgerInput.trim());

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <div
        className={`bw-modal-backdrop ${isClosing ? 'is-closing' : 'is-open'}`}
        onClick={handleBackdrop}
      >
        <div
          className={`bw-modal ${isClosing ? 'is-closing' : 'is-open'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bw-modal-header">
            <div>
              <h2 className="bw-modal-title">Nueva comida</h2>
              <p className="bw-modal-subtitle">Registra lo que acabas de probar.</p>
            </div>
            <Button variant="outlined" size="small" onClick={requestClose} disabled={formLoading}>
              Cerrar
            </Button>
          </div>

          <form className="bw-modal-form" onSubmit={handleAddEntry}>
            <div className="bw-modal-fields">
              <div className="bw-field">
                <span className="bw-label">Foto (opcional)</span>
                <div className="bw-photo-card">
                  {photoPreview ? (
                    <>
                      <img src={photoPreview} alt="Foto de la entrada" className="bw-photo-preview" />
                      <div className="bw-photo-actions">
                        <Button variant="outlined" size="small" onClick={removePhoto}>
                          Quitar
                        </Button>
                        <Button variant="contained" component="label" size="small">
                          Cambiar
                          <input
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
                          />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Button variant="outlined" component="label" size="small">
                      Añadir foto
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
                      />
                    </Button>
                  )}
                </div>
              </div>

              <div className="bw-field">
                <TextField
                  id="bw-datetime"
                  label="Fecha y hora"
                  type="datetime-local"
                  value={datetimeInput}
                  onChange={(e) => setDatetimeInput(e.target.value)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </div>

              <div className="bw-field">
                <TextField
                  id="bw-restaurant"
                  label="Restaurante"
                  value={restaurantInput}
                  onChange={(e) => handleRestaurantChange(e.target.value)}
                  placeholder="Jenkins, Goiko, McDonalds..."
                  autoComplete="off"
                  fullWidth
                />
                {restaurantSuggestions.length > 0 && (
                  <ul className="bw-suggestions">
                    {restaurantSuggestions.map((r) => (
                      <li key={r.id} onClick={() => selectRestaurant(r)}>
                        {r.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bw-toggle-card">
                <div className="bw-toggle-info">
                  <span className="bw-toggle-icon">🍔</span>
                  <div>
                    <div className="bw-toggle-title">¿Es una hamburguesa?</div>
                    <div className="bw-toggle-subtitle">Activa para elegir el tipo</div>
                  </div>
                </div>
                <Switch
                  checked={isBurger}
                  onChange={(e) => setIsBurger(e.target.checked)}
                  color="primary"
                  inputProps={{ 'aria-label': 'Es hamburguesa' }}
                />
              </div>

              {isBurger && (
                <>
                  <div className="bw-field">
                    <span className="bw-label">Tipo de hamburguesa</span>
                    <div className="bw-meat-grid">
                      {[
                        { value: 'beef', label: 'Ternera', emoji: '🥩' },
                        { value: 'chicken', label: 'Pollo', emoji: '🍗' },
                        { value: 'vegan', label: 'Vegana', emoji: '🌱' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className={`bw-meat-card ${burgerType === opt.value ? 'is-active' : ''
                            }`}
                          onClick={() => setBurgerType(opt.value as MeatType)}
                        >
                          <span className="bw-meat-emoji">{opt.emoji}</span>
                          <span className="bw-meat-label">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bw-field">
                    <TextField
                      id="bw-burger-name"
                      label="Hamburguesa"
                      value={burgerInput}
                      onChange={(e) => handleBurgerChange(e.target.value)}
                      placeholder="Emmy, Big Mac..."
                      autoComplete="off"
                      fullWidth
                    />
                    {selectedRestaurant && burgerSuggestions.length > 0 && (
                      <ul className="bw-suggestions">
                        {burgerSuggestions.map((b) => (
                          <li key={b.id} onClick={() => selectBurger(b)}>
                            {b.name}
                          </li>
                        ))}
                      </ul>
                    )}
                    {!selectedRestaurant && (
                      <p className="bw-helper">
                        Escribe el nombre. Si eliges un restaurante verás sugerencias.
                      </p>
                    )}
                  </div>
                </>
              )}

              <div className="bw-field">
                <span className="bw-label" style={{ marginBottom: 6 }}>
                  Puntuación
                </span>
                <Rating
                  name="entry-rating"
                  value={Number(ratingInput)}
                  precision={0.5}
                  onChange={(_e, newValue) => {
                    if (newValue) setRatingInput(String(newValue));
                  }}
                  sx={{
                    color: colors.accent,
                    '& .MuiRating-iconEmpty': {
                      color: colors.textMuted,
                    },
                    fontSize: 32,
                    alignSelf: 'center',
                  }}
                />
              </div>

              <div className="bw-field">
                <TextField
                  id="bw-price"
                  label="Precio por persona (€)"
                  type="number"
                  inputProps={{ step: 0.01, min: 0 }}
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  fullWidth
                />
              </div>

              {formError && <p style={{ color: 'red', fontSize: 12 }}>{formError}</p>}
            </div>

            <div className="bw-modal-actions">
              <Button
                type="button"
                variant="outlined"
                onClick={requestClose}
                disabled={formLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="contained" disabled={isSubmitDisabled}>
                {formLoading ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </ThemeProvider>
  );
}
