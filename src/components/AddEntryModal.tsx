import { type FormEvent, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import {
  Button,
  Checkbox,
  CssBaseline,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  ThemeProvider,
  createTheme,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';

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
};

export function AddEntryModal({ open, onClose, onSaved, session, theme }: AddEntryModalProps) {
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
    setFormError(null);
  }, [open]);

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
      setFormError('Indica el precio total.');
      return;
    }

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
      // 1) Asegurar restaurante
      let restaurantId = selectedRestaurant?.id ?? null;

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
        }
      }

      // 3) Crear la entry
      const iso = new Date(datetimeInput).toISOString();

      const { error: insertError } = await supabase.from('entries').insert({
        user_id: session.user.id,
        restaurant_id: restaurantId,
        burger_id: burgerId,
        datetime: iso,
        is_burger: isBurger,
        rating,
        price,
        photo_url: null,
      });

      if (insertError) {
        throw insertError;
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

          <form className="bw-modal-body" onSubmit={handleAddEntry}>
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

            <FormControlLabel
              control={
                <Checkbox
                  checked={isBurger}
                  onChange={(e) => setIsBurger(e.target.checked)}
                />
              }
              label="Es hamburguesa"
              className="bw-checkbox-row"
            />

            {isBurger && (
              <>
                <div className="bw-field">
                  <FormControl fullWidth>
                    <InputLabel id="bw-meat-type-label">Tipo de carne</InputLabel>
                    <Select
                      labelId="bw-meat-type-label"
                      id="bw-meat-type"
                      value={burgerType}
                      label="Tipo de carne"
                      onChange={(e: SelectChangeEvent<MeatType>) =>
                        setBurgerType(e.target.value as MeatType)
                      }
                    >
                      <MenuItem value="beef">Ternera</MenuItem>
                      <MenuItem value="chicken">Pollo</MenuItem>
                      <MenuItem value="vegan">Vegana</MenuItem>
                      <MenuItem value="other">Otra</MenuItem>
                    </Select>
                  </FormControl>
                </div>

                <div className="bw-field">
                  <TextField
                    id="bw-burger-name"
                    label="Hamburguesa"
                    value={burgerInput}
                    onChange={(e) => handleBurgerChange(e.target.value)}
                    placeholder="Emmy, Big Mac..."
                    autoComplete="off"
                    disabled={!selectedRestaurant}
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
                    <p className="bw-helper">Selecciona primero un restaurante.</p>
                  )}
                </div>
              </>
            )}

            <div className="bw-field">
              <TextField
                id="bw-price"
                label="Precio total (€)"
                type="number"
                inputProps={{ step: 0.01, min: 0 }}
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                fullWidth
              />
            </div>

            <div className="bw-field">
              <FormControl fullWidth>
                <InputLabel id="bw-rating-label">Puntuación (1-5)</InputLabel>
                <Select
                  labelId="bw-rating-label"
                  id="bw-rating"
                  value={ratingInput}
                  label="Puntuación (1-5)"
                  onChange={(e: SelectChangeEvent<string>) => setRatingInput(e.target.value)}
                >
                  <MenuItem value="1">1</MenuItem>
                  <MenuItem value="2">2</MenuItem>
                  <MenuItem value="3">3</MenuItem>
                  <MenuItem value="4">4</MenuItem>
                  <MenuItem value="5">5</MenuItem>
                </Select>
              </FormControl>
            </div>

          {formError && <p style={{ color: 'red', fontSize: 12 }}>{formError}</p>}

          <div className="bw-modal-actions">
            <Button
              type="button"
              variant="outlined"
              onClick={requestClose}
              disabled={formLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="contained" disabled={formLoading}>
                {formLoading ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </ThemeProvider>
  );
}
