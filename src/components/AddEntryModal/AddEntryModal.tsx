import { type ChangeEvent, type FormEvent, type SyntheticEvent, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';
import { useTranslation } from 'react-i18next';
import '../../styles/shared.css';
import './AddEntryModal.css';
import {
  Button,
  CssBaseline,
  TextField,
  ThemeProvider,
  Rating,
  MenuItem,
} from '@mui/material';
import { addEntrySchema } from '../../schemas/addEntrySchema';
import { formatLocalDateTime, MIN_DATETIME_STRING } from '../../utils/datetime';
import { createAppTheme } from '../../theme';
import { compressImage } from '../../utils/image';
import { lockBodyScroll } from '../../utils/scrollLock';
import ReactCrop, { convertToPixelCrop, type Crop, type PixelCrop } from 'react-image-crop';
import { cropImageFile } from '../../utils/cropImage';
import { usePreferences } from '../../context/PreferencesContext';
import 'react-image-crop/dist/ReactCrop.css';
type MeatType = 'beef' | 'chicken' | 'vegan' | 'other';
type BurgerSource = 'restaurant' | 'homemade';

type RestaurantOption = {
  id: string;
  name: string;
};

type BurgerOption = {
  id: string;
  name: string | null;
  meat_type: MeatType | null;
};

const normalizeName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();

const normalizeCompact = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .trim()
    .toLowerCase();

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
    currency?: string | null;
    is_burger: boolean;
    additionalNotes?: string | null;
    restaurantId?: string | null;
    restaurantName?: string | null;
    burgerId?: string | null;
    burgerName?: string | null;
    meatType?: MeatType | null;
    photoUrl?: string | null;
    burgerOrigin?: BurgerSource | null;
    ingredients?: string | null;
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
  const { t } = useTranslation();
  const { currency: defaultCurrency } = usePreferences();
  const [maxDateTime, setMaxDateTime] = useState(() => formatLocalDateTime(new Date()));
  const [datetimeInput, setDatetimeInput] = useState('');
  const [restaurantInput, setRestaurantInput] = useState('');
  const [restaurantSuggestions, setRestaurantSuggestions] = useState<RestaurantOption[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantOption | null>(null);

  const [isBurger, setIsBurger] = useState(true);
  const [burgerType, setBurgerType] = useState<MeatType>('beef');
  const [burgerSource, setBurgerSource] = useState<BurgerSource>('restaurant');
  const [burgerInput, setBurgerInput] = useState('');
  const [burgerSuggestions, setBurgerSuggestions] = useState<BurgerOption[]>([]);
  const [selectedBurger, setSelectedBurger] = useState<BurgerOption | null>(null);
  const [ingredientsInput, setIngredientsInput] = useState('');

  const [priceInput, setPriceInput] = useState('');
  const [priceCurrency, setPriceCurrency] = useState<string>(defaultCurrency);
  const [ratingInput, setRatingInput] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const NOTES_LIMIT = 250;
  const INGREDIENTS_LIMIT = 200;
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [photoCompressing, setPhotoCompressing] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoCropSrc, setPhotoCropSrc] = useState<string | null>(null);
  const [photoCropFile, setPhotoCropFile] = useState<File | null>(null);
  const [photoCrop, setPhotoCrop] = useState<Crop>();
  const [photoCropArea, setPhotoCropArea] = useState<PixelCrop | null>(null);
  const [cropIsPortrait, setCropIsPortrait] = useState(false);
  const [photoStageHeight, setPhotoStageHeight] = useState(360);
  const [photoNaturalSize, setPhotoNaturalSize] = useState<{ width: number; height: number } | null>(null);

  const { colors, muiTheme } = useMemo(() => createAppTheme(theme), [theme]);
  const currencyOptions = useMemo(
    () => [
      { value: 'EUR', label: '€ EUR' },
      { value: 'THB', label: '฿ THB' },
      { value: 'USD', label: '$ USD' },
      { value: 'GBP', label: '£ GBP' },
    ],
    []
  );

  useEffect(() => {
    if (!open) return;
    return lockBodyScroll();
  }, [open]);

  useEffect(() => {
    if (!photoCropSrc) {
      setCropIsPortrait(false);
      setPhotoCrop(undefined);
      setPhotoCropArea(null);
      setPhotoStageHeight(360);
    }
  }, [photoCropSrc]);

  // Reset form when opening
  useEffect(() => {
    if (!open) return;
    const nowString = formatLocalDateTime(new Date());
    setMaxDateTime(nowString);
    setIsClosing(false);
    if (mode === 'edit' && entry) {
      const date = new Date(entry.datetime);
      const iso = formatLocalDateTime(date); // yyyy-MM-ddTHH:mm
      const isHomemade = entry.burgerOrigin === 'homemade';
      setDatetimeInput(iso);
      setRestaurantInput(isHomemade ? '' : entry.restaurantName ?? '');
      setRestaurantSuggestions([]);
      setSelectedRestaurant(
        isHomemade || !entry.restaurantId
          ? null
          : { id: entry.restaurantId, name: entry.restaurantName ?? '' }
      );
      setIsBurger(true);
      setBurgerType(entry.meatType ?? 'beef');
      setBurgerSource(entry.burgerOrigin ?? 'restaurant');
      setBurgerInput(isHomemade ? '' : entry.burgerName ?? '');
      setBurgerSuggestions([]);
      setSelectedBurger(
        isHomemade || !entry.burgerId
          ? null
          : { id: entry.burgerId, name: entry.burgerName ?? null, meat_type: entry.meatType ?? null }
      );
      setIngredientsInput(entry.ingredients ?? '');
      setPriceInput(entry.price != null ? String(entry.price) : '');
      setRatingInput(entry.rating != null ? String(entry.rating) : '');
      setPriceCurrency(entry.currency ?? defaultCurrency);
      setAdditionalNotes(entry.additionalNotes ?? '');
      setPhotoFile(null);
      setPhotoPreview(entry.photoUrl ?? null);
      setPhotoCropSrc(null);
      setPhotoCropFile(null);
      setPhotoCropArea(null);
      setPhotoCrop(undefined);
      setCropIsPortrait(false);
      setPhotoStageHeight(360);
      setPhotoNaturalSize(null);
    } else {
      setDatetimeInput(nowString);
      setRestaurantInput('');
      setRestaurantSuggestions([]);
      setSelectedRestaurant(null);
      setIsBurger(true);
      setBurgerType('beef');
      setBurgerSource('restaurant');
      setBurgerInput('');
      setBurgerSuggestions([]);
      setSelectedBurger(null);
      setIngredientsInput('');
      setPriceInput('');
      setRatingInput('');
      setPriceCurrency(defaultCurrency);
      setAdditionalNotes('');
      setPhotoFile(null);
      setPhotoPreview(null);
      setPhotoCropSrc(null);
      setPhotoCropFile(null);
      setPhotoCropArea(null);
      setPhotoCrop(undefined);
      setCropIsPortrait(false);
      setPhotoStageHeight(360);
      setPhotoNaturalSize(null);
    }
    setFormError(null);
  }, [open, mode, entry]);

  const requestClose = () => {
    if (formLoading) return;
    setIsClosing(true);
    setTimeout(() => onClose(), 260);
  };

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

    const trimmedValue = value.trim();
    const normalizedValue = normalizeName(trimmedValue);
    const compactValue = normalizeCompact(trimmedValue);
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, name')
      .or(`name.ilike.%${trimmedValue}%,name_normalized.ilike.%${normalizedValue}%,name_compact.ilike.%${compactValue}%`)
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

  const handlePhotoChange = async (file?: File | null) => {
    if (!file) {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoFile(null);
      setPhotoPreview(null);
      setPhotoCropSrc(null);
      setPhotoCropFile(null);
      setPhotoCropArea(null);
      setPhotoCrop(undefined);
      setPhotoStageHeight(360);
      setPhotoNaturalSize(null);
      return;
    }
    if (photoCropSrc) URL.revokeObjectURL(photoCropSrc);
    const src = URL.createObjectURL(file);
    setPhotoCropSrc(src);
    setPhotoCropFile(file);
    setPhotoCrop(undefined);
    setPhotoCropArea(null);
    setPhotoStageHeight(360);
    setPhotoNaturalSize(null);
  };

  const handlePhotoInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    void handlePhotoChange(file);
  };

  const removePhoto = () => handlePhotoChange(null);

  const handleCropImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    const isPortrait = naturalHeight >= naturalWidth;
    setCropIsPortrait(isPortrait);
    setPhotoNaturalSize({ width: naturalWidth, height: naturalHeight });
    const stageEl = event.currentTarget.closest('.bw-cropper-stage') as HTMLElement | null;
    const containerWidth =
      stageEl?.clientWidth ?? Math.max(260, Math.min(window.innerWidth - 32, 480) - 24);
    const maxContainerHeight = Math.max(260, window.innerHeight - 220);
    const scale = Math.min(containerWidth / naturalWidth, maxContainerHeight / naturalHeight, 1);
    const nextStageHeight = Math.max(260, Math.round(naturalHeight * scale));
    setPhotoStageHeight(nextStageHeight);
    const defaultCrop: Crop = { unit: '%', width: 90, height: 90, x: 5, y: 5 };
    setPhotoCrop(defaultCrop);
    setPhotoCropArea(convertToPixelCrop(defaultCrop, naturalWidth, naturalHeight));
  };

  const handlePhotoCropConfirm = async () => {
    if (!photoCropFile || !photoCropArea || photoCropArea.width <= 0 || photoCropArea.height <= 0) return;
    setPhotoCompressing(true);
    try {
      const croppedFile = await cropImageFile(photoCropFile, photoCropArea);
      const compressed = await compressImage(croppedFile);
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      const url = URL.createObjectURL(compressed);
      setPhotoFile(compressed);
      setPhotoPreview(url);
    } catch (err) {
      console.error(err);
      setFormError('No se pudo procesar la imagen.');
    } finally {
      if (photoCropSrc) URL.revokeObjectURL(photoCropSrc);
      setPhotoCropSrc(null);
      setPhotoCropFile(null);
      setPhotoCropArea(null);
      setPhotoCrop(undefined);
      setCropIsPortrait(false);
      setPhotoStageHeight(360);
      setPhotoCompressing(false);
    }
  };

  const handlePhotoCropCancel = () => {
    if (photoCropSrc) URL.revokeObjectURL(photoCropSrc);
    setPhotoCropSrc(null);
    setPhotoCropFile(null);
    setPhotoCropArea(null);
    setPhotoCrop(undefined);
    setCropIsPortrait(false);
    setPhotoStageHeight(360);
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

    const validation = addEntrySchema.safeParse({
      datetime: datetimeInput,
      restaurant: restaurantInput,
      price: priceInput,
      currency: priceCurrency,
      rating: ratingInput,
      isBurger,
      burger: burgerInput,
      burgerOrigin: isBurger ? burgerSource : '',
      ingredients: ingredientsInput,
      additionalNotes,
    });

    if (!validation.success) {
      setFormError(validation.error.issues[0]?.message ?? 'Revisa los datos.');
      return;
    }

    const parsed = validation.data;
    const entryId = mode === 'edit' && entry ? entry.id : null;
    const price = Number(parsed.price.replace(',', '.'));
    const rating = Number(parsed.rating);
    const notes = (parsed.additionalNotes?.trim() ?? '').slice(0, NOTES_LIMIT);
    const additionalNotesValue = notes ? notes : null;
    const burgerOriginValue = isBurger ? burgerSource : null;
    const ingredientsValue =
      isBurger && burgerSource === 'homemade'
        ? (parsed.ingredients?.trim() ?? '').slice(0, INGREDIENTS_LIMIT) || null
        : null;

    setFormLoading(true);

    try {
      const trimmedRestaurant = restaurantInput.trim();
      const normalizedRestaurant = normalizeName(trimmedRestaurant);
      const compactRestaurant = normalizeCompact(trimmedRestaurant);
      const editingSameRestaurant =
        mode === 'edit' &&
        entry?.restaurantName &&
        normalizeName(entry.restaurantName.trim()) === normalizedRestaurant;

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
      let restaurantId: string | null = null;

      if (!isBurger || burgerSource === 'restaurant') {
        restaurantId = selectedRestaurant?.id ?? (editingSameRestaurant ? entry?.restaurantId ?? null : null);

        if (!restaurantId) {
          const { data, error } = await supabase
            .from('restaurants')
            .upsert(
              {
                name: trimmedRestaurant,
                name_normalized: normalizedRestaurant,
                name_compact: compactRestaurant,
                is_chain: false,
                created_by: session.user.id,
              },
              { onConflict: 'name_normalized' }
            )
            .select('id, name')
            .single();

          if (error || !data) {
            throw error ?? new Error('No se pudo crear el restaurante');
          }

          restaurantId = data.id;
          setSelectedRestaurant({ id: data.id, name: data.name });
        }
        if (!restaurantId) {
          throw new Error('No se pudo determinar el restaurante.');
        }
      }

      // 2) Asegurar hamburguesa (si corresponde)
      let burgerId: string | null = null;

      if (isBurger && burgerSource === 'restaurant') {
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
            burger_origin: burgerOriginValue,
            meat_type: isBurger ? burgerType : null,
            rating,
            price,
            currency: priceCurrency,
            photo_url: photoUrl,
            additional_notes: additionalNotesValue,
            homemade_ingredients: ingredientsValue,
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
          burger_origin: burgerOriginValue,
          meat_type: isBurger ? burgerType : null,
          rating,
          price,
          currency: priceCurrency,
          photo_url: photoUrl,
          additional_notes: additionalNotesValue,
          homemade_ingredients: ingredientsValue,
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
    ((!isBurger || burgerSource === 'restaurant') && !restaurantInput.trim()) ||
    !priceInput.trim() ||
    !ratingInput.trim() ||
    (isBurger && burgerSource === 'homemade' && !ingredientsInput.trim()) ||
    (isBurger && burgerSource === 'restaurant' && !burgerInput.trim());
  const isCropSelectionReady = Boolean(photoCropArea && photoCropArea.width > 0 && photoCropArea.height > 0);

  if (!open) return null;

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
              <h2 className="bw-modal-title">
                {t(mode === 'edit' ? 'addEntry.titleEdit' : 'addEntry.titleCreate')}
              </h2>
              <p className="bw-modal-subtitle">{t('addEntry.subtitle')}</p>
            </div>
            <Button variant="outlined" size="small" onClick={requestClose} disabled={formLoading}>
              {t('common.close')}
            </Button>
          </div>

          <form className="bw-modal-form" onSubmit={handleAddEntry}>
            <div className="bw-modal-fields">
              <div className="bw-field">
                <span className="bw-label">{t('addEntry.photoLabel')}</span>
                <div className="bw-photo-card">
                  {photoPreview ? (
                    <>
                      <img src={photoPreview} alt={t('addEntry.photoAlt')} className="bw-photo-preview" />
                      <div className="bw-photo-actions">
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={removePhoto}
                          disabled={photoCompressing || formLoading}
                        >
                          {t('addEntry.removePhoto')}
                        </Button>
                        <Button
                          variant="contained"
                          component="label"
                          size="small"
                          disabled={photoCompressing || formLoading}
                        >
                          {t('addEntry.changePhoto')}
                          <input
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={handlePhotoInputChange}
                          />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Button
                      variant="outlined"
                      component="label"
                      size="small"
                      disabled={photoCompressing || formLoading}
                    >
                      {t('addEntry.addPhoto')}
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={handlePhotoInputChange}
                      />
                    </Button>
                  )}
                </div>
              </div>

              <div className="bw-field">
                <TextField
                id="bw-datetime"
                label={t('addEntry.datetime')}
                type="datetime-local"
                value={datetimeInput}
                onChange={(e) => setDatetimeInput(e.target.value)}
                fullWidth
                inputProps={{ min: MIN_DATETIME_STRING, max: maxDateTime }}
                InputLabelProps={{ shrink: true }}
              />
            </div>

              {isBurger && (
                <>
                  <div className="bw-burger-type-block">
                    <div className="bw-field">
                      <span className="bw-label">{t('addEntry.burgerType', { defaultValue: 'Burger type' })}</span>
                      <div className="bw-meat-grid">
                        {[
                          {
                            value: 'beef',
                            label: t('addEntry.beef'),
                            icon: <img src="/meat.png" alt={t('addEntry.beef')} className="bw-meat-icon-img" />,
                          },
                          {
                            value: 'chicken',
                            label: t('addEntry.chicken'),
                            icon: <img src="/chicken-leg.png" alt={t('addEntry.chicken')} className="bw-meat-icon-img" />,
                          },
                          {
                            value: 'vegan',
                            label: t('addEntry.vegan'),
                            icon: <img src="/plant.png" alt={t('addEntry.vegan')} className="bw-meat-icon-img" />,
                          },
                          {
                            value: 'other',
                            label: t('addEntry.other'),
                            icon: <img src="/question-mark.png" alt={t('addEntry.other')} className="bw-meat-icon-img" />,
                          },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            className={`bw-meat-card ${burgerType === opt.value ? 'is-active' : ''}`}
                            onClick={() => setBurgerType(opt.value as MeatType)}
                          >
                            <span className="bw-meat-emoji">{opt.icon}</span>
                            <span className="bw-meat-label">{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="bw-field">
                      <span className="bw-label">{t('addEntry.origin')}</span>
                      <div className="bw-meat-grid bw-source-grid">
                        {[
                          {
                            value: 'homemade',
                            label: t('addEntry.homemade'),
                            icon: <img src="/homemade.png" alt={t('addEntry.homemade')} className="bw-meat-icon-img" />,
                          },
                          {
                            value: 'restaurant',
                            label: t('addEntry.restaurant'),
                            icon: <img src="/dollar.png" alt={t('addEntry.restaurant')} className="bw-meat-icon-img" />,
                          },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            className={`bw-meat-card ${burgerSource === opt.value ? 'is-active' : ''}`}
                            onClick={() => {
                              setBurgerSource(opt.value as BurgerSource);
                              if (opt.value === 'restaurant') {
                                setIngredientsInput('');
                              } else {
                                setRestaurantInput('');
                                setRestaurantSuggestions([]);
                                setSelectedRestaurant(null);
                                setBurgerInput('');
                                setBurgerSuggestions([]);
                                setSelectedBurger(null);
                              }
                            }}
                          >
                            <span className="bw-meat-emoji">{opt.icon}</span>
                            <span className="bw-meat-label">{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {burgerSource === 'homemade' && (
                    <div className="bw-field">
                      <TextField
                        id="bw-ingredients"
                        label={t('addEntry.ingredientsLabel')}
                        value={ingredientsInput}
                        onChange={(e) => setIngredientsInput(e.target.value)}
                        placeholder={t('addEntry.ingredientsPlaceholder')}
                        fullWidth
                        multiline
                        minRows={2}
                        inputProps={{ maxLength: INGREDIENTS_LIMIT }}
                      />
                    </div>
                  )}
                </>
              )}

              {(!isBurger || burgerSource === 'restaurant') && (
                <div className="bw-field">
                  <TextField
                    id="bw-restaurant"
                    label={t('addEntry.restaurantLabel')}
                    value={restaurantInput}
                    onChange={(e) => handleRestaurantChange(e.target.value)}
                    placeholder={t('addEntry.restaurantPlaceholder')}
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
              )}

              {isBurger && burgerSource === 'restaurant' && (
                <div className="bw-field">
                  <TextField
                    id="bw-burger-name"
                    label={t('addEntry.burgerLabel')}
                    value={burgerInput}
                    onChange={(e) => handleBurgerChange(e.target.value)}
                    placeholder={t('addEntry.burgerPlaceholder')}
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
                      {t('addEntry.nameHelp')}
                    </p>
                  )}
                </div>
              )}

              <div className="bw-field">
                <span className="bw-label" style={{ marginBottom: 6 }}>
                  {t('addEntry.score')}
                </span>
                <Rating
                  name="entry-rating"
                  value={ratingInput ? Number(ratingInput) : null}
                  precision={0.5}
                  onChange={(_e, newValue) => {
                    setRatingInput(newValue ? String(newValue) : '');
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
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '3fr 2fr', // 60/40
                    gap: 12,
                    alignItems: 'flex-end',
                  }}
                >
                  <TextField
                    id="bw-price"
                    label={t('addEntry.priceLabel', { currency: priceCurrency })}
                    type="number"
                    inputProps={{ step: 0.01, min: 0 }}
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    fullWidth
                    sx={{ minWidth: 0 }}
                  />
                  <TextField
                    id="bw-price-currency"
                    select
                    label={t('addEntry.priceCurrency')}
                    value={priceCurrency}
                    onChange={(e) => setPriceCurrency(e.target.value)}
                    fullWidth
                    sx={{
                      minWidth: 0,
                    }}
                    SelectProps={{ MenuProps: { disablePortal: true } }}
                  >
                    {currencyOptions.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </div>
              </div>

          <div className="bw-field">
            <TextField
              id="bw-notes"
              label={t('addEntry.notesLabel')}
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder={t('addEntry.notesPlaceholder')}
              fullWidth
              multiline
              minRows={3}
              inputProps={{ maxLength: NOTES_LIMIT }}
            />
            <div className="bw-helper" style={{ textAlign: 'right', marginTop: 4 }}>
              {additionalNotes.length}/{NOTES_LIMIT}
            </div>
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
                {t('addEntry.cancel')}
              </Button>
              <Button type="submit" variant="contained" disabled={isSubmitDisabled}>
                {formLoading ? t('addEntry.saving') : t('addEntry.save')}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {photoCropSrc && (
        <div className="bw-photo-viewer-backdrop" onClick={handlePhotoCropCancel}>
          <div className="bw-cropper" onClick={(e) => e.stopPropagation()}>
            <div
              className={`bw-cropper-stage ${cropIsPortrait ? 'is-portrait' : ''}`}
              style={{ height: photoStageHeight }}
            >
              <div className="bw-react-crop">
                <ReactCrop
                  crop={photoCrop}
                  onChange={(_nextCrop, percentCrop) => {
                    setPhotoCrop(percentCrop);
                    if (photoNaturalSize) {
                      setPhotoCropArea(
                        convertToPixelCrop(
                          percentCrop,
                          photoNaturalSize.width,
                          photoNaturalSize.height
                        )
                      );
                    }
                  }}
                  onComplete={() => {
                    if (photoNaturalSize && photoCrop) {
                      setPhotoCropArea(
                        convertToPixelCrop(photoCrop, photoNaturalSize.width, photoNaturalSize.height)
                      );
                    }
                  }}
                  minHeight={80}
                  minWidth={80}
                  keepSelection
                >
                  <img src={photoCropSrc} alt={t('addEntry.cropAlt')} onLoad={handleCropImageLoad} />
                </ReactCrop>
              </div>
            </div>
            <div className="bw-cropper-actions">
              <Button variant="outlined" onClick={handlePhotoCropCancel} disabled={photoCompressing}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="contained"
                onClick={handlePhotoCropConfirm}
                disabled={photoCompressing || !isCropSelectionReady}
              >
                {t('addEntry.crop')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ThemeProvider>
  );
}
