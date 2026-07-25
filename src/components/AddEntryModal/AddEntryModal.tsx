import {
  type ChangeEvent,
  type FormEvent,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowBackRounded,
  CameraAltRounded,
  CloseRounded,
  HomeRounded,
  PhotoLibraryRounded,
  RestaurantRounded,
  Star,
  StarBorder,
  StarHalf,
} from '@mui/icons-material';
import {
  Button,
  CssBaseline,
  MenuItem,
  TextField,
  ThemeProvider,
} from '@mui/material';
import ReactCrop, {
  convertToPixelCrop,
  type Crop,
  type PixelCrop,
} from 'react-image-crop';
import { useTranslation } from 'react-i18next';
import { usePreferences } from '../../context/PreferencesContext';
import { supabase } from '../../lib/supabaseClient';
import {
  addEntrySchema,
  type AddEntrySchema,
} from '../../schemas/addEntrySchema';
import { createAppTheme } from '../../theme';
import { cropImageFile } from '../../utils/cropImage';
import {
  formatLocalDateTime,
  MIN_DATE,
  MIN_DATETIME_STRING,
} from '../../utils/datetime';
import {
  deleteEntryDraft,
  deleteEntryDraftPhoto,
  type EntryDraft,
  loadEntryDraft,
  uploadEntryDraftPhoto,
  upsertEntryDraft,
} from '../../utils/entryDraft';
import { compressImage } from '../../utils/image';
import { preparePhotoForCrop } from '../../utils/photoFile';
import { getPhotoTakenDateTime } from '../../utils/photoMetadata';
import { lockBodyScroll } from '../../utils/scrollLock';
import { ConfirmDialog } from '../common/ConfirmDialog';
import '../../styles/shared.css';
import 'react-image-crop/dist/ReactCrop.css';
import './AddEntryModal.css';

type MeatType = 'beef' | 'chicken' | 'vegan' | 'other';
type BurgerSource = 'restaurant' | 'homemade';
type WizardStep = 1 | 2 | 3 | 4 | 5;
type FieldName =
  | 'burgerSource'
  | 'restaurant'
  | 'burger'
  | 'ingredients'
  | 'rating'
  | 'price'
  | 'currency'
  | 'datetime'
  | 'additionalNotes';

type RestaurantOption = {
  id: string;
  name: string;
};

type BurgerOption = {
  id: string;
  name: string | null;
  meat_type: MeatType | null;
};

type RestaurantReviewState = {
  name: string;
  suggestions: RestaurantOption[];
} | null;

type RatingPickerProps = {
  value: number | null;
  onChange: (value: number) => void;
  color: string;
  emptyColor: string;
  label: string;
};

type AddEntryModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  session: Session;
  theme: 'light' | 'dark';
  mode: 'create' | 'edit';
  initialRestaurant?: RestaurantOption | null;
  initialBurger?: BurgerOption | null;
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

const NOTES_LIMIT = 250;
const INGREDIENTS_LIMIT = 200;
const TOTAL_STEPS = 5;

function RatingPicker({
  value,
  onChange,
  color,
  emptyColor,
  label,
}: Readonly<RatingPickerProps>) {
  return (
    <div className="bw-rating-picker" role="group" aria-label={label}>
      {Array.from({ length: 5 }, (_, index) => {
        const starValue = index + 1;
        const isFull = value != null && value >= starValue;
        const isHalf =
          value != null && value >= starValue - 0.5 && value < starValue;
        const Icon = isFull ? Star : isHalf ? StarHalf : StarBorder;

        return (
          <span className="bw-rating-star" key={starValue}>
            <Icon
              className="bw-rating-icon"
              aria-hidden="true"
              sx={{ color: isFull || isHalf ? color : emptyColor }}
            />
            <button
              className="bw-rating-half bw-rating-half-left"
              type="button"
              aria-label={`${label} ${(starValue - 0.5).toFixed(1)}`}
              aria-pressed={value === starValue - 0.5}
              onClick={() => onChange(starValue - 0.5)}
            />
            <button
              className="bw-rating-half bw-rating-half-right"
              type="button"
              aria-label={`${label} ${starValue.toFixed(1)}`}
              aria-pressed={value === starValue}
              onClick={() => onChange(starValue)}
            />
          </span>
        );
      })}
    </div>
  );
}

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

const RESTAURANT_SEARCH_STOP_WORDS = new Set([
  'bar',
  'burger',
  'burgers',
  'hamburguesa',
  'hamburguesas',
  'hamburgueseria',
  'restaurant',
  'restaurante',
]);

const getRestaurantSearchTerms = (value: string) => {
  const normalizedValue = normalizeName(value);
  const compactValue = normalizeCompact(value);
  const tokenTerms = normalizedValue
    .split(' ')
    .filter(
      (term) =>
        term.length >= 3 && !RESTAURANT_SEARCH_STOP_WORDS.has(term),
    );

  return Array.from(
    new Set(
      [value.trim(), normalizedValue, compactValue, ...tokenTerms].filter(
        Boolean,
      ),
    ),
  );
};

const isObjectUrl = (value: string | null) =>
  Boolean(value?.startsWith('blob:'));

const getFileSignature = (file: File) =>
  `${file.name}:${file.size}:${file.lastModified}`;

export function AddEntryModal({
  open,
  onClose,
  onSaved,
  session,
  theme,
  mode,
  initialRestaurant,
  initialBurger,
  entry,
}: Readonly<AddEntryModalProps>) {
  const { t, i18n } = useTranslation();
  const { currency: defaultCurrency } = usePreferences();
  const { colors, muiTheme } = useMemo(
    () => createAppTheme(theme),
    [theme],
  );
  const currencyOptions = useMemo(
    () => [
      { value: 'EUR', label: '€ EUR' },
      { value: 'THB', label: '฿ THB' },
      { value: 'USD', label: '$ USD' },
      { value: 'GBP', label: '£ GBP' },
      { value: 'AED', label: 'د.إ AED' },
      { value: 'JPY', label: '¥ JPY' },
    ],
    [],
  );

  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [hasAdvanced, setHasAdvanced] = useState(false);
  const [maxDateTime, setMaxDateTime] = useState(() =>
    formatLocalDateTime(new Date()),
  );
  const [datetimeInput, setDatetimeInput] = useState('');
  const [datetimeManuallyEdited, setDatetimeManuallyEdited] = useState(false);
  const [restaurantInput, setRestaurantInput] = useState('');
  const [restaurantSuggestions, setRestaurantSuggestions] = useState<
    RestaurantOption[]
  >([]);
  const [selectedRestaurant, setSelectedRestaurant] =
    useState<RestaurantOption | null>(null);
  const [restaurantReview, setRestaurantReview] =
    useState<RestaurantReviewState>(null);
  const [restaurantApprovedName, setRestaurantApprovedName] = useState<
    string | null
  >(null);
  const [continueAfterRestaurantReview, setContinueAfterRestaurantReview] =
    useState(false);
  const [burgerType, setBurgerType] = useState<MeatType>('beef');
  const [burgerSource, setBurgerSource] = useState<BurgerSource | null>(null);
  const [pendingBurgerSource, setPendingBurgerSource] =
    useState<BurgerSource | null>(null);
  const [burgerInput, setBurgerInput] = useState('');
  const [burgerSuggestions, setBurgerSuggestions] = useState<BurgerOption[]>(
    [],
  );
  const [selectedBurger, setSelectedBurger] =
    useState<BurgerOption | null>(null);
  const [ingredientsInput, setIngredientsInput] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [priceCurrency, setPriceCurrency] = useState(defaultCurrency);
  const [ratingInput, setRatingInput] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [stepErrors, setStepErrors] = useState<
    Partial<Record<FieldName, string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftToResume, setDraftToResume] = useState<EntryDraft | null>(
    null,
  );
  const [photoCompressing, setPhotoCompressing] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoCropSrc, setPhotoCropSrc] = useState<string | null>(null);
  const [photoCropFile, setPhotoCropFile] = useState<File | null>(null);
  const [pendingPhotoDateTime, setPendingPhotoDateTime] = useState<
    string | null
  >(null);
  const [photoCrop, setPhotoCrop] = useState<Crop>();
  const [photoCropArea, setPhotoCropArea] = useState<PixelCrop | null>(null);
  const [cropIsPortrait, setCropIsPortrait] = useState(false);
  const [photoStageHeight, setPhotoStageHeight] = useState(360);
  const [photoNaturalSize, setPhotoNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const initialSnapshotRef = useRef('');
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const photoCardInputRef = useRef<HTMLInputElement | null>(null);
  const draftPhotoUrlRef = useRef<string | null>(null);
  const draftPhotoPathRef = useRef<string | null>(null);
  const draftUploadedPhotoSignatureRef = useRef<string | null>(null);
  const draftSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const draftAutosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const suppressDraftAutosaveRef = useRef(false);

  const makeSnapshot = useCallback(
    (overrides?: {
      datetime?: string;
      restaurant?: string;
      restaurantId?: string | null;
      source?: BurgerSource | null;
      burger?: string;
      burgerId?: string | null;
      ingredients?: string;
      price?: string;
      currency?: string;
      rating?: string;
      notes?: string;
      photo?: string | null;
      photoFileSignature?: string | null;
    }) =>
      JSON.stringify({
        datetime: overrides?.datetime ?? datetimeInput,
        restaurant: overrides?.restaurant ?? restaurantInput,
        restaurantId:
          overrides?.restaurantId !== undefined
            ? overrides.restaurantId
            : selectedRestaurant?.id ?? null,
        source:
          overrides?.source !== undefined ? overrides.source : burgerSource,
        burger: overrides?.burger ?? burgerInput,
        burgerId:
          overrides?.burgerId !== undefined
            ? overrides.burgerId
            : selectedBurger?.id ?? null,
        ingredients: overrides?.ingredients ?? ingredientsInput,
        price: overrides?.price ?? priceInput,
        currency: overrides?.currency ?? priceCurrency,
        rating: overrides?.rating ?? ratingInput,
        notes: overrides?.notes ?? additionalNotes,
        photo:
          overrides?.photo !== undefined ? overrides.photo : photoPreview,
        photoFileSignature:
          overrides?.photoFileSignature !== undefined
            ? overrides.photoFileSignature
            : photoFile
              ? `${photoFile.name}:${photoFile.size}:${photoFile.lastModified}`
              : photoCropFile
                ? `${photoCropFile.name}:${photoCropFile.size}:${photoCropFile.lastModified}`
                : null,
      }),
    [
      additionalNotes,
      burgerInput,
      burgerSource,
      datetimeInput,
      ingredientsInput,
      photoCropFile,
      photoFile,
      photoPreview,
      priceCurrency,
      priceInput,
      ratingInput,
      restaurantInput,
      selectedBurger?.id,
      selectedRestaurant?.id,
    ],
  );

  const hasProgress =
    makeSnapshot() !== initialSnapshotRef.current ||
    (mode === 'create' && hasAdvanced);
  const isBusy = formLoading || photoCompressing || draftSaving;

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement as HTMLElement | null;
    return lockBodyScroll();
  }, [open]);

  useEffect(() => {
    if (!open) {
      openerRef.current?.focus();
      return;
    }

    const nowString = formatLocalDateTime(new Date());
    setMaxDateTime(nowString);
    setCurrentStep(1);
    setHasAdvanced(false);
    setIsClosing(false);
    setExitConfirmOpen(false);
    setDraftSaving(false);
    setDraftToResume(null);
    setPendingBurgerSource(null);
    setContinueAfterRestaurantReview(false);
    setDatetimeManuallyEdited(false);
    setStepErrors({});
    setFormError(null);
    setRestaurantSuggestions([]);
    setBurgerSuggestions([]);
    setRestaurantReview(null);
    setRestaurantApprovedName(null);
    setPhotoCropSrc(null);
    setPhotoCropFile(null);
    setPendingPhotoDateTime(null);
    setPhotoCropArea(null);
    setPhotoCrop(undefined);
    setCropIsPortrait(false);
    setPhotoStageHeight(360);
    setPhotoNaturalSize(null);
    draftPhotoUrlRef.current = null;
    draftPhotoPathRef.current = null;
    draftUploadedPhotoSignatureRef.current = null;
    draftSaveQueueRef.current = Promise.resolve();
    suppressDraftAutosaveRef.current = false;
    if (draftAutosaveTimerRef.current) {
      clearTimeout(draftAutosaveTimerRef.current);
      draftAutosaveTimerRef.current = null;
    }

    if (mode === 'edit' && entry) {
      const isHomemade = entry.burgerOrigin === 'homemade';
      const datetime = formatLocalDateTime(new Date(entry.datetime));
      const restaurant = isHomemade ? '' : entry.restaurantName ?? '';
      const restaurantOption =
        isHomemade || !entry.restaurantId
          ? null
          : {
              id: entry.restaurantId,
              name: entry.restaurantName ?? '',
            };
      const burger = isHomemade ? '' : entry.burgerName ?? '';
      const burgerOption =
        isHomemade || !entry.burgerId
          ? null
          : {
              id: entry.burgerId,
              name: entry.burgerName ?? null,
              meat_type: entry.meatType ?? null,
            };
      const ingredients = entry.ingredients ?? '';
      const price = entry.price != null ? String(entry.price) : '';
      const rating = entry.rating != null ? String(entry.rating) : '';
      const currency = entry.currency ?? defaultCurrency;
      const notes = entry.additionalNotes ?? '';
      const photo = entry.photoUrl ?? null;
      const source = entry.burgerOrigin ?? 'restaurant';

      setDatetimeInput(datetime);
      setRestaurantInput(restaurant);
      setSelectedRestaurant(restaurantOption);
      setBurgerType(entry.meatType ?? 'beef');
      setBurgerSource(source);
      setBurgerInput(burger);
      setSelectedBurger(burgerOption);
      setIngredientsInput(ingredients);
      setPriceInput(price);
      setRatingInput(rating);
      setPriceCurrency(currency);
      setAdditionalNotes(notes);
      setPhotoFile(null);
      setPhotoPreview(photo);
      initialSnapshotRef.current = JSON.stringify({
        datetime,
        restaurant,
        restaurantId: restaurantOption?.id ?? null,
        source,
        burger,
        burgerId: burgerOption?.id ?? null,
        ingredients,
        price,
        currency,
        rating,
        notes,
        photo,
        photoFileSignature: null,
      });
      return;
    }

    const source: BurgerSource | null =
      initialRestaurant || initialBurger ? 'restaurant' : null;
    const restaurant = initialRestaurant?.name ?? '';
    const burger = initialBurger?.name ?? '';
    setDatetimeInput(nowString);
    setRestaurantInput(restaurant);
    setSelectedRestaurant(initialRestaurant ?? null);
    setBurgerType(initialBurger?.meat_type ?? 'beef');
    setBurgerSource(source);
    setBurgerInput(burger);
    setSelectedBurger(initialBurger ?? null);
    setIngredientsInput('');
    setPriceInput('');
    setRatingInput('');
    setPriceCurrency(defaultCurrency);
    setAdditionalNotes('');
    setPhotoFile(null);
    setPhotoPreview(null);
    initialSnapshotRef.current = JSON.stringify({
      datetime: nowString,
      restaurant,
      restaurantId: initialRestaurant?.id ?? null,
      source,
      burger,
      burgerId: initialBurger?.id ?? null,
      ingredients: '',
      price: '',
      currency: defaultCurrency,
      rating: '',
      notes: '',
      photo: null,
      photoFileSignature: null,
    });
  }, [
    defaultCurrency,
    entry,
    initialBurger,
    initialRestaurant,
    mode,
    open,
  ]);

  useEffect(() => {
    if (!open || mode !== 'create') return;
    let active = true;

    void loadEntryDraft(session.user.id)
      .then((draft) => {
        if (!active || !draft) return;
        draftPhotoUrlRef.current = draft.photo_url;
        draftPhotoPathRef.current = draft.photo_path;
        setDraftToResume(draft);
      })
      .catch((error) => {
        console.error('Error loading entry draft', error);
        if (active) setFormError(t('addEntry.draft.errors.load'));
      });

    return () => {
      active = false;
    };
  }, [mode, open, session.user.id, t]);

  useEffect(() => {
    if (!photoCropSrc) {
      setCropIsPortrait(false);
      setPhotoCrop(undefined);
      setPhotoCropArea(null);
      setPhotoStageHeight(360);
    }
  }, [photoCropSrc]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (isObjectUrl(photoPreview)) URL.revokeObjectURL(photoPreview!);
      if (isObjectUrl(photoCropSrc)) URL.revokeObjectURL(photoCropSrc!);
    },
    [photoCropSrc, photoPreview],
  );

  const resumeEntryDraft = () => {
    if (!draftToResume) return;
    const draft = draftToResume;
    const nextStep = Math.max(
      1,
      Math.min(TOTAL_STEPS, draft.current_step),
    ) as WizardStep;
    const restaurantOption =
      draft.restaurant_id && draft.restaurant_name
        ? { id: draft.restaurant_id, name: draft.restaurant_name }
        : null;
    const burgerOption =
      draft.burger_id && draft.burger_name
        ? {
            id: draft.burger_id,
            name: draft.burger_name,
            meat_type: draft.meat_type,
          }
        : null;

    setCurrentStep(nextStep);
    setHasAdvanced(true);
    setDatetimeInput(draft.datetime_input);
    setDatetimeManuallyEdited(draft.datetime_manually_edited);
    setBurgerSource(draft.burger_origin);
    setRestaurantInput(draft.restaurant_name ?? '');
    setSelectedRestaurant(restaurantOption);
    setRestaurantApprovedName(draft.restaurant_approved_name);
    setBurgerInput(draft.burger_name ?? '');
    setSelectedBurger(burgerOption);
    setBurgerType(draft.meat_type);
    setIngredientsInput(draft.homemade_ingredients);
    setRatingInput(draft.rating_input);
    setPriceInput(draft.price_input);
    setPriceCurrency(draft.currency || defaultCurrency);
    setAdditionalNotes(draft.additional_notes);
    setPhotoFile(null);
    setPhotoPreview(draft.photo_url);
    setStepErrors({});
    setFormError(null);
    draftPhotoUrlRef.current = draft.photo_url;
    draftPhotoPathRef.current = draft.photo_path;
    draftUploadedPhotoSignatureRef.current = null;
    suppressDraftAutosaveRef.current = false;
    setDraftToResume(null);
  };

  const persistCurrentDraft = useCallback(async () => {
    const previousPhotoUrl = draftPhotoUrlRef.current;
    const previousPhotoPath = draftPhotoPathRef.current;
    let nextPhotoUrl = previousPhotoUrl;
    let nextPhotoPath = previousPhotoPath;
    let uploadedPhotoSignature =
      draftUploadedPhotoSignatureRef.current;
    let newPhotoPath: string | null = null;

    if (photoFile) {
      const signature = getFileSignature(photoFile);
      if (signature !== draftUploadedPhotoSignatureRef.current) {
        const uploaded = await uploadEntryDraftPhoto(
          session.user.id,
          photoFile,
        );
        nextPhotoUrl = uploaded.url;
        nextPhotoPath = uploaded.path;
        uploadedPhotoSignature = signature;
        newPhotoPath = uploaded.path;
      }
    } else if (!photoPreview) {
      nextPhotoUrl = null;
      nextPhotoPath = null;
      uploadedPhotoSignature = null;
    } else if (!isObjectUrl(photoPreview)) {
      nextPhotoUrl = photoPreview;
    }

    try {
      const savedDraft = await upsertEntryDraft({
        user_id: session.user.id,
        current_step: currentStep,
        datetime_input: datetimeInput,
        datetime_manually_edited: datetimeManuallyEdited,
        burger_origin: burgerSource,
        restaurant_id: selectedRestaurant?.id ?? null,
        restaurant_name: restaurantInput.trim() || null,
        restaurant_approved_name: restaurantApprovedName,
        burger_id: selectedBurger?.id ?? null,
        burger_name: burgerInput.trim() || null,
        meat_type: burgerType,
        homemade_ingredients: ingredientsInput,
        rating_input: ratingInput,
        price_input: priceInput,
        currency: priceCurrency,
        additional_notes: additionalNotes,
        photo_url: nextPhotoUrl,
        photo_path: nextPhotoPath,
      });

      draftPhotoUrlRef.current = savedDraft.photo_url;
      draftPhotoPathRef.current = savedDraft.photo_path;
      draftUploadedPhotoSignatureRef.current = uploadedPhotoSignature;

      if (
        previousPhotoPath &&
        previousPhotoPath !== savedDraft.photo_path
      ) {
        void deleteEntryDraftPhoto(previousPhotoPath).catch((error) => {
          console.error('Error deleting replaced draft photo', error);
        });
      }
    } catch (error) {
      if (newPhotoPath) {
        void deleteEntryDraftPhoto(newPhotoPath).catch(() => undefined);
      }
      throw error;
    }
  }, [
    additionalNotes,
    burgerInput,
    burgerSource,
    burgerType,
    currentStep,
    datetimeInput,
    datetimeManuallyEdited,
    ingredientsInput,
    photoFile,
    photoPreview,
    priceCurrency,
    priceInput,
    ratingInput,
    restaurantApprovedName,
    restaurantInput,
    selectedBurger?.id,
    selectedRestaurant?.id,
    session.user.id,
  ]);

  const queueCurrentDraftSave = useCallback(() => {
    const queuedSave = draftSaveQueueRef.current.then(
      persistCurrentDraft,
      persistCurrentDraft,
    );
    draftSaveQueueRef.current = queuedSave.then(
      () => undefined,
      () => undefined,
    );
    return queuedSave;
  }, [persistCurrentDraft]);

  const stopDraftAutosave = useCallback(() => {
    suppressDraftAutosaveRef.current = true;
    if (draftAutosaveTimerRef.current) {
      clearTimeout(draftAutosaveTimerRef.current);
      draftAutosaveTimerRef.current = null;
    }
  }, []);

  const forceClose = useCallback(() => {
    if (isObjectUrl(photoPreview)) URL.revokeObjectURL(photoPreview!);
    if (isObjectUrl(photoCropSrc)) URL.revokeObjectURL(photoCropSrc!);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setExitConfirmOpen(false);
    setIsClosing(true);
    closeTimerRef.current = setTimeout(onClose, 260);
  }, [onClose, photoCropSrc, photoPreview]);

  const clearStoredDraft = useCallback(
    async (photoPath: string | null) => {
      await deleteEntryDraft(session.user.id);
      if (photoPath) await deleteEntryDraftPhoto(photoPath);
      draftPhotoUrlRef.current = null;
      draftPhotoPathRef.current = null;
      draftUploadedPhotoSignatureRef.current = null;
    },
    [session.user.id],
  );

  const saveDraftAndClose = async () => {
    stopDraftAutosave();
    setDraftSaving(true);
    setFormError(null);
    try {
      await queueCurrentDraftSave();
      forceClose();
    } catch (error) {
      console.error('Error saving entry draft', error);
      suppressDraftAutosaveRef.current = false;
      setFormError(t('addEntry.draft.errors.save'));
      setExitConfirmOpen(false);
    } finally {
      setDraftSaving(false);
    }
  };

  const discardDraftAndClose = async () => {
    stopDraftAutosave();
    setDraftSaving(true);
    setFormError(null);
    try {
      await draftSaveQueueRef.current;
      await clearStoredDraft(draftPhotoPathRef.current);
      forceClose();
    } catch (error) {
      console.error('Error discarding entry draft', error);
      suppressDraftAutosaveRef.current = false;
      setFormError(t('addEntry.draft.errors.discard'));
      setExitConfirmOpen(false);
    } finally {
      setDraftSaving(false);
    }
  };

  const startNewEntry = async () => {
    if (!draftToResume) return;
    stopDraftAutosave();
    setDraftSaving(true);
    setFormError(null);
    try {
      await clearStoredDraft(draftToResume.photo_path);
      setDraftToResume(null);
      suppressDraftAutosaveRef.current = false;
    } catch (error) {
      console.error('Error discarding stored entry draft', error);
      suppressDraftAutosaveRef.current = false;
      setFormError(t('addEntry.draft.errors.discard'));
    } finally {
      setDraftSaving(false);
    }
  };

  useEffect(() => {
    if (
      !open ||
      mode !== 'create' ||
      currentStep <= 2 ||
      !hasProgress ||
      draftToResume ||
      isBusy ||
      suppressDraftAutosaveRef.current
    ) {
      return;
    }

    draftAutosaveTimerRef.current = setTimeout(() => {
      draftAutosaveTimerRef.current = null;
      void queueCurrentDraftSave().catch((error) => {
        console.error('Error autosaving entry draft', error);
        setFormError(t('addEntry.draft.errors.autosave'));
      });
    }, 700);

    return () => {
      if (draftAutosaveTimerRef.current) {
        clearTimeout(draftAutosaveTimerRef.current);
        draftAutosaveTimerRef.current = null;
      }
    };
  }, [
    currentStep,
    draftToResume,
    hasProgress,
    isBusy,
    mode,
    open,
    queueCurrentDraftSave,
    t,
  ]);

  useEffect(() => {
    if (
      !open ||
      mode !== 'create' ||
      currentStep <= 2 ||
      !hasProgress ||
      draftToResume
    ) {
      return;
    }

    const flushDraft = (event: Event) => {
      if (
        suppressDraftAutosaveRef.current ||
        (document.visibilityState !== 'hidden' &&
          event?.type === 'visibilitychange')
      ) {
        return;
      }
      void queueCurrentDraftSave().catch((error) => {
        console.error('Error flushing entry draft', error);
      });
    };

    document.addEventListener('visibilitychange', flushDraft);
    window.addEventListener('pagehide', flushDraft);
    return () => {
      document.removeEventListener('visibilitychange', flushDraft);
      window.removeEventListener('pagehide', flushDraft);
    };
  }, [
    currentStep,
    draftToResume,
    hasProgress,
    mode,
    open,
    queueCurrentDraftSave,
  ]);

  const requestClose = useCallback(() => {
    if (isBusy) return;
    if (hasProgress) {
      setExitConfirmOpen(true);
      return;
    }
    forceClose();
  }, [forceClose, hasProgress, isBusy]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        const container =
          document.querySelector<HTMLElement>(
            '.bw-confirm-backdrop .bw-confirm-modal',
          ) ??
          document.querySelector<HTMLElement>('.bw-cropper') ??
          document.querySelector<HTMLElement>('.bw-entry-wizard');
        const focusable = Array.from(
          container?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ) ?? [],
        ).filter((element) => !element.hasAttribute('hidden'));
        if (focusable.length) {
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (
            !event.shiftKey &&
            document.activeElement === last
          ) {
            event.preventDefault();
            first.focus();
          }
        }
        return;
      }
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (photoCropSrc) {
        if (isObjectUrl(photoCropSrc)) URL.revokeObjectURL(photoCropSrc);
        setPhotoCropSrc(null);
        setPhotoCropFile(null);
        setPendingPhotoDateTime(null);
        return;
      }
      if (draftToResume) return;
      if (exitConfirmOpen) {
        setExitConfirmOpen(false);
        return;
      }
      if (pendingBurgerSource) {
        setPendingBurgerSource(null);
        return;
      }
      requestClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    draftToResume,
    exitConfirmOpen,
    open,
    pendingBurgerSource,
    photoCropSrc,
    requestClose,
  ]);

  useEffect(() => {
    if (!open || restaurantReview) return;
    stepHeadingRef.current?.focus();
  }, [currentStep, open, restaurantReview]);

  useEffect(() => {
    if (!draftToResume && !exitConfirmOpen && !pendingBurgerSource) return;
    setTimeout(() => {
      document
        .querySelector<HTMLElement>(
          '.bw-confirm-backdrop .bw-confirm-modal button',
        )
        ?.focus();
    });
  }, [draftToResume, exitConfirmOpen, pendingBurgerSource]);

  const fetchRestaurantOptions = async (value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return [];

    const query = getRestaurantSearchTerms(trimmedValue)
      .flatMap((term) => {
        const normalizedTerm = normalizeName(term);
        const compactTerm = normalizeCompact(term);
        return [
          `name.ilike.%${term}%`,
          `name_normalized.ilike.%${normalizedTerm}%`,
          `name_compact.ilike.%${compactTerm}%`,
        ];
      })
      .join(',');
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, name')
      .or(query)
      .order('name')
      .limit(10);

    if (error) {
      console.error(error);
      return [];
    }
    return (data ?? []) as RestaurantOption[];
  };

  const handleRestaurantChange = async (value: string) => {
    setRestaurantInput(value);
    setSelectedRestaurant(null);
    setRestaurantReview(null);
    setRestaurantApprovedName(null);
    setContinueAfterRestaurantReview(false);
    setStepErrors((current) => ({ ...current, restaurant: undefined }));

    if (!value.trim()) {
      setRestaurantSuggestions([]);
      return;
    }
    setRestaurantSuggestions(await fetchRestaurantOptions(value));
  };

  const selectRestaurant = (
    option: RestaurantOption,
    preserveBurger = false,
  ) => {
    setSelectedRestaurant(option);
    setRestaurantInput(option.name);
    setRestaurantApprovedName(null);
    setRestaurantSuggestions([]);
    setRestaurantReview(null);
    setStepErrors((current) => ({ ...current, restaurant: undefined }));
    if (!preserveBurger) {
      setSelectedBurger(null);
      setBurgerInput('');
      setBurgerSuggestions([]);
    }
  };

  const openRestaurantReview = async (
    name: string,
    continueAfter = false,
  ) => {
    setContinueAfterRestaurantReview(continueAfter);
    const suggestions = await fetchRestaurantOptions(name);
    const normalizedName = normalizeName(name);
    setRestaurantReview({
      name,
      suggestions: suggestions.filter(
        (option) => normalizeName(option.name) !== normalizedName,
      ),
    });
    setRestaurantSuggestions([]);
  };

  const closeRestaurantReview = () => {
    setRestaurantReview(null);
    setContinueAfterRestaurantReview(false);
  };

  const continueAfterRestaurantSelection = (restaurant: RestaurantOption) => {
    const shouldContinue = continueAfterRestaurantReview;
    selectRestaurant(restaurant, true);
    setContinueAfterRestaurantReview(false);
    if (shouldContinue) {
      setHasAdvanced(true);
      setCurrentStep(4);
    }
  };

  const ensureRestaurant = async (name: string) => {
    const trimmedRestaurant = name.trim();
    const { data, error } = await supabase
      .from('restaurants')
      .upsert(
        {
          name: trimmedRestaurant,
          name_normalized: normalizeName(trimmedRestaurant),
          name_compact: normalizeCompact(trimmedRestaurant),
          is_chain: false,
          created_by: session.user.id,
        },
        { onConflict: 'name_normalized' },
      )
      .select('id, name')
      .single();

    if (error || !data) {
      throw error ?? new Error(t('addEntry.errors.restaurantCreate'));
    }
    return { id: data.id, name: data.name } as RestaurantOption;
  };

  const confirmNewRestaurant = () => {
    if (!restaurantReview || formLoading) return;
    setFormError(null);
    const approvedName = restaurantReview.name.trim();
    const shouldContinue = continueAfterRestaurantReview;
    setRestaurantInput(approvedName);
    setSelectedRestaurant(null);
    setRestaurantApprovedName(approvedName);
    setRestaurantSuggestions([]);
    setRestaurantReview(null);
    setContinueAfterRestaurantReview(false);
    if (shouldContinue) {
      setHasAdvanced(true);
      setCurrentStep(4);
    }
  };

  const resetCropState = () => {
    if (isObjectUrl(photoCropSrc)) URL.revokeObjectURL(photoCropSrc!);
    setPhotoCropSrc(null);
    setPhotoCropFile(null);
    setPendingPhotoDateTime(null);
    setPhotoCropArea(null);
    setPhotoCrop(undefined);
    setCropIsPortrait(false);
    setPhotoStageHeight(360);
    setPhotoNaturalSize(null);
  };

  const handlePhotoChange = async (file?: File | null) => {
    if (!file) {
      if (isObjectUrl(photoPreview)) URL.revokeObjectURL(photoPreview!);
      resetCropState();
      setPhotoFile(null);
      setPhotoPreview(null);
      if (!datetimeManuallyEdited) {
        const now = formatLocalDateTime(new Date());
        setDatetimeInput(now);
        setMaxDateTime(now);
      }
      return;
    }

    resetCropState();
    setFormError(null);
    setPhotoCompressing(true);
    try {
      const [photoDateTime, preparedFile] = await Promise.all([
        getPhotoTakenDateTime(file),
        preparePhotoForCrop(file),
      ]);
      const src = URL.createObjectURL(preparedFile);
      setPendingPhotoDateTime(
        photoDateTime ?? formatLocalDateTime(new Date()),
      );
      setPhotoCropSrc(src);
      setPhotoCropFile(preparedFile);
      setPhotoCrop(undefined);
      setPhotoCropArea(null);
      setPhotoStageHeight(360);
      setPhotoNaturalSize(null);
    } catch (error) {
      console.error(error);
      resetCropState();
      setFormError(t('addEntry.errors.photoProcess'));
    } finally {
      setPhotoCompressing(false);
    }
  };

  const handlePhotoInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    void handlePhotoChange(file);
  };

  const handleCropImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    const isPortrait = naturalHeight >= naturalWidth;
    setCropIsPortrait(isPortrait);
    setPhotoNaturalSize({ width: naturalWidth, height: naturalHeight });
    const stageElement = event.currentTarget.closest(
      '.bw-cropper-stage',
    ) as HTMLElement | null;
    const containerWidth =
      stageElement?.clientWidth ??
      Math.max(260, Math.min(window.innerWidth - 32, 480) - 24);
    const maxContainerHeight = Math.max(260, window.innerHeight - 220);
    const scale = Math.min(
      containerWidth / naturalWidth,
      maxContainerHeight / naturalHeight,
      1,
    );
    setPhotoStageHeight(
      Math.max(260, Math.round(naturalHeight * scale)),
    );
    const defaultCrop: Crop = {
      unit: '%',
      width: 90,
      height: 90,
      x: 5,
      y: 5,
    };
    setPhotoCrop(defaultCrop);
    setPhotoCropArea(
      convertToPixelCrop(defaultCrop, naturalWidth, naturalHeight),
    );
  };

  const handleCropImageError = () => {
    resetCropState();
    setFormError(t('addEntry.errors.photoProcess'));
  };

  const handlePhotoCropConfirm = async () => {
    if (
      !photoCropFile ||
      !photoCropArea ||
      photoCropArea.width <= 0 ||
      photoCropArea.height <= 0
    ) {
      return;
    }
    setPhotoCompressing(true);
    try {
      const croppedFile = await cropImageFile(
        photoCropFile,
        photoCropArea,
      );
      const compressed = await compressImage(croppedFile);
      if (isObjectUrl(photoPreview)) URL.revokeObjectURL(photoPreview!);
      setPhotoFile(compressed);
      setPhotoPreview(URL.createObjectURL(compressed));
      if (!datetimeManuallyEdited && pendingPhotoDateTime) {
        setDatetimeInput(pendingPhotoDateTime);
      }
      resetCropState();
    } catch (error) {
      console.error(error);
      setFormError(t('addEntry.errors.photoProcess'));
    } finally {
      setPhotoCompressing(false);
    }
  };

  const handleBurgerChange = async (value: string) => {
    setBurgerInput(value);
    setSelectedBurger(null);
    setStepErrors((current) => ({ ...current, burger: undefined }));

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
    setStepErrors((current) => ({ ...current, burger: undefined }));
    if (option.meat_type) setBurgerType(option.meat_type);
  };

  const applyBurgerSource = (nextSource: BurgerSource) => {
    if (nextSource === 'restaurant') {
      setIngredientsInput('');
    } else {
      setRestaurantInput('');
      setRestaurantApprovedName(null);
      setRestaurantSuggestions([]);
      setRestaurantReview(null);
      setContinueAfterRestaurantReview(false);
      setSelectedRestaurant(null);
      setBurgerInput('');
      setBurgerSuggestions([]);
      setSelectedBurger(null);
    }
    setBurgerSource(nextSource);
    setPendingBurgerSource(null);
    setStepErrors({});
  };

  const requestBurgerSourceChange = (nextSource: BurgerSource) => {
    if (burgerSource === nextSource) return;
    const hasIncompatibleData =
      burgerSource === 'restaurant'
        ? Boolean(
            restaurantInput.trim() ||
              burgerInput.trim() ||
              selectedRestaurant ||
              selectedBurger,
          )
        : burgerSource === 'homemade'
          ? Boolean(ingredientsInput.trim())
          : false;

    if (hasIncompatibleData) {
      setPendingBurgerSource(nextSource);
    } else {
      applyBurgerSource(nextSource);
    }
  };

  const focusFirstError = (fields: FieldName[]) => {
    setTimeout(() => {
      const idByField: Record<FieldName, string> = {
        burgerSource: 'bw-burger-source-homemade',
        restaurant: 'bw-restaurant',
        burger: 'bw-burger-name',
        ingredients: 'bw-ingredients',
        rating: 'bw-rating-picker',
        price: 'bw-price',
        currency: 'bw-price-currency',
        datetime: 'bw-datetime',
        additionalNotes: 'bw-notes',
      };
      document.getElementById(idByField[fields[0]])?.focus();
    });
  };

  const validateStep = async (step: WizardStep) => {
    const errors: Partial<Record<FieldName, string>> = {};

    if (step === 1 && !burgerSource) {
      errors.burgerSource = t('addEntry.errors.originRequired');
    }

    if (step === 3 && burgerSource === 'homemade') {
      if (!ingredientsInput.trim()) {
        errors.ingredients = t('addEntry.errors.ingredientsRequired');
      } else if (ingredientsInput.trim().length > INGREDIENTS_LIMIT) {
        errors.ingredients = t('addEntry.errors.ingredientsLength', {
          count: INGREDIENTS_LIMIT,
        });
      }
    }

    if (step === 3 && burgerSource === 'restaurant') {
      if (!restaurantInput.trim()) {
        errors.restaurant = t('addEntry.errors.restaurantRequired');
      }
      if (!burgerInput.trim()) {
        errors.burger = t('addEntry.errors.burgerRequired');
      }
    }

    if (step === 4) {
      const rating = Number(ratingInput);
      if (!ratingInput || Number.isNaN(rating) || rating < 0.5 || rating > 5) {
        errors.rating = t('addEntry.errors.ratingRequired');
      }
      const price = Number(priceInput.replace(',', '.'));
      if (
        !priceInput.trim() ||
        Number.isNaN(price) ||
        price < 0
      ) {
        errors.price = t('addEntry.errors.priceRequired');
      }
      if (!priceCurrency.trim()) {
        errors.currency = t('addEntry.errors.currencyRequired');
      }
    }

    if (step === 2) {
      const datetime = new Date(datetimeInput);
      if (!datetimeInput || Number.isNaN(datetime.getTime())) {
        errors.datetime = t('addEntry.errors.datetimeRequired');
      } else if (datetime < MIN_DATE) {
        errors.datetime = t('addEntry.errors.datetimeMinimum');
      } else if (datetime > new Date()) {
        errors.datetime = t('addEntry.errors.datetimeFuture');
      }
    }

    if (step === 5) {
      if (additionalNotes.length > NOTES_LIMIT) {
        errors.additionalNotes = t('addEntry.errors.notesLength', {
          count: NOTES_LIMIT,
        });
      }
    }

    setStepErrors(errors);
    const fields = Object.keys(errors) as FieldName[];
    if (fields.length) {
      focusFirstError(fields);
      return false;
    }

    if (
      step === 3 &&
      burgerSource === 'restaurant' &&
      !selectedRestaurant
    ) {
      if (
        restaurantApprovedName &&
        normalizeName(restaurantApprovedName) ===
          normalizeName(restaurantInput)
      ) {
        return true;
      }
      const suggestions = await fetchRestaurantOptions(restaurantInput);
      const exact = suggestions.find(
        (option) =>
          normalizeName(option.name) === normalizeName(restaurantInput),
      );
      if (exact) {
        selectRestaurant(exact, true);
      } else {
        await openRestaurantReview(restaurantInput.trim(), true);
        return false;
      }
    }
    return true;
  };

  const goToNextStep = async () => {
    setFormError(null);
    if (!(await validateStep(currentStep))) return;
    setStepErrors({});
    setHasAdvanced(true);
    setCurrentStep((step) =>
      Math.min(TOTAL_STEPS, step + 1) as WizardStep,
    );
  };

  const goToPreviousStep = () => {
    if (isBusy) return;
    setFormError(null);
    setStepErrors({});
    setCurrentStep((step) => Math.max(1, step - 1) as WizardStep);
  };

  const validateEntryForm = () =>
    addEntrySchema.safeParse({
      datetime: datetimeInput,
      restaurant: restaurantInput,
      price: priceInput,
      currency: priceCurrency,
      rating: ratingInput,
      isBurger: true,
      burger: burgerInput,
      burgerOrigin: burgerSource ?? '',
      ingredients: ingredientsInput,
      additionalNotes,
    });

  async function saveEntry(parsed: AddEntrySchema) {
    const entryId = mode === 'edit' && entry ? entry.id : null;
    const price = Number(parsed.price.replace(',', '.'));
    const rating = Number(parsed.rating);
    const notes = (parsed.additionalNotes?.trim() ?? '').slice(
      0,
      NOTES_LIMIT,
    );
    const additionalNotesValue = notes || null;
    const ingredientsValue =
      burgerSource === 'homemade'
        ? (parsed.ingredients?.trim() ?? '').slice(0, INGREDIENTS_LIMIT) ||
          null
        : null;
    const trimmedRestaurant = restaurantInput.trim();
    const normalizedRestaurant = normalizeName(trimmedRestaurant);
    const editingSameRestaurant =
      mode === 'edit' &&
      entry?.restaurantName &&
      normalizeName(entry.restaurantName.trim()) === normalizedRestaurant;
    let restaurantId =
      selectedRestaurant?.id ??
      (editingSameRestaurant ? entry?.restaurantId ?? null : null);

    setFormLoading(true);
    try {
      if (
        burgerSource === 'restaurant' &&
        !restaurantId &&
        restaurantApprovedName &&
        normalizeName(restaurantApprovedName) === normalizedRestaurant
      ) {
        const restaurant = await ensureRestaurant(restaurantApprovedName);
        restaurantId = restaurant.id;
        setSelectedRestaurant(restaurant);
        setRestaurantInput(restaurant.name);
        setRestaurantApprovedName(null);
      }

      let photoUrl: string | null =
        photoFile && isObjectUrl(photoPreview)
          ? null
          : photoPreview ?? null;

      if (photoFile) {
        const fileExtension = photoFile.name.split('.').pop();
        const filePath = `${session.user.id}/${Date.now()}.${fileExtension ?? 'jpg'}`;
        const { error: uploadError } = await supabase.storage
          .from('food-photos')
          .upload(filePath, photoFile, {
            cacheControl: '3600',
            upsert: false,
          });
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage
          .from('food-photos')
          .getPublicUrl(filePath);
        photoUrl = publicUrlData?.publicUrl ?? null;
      }

      if (burgerSource === 'restaurant' && !restaurantId) {
        throw new Error(t('addEntry.errors.restaurantSelection'));
      }

      let burgerId: string | null = null;
      if (burgerSource === 'restaurant') {
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
            throw error ?? new Error(t('addEntry.errors.burgerCreate'));
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
      }

      const payload = {
        restaurant_id: restaurantId,
        burger_id: burgerId,
        datetime: new Date(datetimeInput).toISOString(),
        is_burger: true,
        burger_origin: burgerSource,
        meat_type: burgerType,
        rating,
        price,
        currency: priceCurrency,
        photo_url: photoUrl,
        additional_notes: additionalNotesValue,
        homemade_ingredients: ingredientsValue,
      };

      if (mode === 'edit' && entryId) {
        const { error: updateError } = await supabase
          .from('entries')
          .update(payload)
          .eq('id', entryId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('entries')
          .insert({ ...payload, user_id: session.user.id });
        if (insertError) throw insertError;
      }

      if (burgerSource === 'restaurant' && restaurantId && burgerId) {
        const { error: wishlistCleanupError } = await supabase
          .from('burger_wishlist')
          .delete()
          .match({
            user_id: session.user.id,
            restaurant_id: restaurantId,
            burger_id: burgerId,
            status: 'want_to_try',
          });
        if (wishlistCleanupError) {
          console.error(
            'Error cleaning burger wishlist after entry save',
            wishlistCleanupError,
          );
        } else {
          window.dispatchEvent(
            new CustomEvent('bw-burger-wishlist-updated'),
          );
        }
      }

      if (mode === 'create') {
        await draftSaveQueueRef.current;
        const draftPhotoPath = draftPhotoPathRef.current;
        const finalEntryUsesDraftPhoto =
          Boolean(draftPhotoPath) &&
          Boolean(photoUrl) &&
          photoUrl === draftPhotoUrlRef.current;
        try {
          await deleteEntryDraft(session.user.id);
          if (draftPhotoPath && !finalEntryUsesDraftPhoto) {
            await deleteEntryDraftPhoto(draftPhotoPath);
          }
          draftPhotoUrlRef.current = null;
          draftPhotoPathRef.current = null;
          draftUploadedPhotoSignatureRef.current = null;
        } catch (error) {
          console.error('Error clearing published entry draft', error);
        }
      }

      await onSaved();
      forceClose();
    } catch (error: unknown) {
      console.error(error);
      if (mode === 'create') {
        suppressDraftAutosaveRef.current = false;
      }
      setFormError(
        error instanceof Error
          ? error.message
          : t('addEntry.errors.save'),
      );
    } finally {
      setFormLoading(false);
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (currentStep !== 5 || formLoading) return;
    setFormError(null);
    if (!(await validateStep(5))) return;

    const validation = validateEntryForm();
    if (!validation.success) {
      const errors: Partial<Record<FieldName, string>> = {};
      validation.error.issues.forEach((issue) => {
        const rawField = issue.path[0];
        const field =
          rawField === 'burgerOrigin'
            ? 'burgerSource'
            : (rawField as FieldName | undefined);
        if (field && !errors[field]) errors[field] = issue.message;
      });
      setStepErrors(errors);
      const fields = Object.keys(errors) as FieldName[];
      if (fields.length) focusFirstError(fields);
      setFormError(
        fields.length ? null : t('addEntry.errors.reviewFields'),
      );
      return;
    }
    if (mode === 'create') stopDraftAutosave();
    await saveEntry(validation.data);
  };

  const locale = i18n.resolvedLanguage ?? i18n.language ?? 'es';
  const formattedRating = ratingInput
    ? new Intl.NumberFormat(locale, {
        minimumFractionDigits: Number(ratingInput) % 1 ? 1 : 0,
        maximumFractionDigits: 1,
      }).format(Number(ratingInput))
    : '—';
  const formattedPrice = priceInput
    ? new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: priceCurrency,
        maximumFractionDigits: 2,
      }).format(Number(priceInput.replace(',', '.')))
    : '—';
  const formattedDate = datetimeInput
    ? new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(datetimeInput))
    : '—';
  const stepTitle =
    currentStep === 3
      ? t(
          burgerSource === 'homemade'
            ? 'addEntry.homemadeIdentityTitle'
            : 'addEntry.restaurantIdentityTitle',
        )
      : t(`addEntry.steps.${currentStep}.title`);
  const stepSupport = t(`addEntry.steps.${currentStep}.support`);
  const isCropSelectionReady = Boolean(
    photoCropArea &&
      photoCropArea.width > 0 &&
      photoCropArea.height > 0,
  );
  const trimmedRestaurantInput = restaurantInput.trim();
  const hasExactRestaurantSuggestion = restaurantSuggestions.some(
    (option) =>
      normalizeName(option.name) === normalizeName(trimmedRestaurantInput),
  );
  const showAddRestaurantOption =
    Boolean(trimmedRestaurantInput) &&
    !selectedRestaurant &&
    !hasExactRestaurantSuggestion;
  const closestRestaurantMatch = restaurantReview?.suggestions[0] ?? null;
  const remainingRestaurantMatches =
    restaurantReview?.suggestions.slice(1) ?? [];

  if (!open) return null;

  const renderMeatType = () => (
    <div className="bw-field">
      <span className="bw-label">{t('addEntry.burgerType')}</span>
      <div className="bw-meat-grid">
        {(
          [
            ['beef', 'meat.png'],
            ['chicken', 'chicken-leg.png'],
            ['vegan', 'plant.png'],
            ['other', 'question-mark.png'],
          ] as const
        ).map(([value, image]) => (
          <button
            key={value}
            type="button"
            className={`bw-meat-card ${burgerType === value ? 'is-active' : ''}`}
            onClick={() => setBurgerType(value)}
            aria-pressed={burgerType === value}
          >
            <img
              src={`/${image}`}
              alt=""
              className="bw-meat-icon-img"
            />
            <span className="bw-meat-label">{t(`addEntry.${value}`)}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderStep = () => {
    if (currentStep === 1) {
      return (
        <div className="bw-origin-grid" role="radiogroup" aria-describedby="bw-origin-error">
          {(
            [
              {
                value: 'homemade',
                icon: HomeRounded,
                label: t('addEntry.homemade'),
                description: t('addEntry.homemadeDescription'),
              },
              {
                value: 'restaurant',
                icon: RestaurantRounded,
                label: t('addEntry.restaurant'),
                description: t('addEntry.restaurantDescription'),
              },
            ] as const
          ).map((option) => {
            const Icon = option.icon;
            return (
              <button
                id={`bw-burger-source-${option.value}`}
                key={option.value}
                type="button"
                role="radio"
                aria-checked={burgerSource === option.value}
                className={`bw-origin-card ${burgerSource === option.value ? 'is-active' : ''}`}
                onClick={() => requestBurgerSourceChange(option.value)}
              >
                <span className="bw-origin-icon" aria-hidden="true">
                  <Icon />
                </span>
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </button>
            );
          })}
          {stepErrors.burgerSource ? (
            <p id="bw-origin-error" className="bw-field-error">
              {stepErrors.burgerSource}
            </p>
          ) : null}
        </div>
      );
    }

    if (currentStep === 2) {
      return (
        <div className="bw-photo-step">
          {photoPreview ? (
            <div className="bw-photo-card">
              <>
                <img
                  src={photoPreview}
                  alt={t('addEntry.photoAlt')}
                  className="bw-photo-preview"
                />
                <div className="bw-photo-actions">
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => void handlePhotoChange(null)}
                    disabled={isBusy}
                  >
                    {t('addEntry.removePhoto')}
                  </Button>
                  <Button
                    variant="contained"
                    component="label"
                    size="small"
                    disabled={isBusy}
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
            </div>
          ) : (
            <>
              <button
                type="button"
                className="bw-photo-card bw-photo-card-trigger"
                onClick={() => photoCardInputRef.current?.click()}
                disabled={isBusy}
                aria-label={t('addEntry.choosePhoto')}
              >
                <div className="bw-photo-empty">
                  <PhotoLibraryRounded aria-hidden="true" />
                  <span aria-live="polite">
                    {photoCompressing
                      ? t('addEntry.processingPhoto')
                      : t('addEntry.photoEmpty')}
                  </span>
                </div>
              </button>
              <input
                id="bw-photo-card-input"
                ref={photoCardInputRef}
                type="file"
                accept="image/*"
                hidden
                disabled={isBusy}
                onChange={handlePhotoInputChange}
              />
            </>
          )}
          {!photoPreview ? (
            <div className="bw-photo-source-actions">
              <Button
                variant="contained"
                component="label"
                disabled={isBusy}
                startIcon={<CameraAltRounded />}
              >
                {t('addEntry.takePhoto')}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={handlePhotoInputChange}
                />
              </Button>
              <Button
                variant="outlined"
                component="label"
                disabled={isBusy}
                startIcon={<PhotoLibraryRounded />}
              >
                {t('addEntry.choosePhoto')}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handlePhotoInputChange}
                />
              </Button>
            </div>
          ) : null}
          <div className="bw-field">
            <TextField
              id="bw-datetime"
              label={t('addEntry.datetime')}
              type="datetime-local"
              value={datetimeInput}
              onChange={(event) => {
                setDatetimeInput(event.target.value);
                setDatetimeManuallyEdited(true);
                setStepErrors((current) => ({
                  ...current,
                  datetime: undefined,
                }));
              }}
              fullWidth
              inputProps={{
                min: MIN_DATETIME_STRING,
                max: maxDateTime,
              }}
              InputLabelProps={{ shrink: true }}
              error={Boolean(stepErrors.datetime)}
              helperText={
                stepErrors.datetime ?? t('addEntry.datetimeHelp')
              }
            />
          </div>
        </div>
      );
    }

    if (currentStep === 3 && burgerSource === 'homemade') {
      return (
        <>
          <div className="bw-field">
            <TextField
              id="bw-ingredients"
              label={t('addEntry.ingredientsLabel')}
              value={ingredientsInput}
              onChange={(event) => {
                setIngredientsInput(event.target.value);
                setStepErrors((current) => ({
                  ...current,
                  ingredients: undefined,
                }));
              }}
              placeholder={t('addEntry.ingredientsPlaceholder')}
              fullWidth
              multiline
              minRows={3}
              inputProps={{ maxLength: INGREDIENTS_LIMIT }}
              error={Boolean(stepErrors.ingredients)}
              helperText={
                stepErrors.ingredients ??
                `${ingredientsInput.length}/${INGREDIENTS_LIMIT}`
              }
            />
          </div>
          {renderMeatType()}
        </>
      );
    }

    if (currentStep === 3) {
      return (
        <>
          <div className="bw-field">
            <TextField
              id="bw-restaurant"
              label={t('addEntry.restaurantLabel')}
              value={restaurantInput}
              onChange={(event) =>
                void handleRestaurantChange(event.target.value)
              }
              placeholder={t('addEntry.restaurantPlaceholder')}
              autoComplete="off"
              fullWidth
              error={Boolean(stepErrors.restaurant)}
              helperText={stepErrors.restaurant}
            />
            {restaurantSuggestions.length > 0 ||
            showAddRestaurantOption ? (
              <ul className="bw-suggestions">
                {restaurantSuggestions.map((restaurant) => (
                  <li key={restaurant.id}>
                    <button
                      type="button"
                      onClick={() => selectRestaurant(restaurant)}
                    >
                      {restaurant.name}
                    </button>
                  </li>
                ))}
                {showAddRestaurantOption ? (
                  <li className="bw-suggestions-add">
                    <button
                      type="button"
                      onClick={() =>
                        void openRestaurantReview(
                          trimmedRestaurantInput,
                        )
                      }
                    >
                      {t('addEntry.addRestaurantOption', {
                        name: trimmedRestaurantInput,
                      })}
                    </button>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
          <div className="bw-field">
            <TextField
              id="bw-burger-name"
              label={t('addEntry.burgerLabel')}
              value={burgerInput}
              onChange={(event) =>
                void handleBurgerChange(event.target.value)
              }
              placeholder={t('addEntry.burgerPlaceholder')}
              autoComplete="off"
              fullWidth
              error={Boolean(stepErrors.burger)}
              helperText={
                stepErrors.burger ??
                (!selectedRestaurant ? t('addEntry.nameHelp') : undefined)
              }
            />
            {selectedRestaurant && burgerSuggestions.length > 0 ? (
              <ul className="bw-suggestions">
                {burgerSuggestions.map((burger) => (
                  <li key={burger.id}>
                    <button
                      type="button"
                      onClick={() => selectBurger(burger)}
                    >
                      {burger.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {renderMeatType()}
        </>
      );
    }

    if (currentStep === 4) {
      return (
        <>
          <div className="bw-field">
            <span className="bw-label">{t('addEntry.score')}</span>
            <div id="bw-rating-picker" tabIndex={-1}>
              <RatingPicker
                value={ratingInput ? Number(ratingInput) : null}
                onChange={(value) => {
                  setRatingInput(String(value));
                  setStepErrors((current) => ({
                    ...current,
                    rating: undefined,
                  }));
                }}
                color={colors.accent}
                emptyColor={colors.textMuted}
                label={t('addEntry.score')}
              />
            </div>
            <strong className="bw-rating-value" aria-live="polite">
              {ratingInput
                ? t('addEntry.ratingValue', {
                    value: formattedRating,
                  })
                : t('addEntry.ratingEmpty')}
            </strong>
            {stepErrors.rating ? (
              <p className="bw-field-error">{stepErrors.rating}</p>
            ) : null}
          </div>
          <div className="bw-price-grid">
            <TextField
              id="bw-price"
              label={t(
                burgerSource === 'homemade'
                  ? 'addEntry.homemadePriceLabel'
                  : 'addEntry.restaurantPriceLabel',
              )}
              type="number"
              inputProps={{ step: 0.01, min: 0, inputMode: 'decimal' }}
              value={priceInput}
              onChange={(event) => {
                setPriceInput(event.target.value);
                setStepErrors((current) => ({
                  ...current,
                  price: undefined,
                }));
              }}
              fullWidth
              error={Boolean(stepErrors.price)}
              helperText={stepErrors.price}
            />
            <TextField
              id="bw-price-currency"
              select
              label={t('addEntry.priceCurrency')}
              value={priceCurrency}
              onChange={(event) => {
                setPriceCurrency(event.target.value);
                setStepErrors((current) => ({
                  ...current,
                  currency: undefined,
                }));
              }}
              fullWidth
              error={Boolean(stepErrors.currency)}
              helperText={stepErrors.currency}
              SelectProps={{ MenuProps: { disablePortal: true } }}
            >
              {currencyOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="bw-field">
          <TextField
            id="bw-notes"
            label={t('addEntry.notesLabel')}
            value={additionalNotes}
            onChange={(event) => {
              setAdditionalNotes(event.target.value);
              setStepErrors((current) => ({
                ...current,
                additionalNotes: undefined,
              }));
            }}
            placeholder={t('addEntry.notesPlaceholder')}
            fullWidth
            multiline
            minRows={2}
            inputProps={{ maxLength: NOTES_LIMIT }}
            error={Boolean(stepErrors.additionalNotes)}
            helperText={
              stepErrors.additionalNotes ??
              `${additionalNotes.length}/${NOTES_LIMIT}`
            }
          />
        </div>
        <section className="bw-entry-summary" aria-labelledby="bw-entry-summary-title">
          <span className="bw-entry-summary-kicker">
            {t('addEntry.summaryLabel')}
          </span>
          <h3 id="bw-entry-summary-title">
            {burgerSource === 'restaurant'
              ? restaurantInput
              : t('addEntry.homemade')}
          </h3>
          <p>
            {burgerSource === 'restaurant'
              ? burgerInput
              : ingredientsInput}
          </p>
          <dl>
            <div>
              <dt>{t('addEntry.score')}</dt>
              <dd>
                {t('addEntry.ratingValue', { value: formattedRating })}
              </dd>
            </div>
            <div>
              <dt>{t('addEntry.priceSummary')}</dt>
              <dd>{formattedPrice}</dd>
            </div>
            <div>
              <dt>{t('addEntry.dateSummary')}</dt>
              <dd>{formattedDate}</dd>
            </div>
          </dl>
        </section>
      </>
    );
  };

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <div
        className={`bw-modal-backdrop ${isClosing ? 'is-closing' : 'is-open'}`}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) requestClose();
        }}
      >
        <div
          className={`bw-modal bw-entry-wizard ${restaurantReview ? 'bw-modal-restaurant-review' : ''} ${isClosing ? 'is-closing' : 'is-open'}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="bw-entry-wizard-title"
        >
          <div className="bw-modal-header bw-wizard-header">
            <div className="bw-wizard-heading">
              {!restaurantReview ? (
                <span className="bw-wizard-progress-copy" aria-live="polite">
                  {t('addEntry.progress', {
                    current: currentStep,
                    total: TOTAL_STEPS,
                  })}
                </span>
              ) : null}
              <h2
                id="bw-entry-wizard-title"
                className="bw-modal-title"
                ref={stepHeadingRef}
                tabIndex={-1}
              >
                {restaurantReview
                  ? t('addEntry.reviewRestaurantTitle')
                  : stepTitle}
              </h2>
              <p className="bw-modal-subtitle">
                {restaurantReview
                  ? t('addEntry.reviewRestaurantSubtitle')
                  : stepSupport}
              </p>
            </div>
            <button
              type="button"
              className="bw-icon-button bw-wizard-close"
              onClick={requestClose}
              disabled={isBusy}
              aria-label={t('common.close')}
            >
              <CloseRounded aria-hidden="true" />
            </button>
          </div>

          {!restaurantReview ? (
            <div
              className="bw-wizard-progress-track"
              role="progressbar"
              aria-label={t('addEntry.progressLabel')}
              aria-valuemin={1}
              aria-valuemax={TOTAL_STEPS}
              aria-valuenow={currentStep}
            >
              <span
                style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
              />
            </div>
          ) : null}

          {restaurantReview ? (
            <div className="bw-restaurant-review">
              {closestRestaurantMatch ? (
                <button
                  type="button"
                  className="bw-restaurant-review-summary bw-restaurant-review-best-match"
                  onClick={() =>
                    continueAfterRestaurantSelection(
                      closestRestaurantMatch,
                    )
                  }
                  disabled={formLoading}
                >
                  <span className="bw-restaurant-review-kicker">
                    {t('addEntry.reviewRestaurantClosest')}
                  </span>
                  <strong className="bw-restaurant-review-name">
                    {closestRestaurantMatch.name}
                  </strong>
                  <p>{t('addEntry.reviewRestaurantExisting')}</p>
                </button>
              ) : (
                <div className="bw-restaurant-review-summary">
                  <span className="bw-restaurant-review-kicker">
                    {t('addEntry.reviewRestaurantRequested')}
                  </span>
                  <strong className="bw-restaurant-review-name">
                    {restaurantReview.name}
                  </strong>
                  <p>{t('addEntry.reviewRestaurantPendingCreate')}</p>
                </div>
              )}

              {closestRestaurantMatch ? (
                <div className="bw-restaurant-review-requested">
                  <span>{t('addEntry.reviewRestaurantRequested')}</span>
                  <strong>{restaurantReview.name}</strong>
                  <small>
                    {t('addEntry.reviewRestaurantPendingCreate')}
                  </small>
                </div>
              ) : null}

              {remainingRestaurantMatches.length > 0 ? (
                <div className="bw-field">
                  <span className="bw-label">
                    {t('addEntry.reviewRestaurantMatches')}
                  </span>
                  <div className="bw-restaurant-review-list">
                    {remainingRestaurantMatches.map((restaurant) => (
                      <button
                        key={restaurant.id}
                        type="button"
                        className="bw-restaurant-review-option"
                        onClick={() =>
                          continueAfterRestaurantSelection(restaurant)
                        }
                      >
                        {restaurant.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : !closestRestaurantMatch ? (
                <p className="bw-helper">
                  {t('addEntry.reviewRestaurantNoMatches')}
                </p>
              ) : null}

              {formError ? (
                <p className="bw-field-error" role="alert">
                  {formError}
                </p>
              ) : null}

              <div className="bw-modal-actions">
                <Button
                  type="button"
                  variant="outlined"
                  onClick={closeRestaurantReview}
                  disabled={formLoading}
                >
                  {t('addEntry.reviewRestaurantBack')}
                </Button>
                <Button
                  type="button"
                  variant="contained"
                  onClick={confirmNewRestaurant}
                  disabled={formLoading}
                >
                  {formLoading
                    ? t('addEntry.saving')
                    : t('addEntry.reviewRestaurantCreate')}
                </Button>
              </div>
            </div>
          ) : (
            <form
              className="bw-modal-form"
              onSubmit={handleSubmit}
              noValidate
            >
              <div className="bw-modal-fields bw-wizard-fields">
                {renderStep()}
                {formError ? (
                  <p className="bw-field-error" role="alert">
                    {formError}
                  </p>
                ) : null}
              </div>
              <div className="bw-modal-actions bw-wizard-actions">
                {currentStep > 1 ? (
                  <Button
                    type="button"
                    variant="outlined"
                    onClick={goToPreviousStep}
                    disabled={isBusy}
                    startIcon={<ArrowBackRounded />}
                  >
                    {t('addEntry.back')}
                  </Button>
                ) : (
                  <span />
                )}
                {currentStep < TOTAL_STEPS ? (
                  <Button
                    key="continue"
                    type="button"
                    variant="contained"
                    onClick={(event) => {
                      event.preventDefault();
                      void goToNextStep();
                    }}
                    disabled={isBusy}
                  >
                    {currentStep === 2 && !photoPreview
                      ? t('addEntry.continueWithoutPhoto')
                      : t('addEntry.continue')}
                  </Button>
                ) : (
                  <Button
                    key="publish"
                    type="submit"
                    variant="contained"
                    disabled={isBusy}
                  >
                    {formLoading
                      ? t('addEntry.saving')
                      : t(
                          mode === 'edit'
                            ? 'addEntry.saveChanges'
                            : 'addEntry.publish',
                        )}
                  </Button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(draftToResume)}
        onClose={() => undefined}
        title={t('addEntry.draft.resumeTitle')}
        message={t('addEntry.draft.resumeMessage')}
        actions={
          <>
            <button
              className="bw-btn bw-btn-ghost"
              type="button"
              onClick={() => void startNewEntry()}
              disabled={draftSaving}
            >
              {t('addEntry.draft.startNew')}
            </button>
            <button
              className="bw-btn bw-btn-primary"
              type="button"
              onClick={resumeEntryDraft}
              disabled={draftSaving}
            >
              {t('addEntry.draft.continue')}
            </button>
          </>
        }
      />

      <ConfirmDialog
        open={exitConfirmOpen}
        onClose={() => {
          if (!draftSaving) setExitConfirmOpen(false);
        }}
        title={t(
          mode === 'create'
            ? 'addEntry.draft.exitTitle'
            : 'addEntry.exitConfirm.title',
        )}
        message={t(
          mode === 'create'
            ? 'addEntry.draft.exitMessage'
            : 'addEntry.exitConfirm.message',
        )}
        actions={
          mode === 'create' ? (
            <>
              <button
                className="bw-btn bw-btn-ghost"
                type="button"
                onClick={() => setExitConfirmOpen(false)}
                disabled={draftSaving}
              >
                {t('addEntry.exitConfirm.keepEditing')}
              </button>
              <button
                className="bw-btn bw-btn-ghost"
                type="button"
                onClick={() => void discardDraftAndClose()}
                disabled={draftSaving}
              >
                {t('addEntry.draft.discard')}
              </button>
              <button
                className="bw-btn bw-btn-primary"
                type="button"
                onClick={() => void saveDraftAndClose()}
                disabled={draftSaving}
              >
                {draftSaving
                  ? t('addEntry.draft.saving')
                  : t('addEntry.draft.save')}
              </button>
            </>
          ) : (
            <>
              <button
                className="bw-btn bw-btn-primary"
                type="button"
                onClick={() => setExitConfirmOpen(false)}
              >
                {t('addEntry.exitConfirm.keepEditing')}
              </button>
              <button
                className="bw-btn bw-btn-ghost"
                type="button"
                onClick={forceClose}
              >
                {t('addEntry.exitConfirm.exit')}
              </button>
            </>
          )
        }
      />

      <ConfirmDialog
        open={Boolean(pendingBurgerSource)}
        onClose={() => setPendingBurgerSource(null)}
        title={t('addEntry.changeTypeConfirm.title')}
        message={t('addEntry.changeTypeConfirm.message')}
        actions={
          <>
            <button
              className="bw-btn bw-btn-ghost"
              type="button"
              onClick={() => setPendingBurgerSource(null)}
            >
              {t('common.cancel')}
            </button>
            <button
              className="bw-btn bw-btn-primary"
              type="button"
              onClick={() => {
                if (pendingBurgerSource) {
                  applyBurgerSource(pendingBurgerSource);
                }
              }}
            >
              {t('addEntry.changeTypeConfirm.confirm')}
            </button>
          </>
        }
      />

      {photoCropSrc ? (
        <div
          className="bw-photo-viewer-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) resetCropState();
          }}
        >
          <div
            className="bw-cropper"
            role="dialog"
            aria-modal="true"
            aria-label={t('addEntry.cropAlt')}
          >
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
                          photoNaturalSize.height,
                        ),
                      );
                    }
                  }}
                  onComplete={() => {
                    if (photoNaturalSize && photoCrop) {
                      setPhotoCropArea(
                        convertToPixelCrop(
                          photoCrop,
                          photoNaturalSize.width,
                          photoNaturalSize.height,
                        ),
                      );
                    }
                  }}
                  minHeight={80}
                  minWidth={80}
                  keepSelection
                >
                  <img
                    src={photoCropSrc}
                    alt={t('addEntry.cropAlt')}
                    onLoad={handleCropImageLoad}
                    onError={handleCropImageError}
                  />
                </ReactCrop>
              </div>
            </div>
            <div className="bw-cropper-actions">
              <Button
                variant="outlined"
                onClick={resetCropState}
                disabled={photoCompressing}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="contained"
                onClick={() => void handlePhotoCropConfirm()}
                disabled={photoCompressing || !isCropSelectionReady}
              >
                {photoCompressing
                  ? t('addEntry.processingPhoto')
                  : t('addEntry.crop')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </ThemeProvider>
  );
}
