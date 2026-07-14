import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Cropper, { type Area } from 'react-easy-crop';
import { Block, BookmarksOutlined, Check, Close, PlaylistAdd } from '@mui/icons-material';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';
import { useTranslation } from 'react-i18next';
import { TopMenu } from '../TopMenu/TopMenu';
import { AppShell } from '../common/AppShell';
import { PageHeader } from '../common/PageHeader';
import { FollowListModal, type FollowListMode } from '../FollowListModal/FollowListModal';
import { ModalBase } from '../common/ModalBase';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { PushNotificationSettings } from '../PushNotifications/PushNotificationSettings';
import { cropImageFile } from '../../utils/cropImage';
import { compressImage } from '../../utils/image';
import { useRevalidateOnFocus } from '../../utils/useRevalidateOnFocus';
import { lockBodyScroll } from '../../utils/scrollLock';
import { unregisterCurrentPushSubscription } from '../../lib/pushNotifications';
import { usePreferences } from '../../context/PreferencesContext';
import {
  BURGER_BREAD_OPTIONS,
  BURGER_DONENESS_OPTIONS,
  BURGER_SAUCE_OPTIONS,
  BURGER_TYPE_OPTIONS,
  type BurgerBreadPreference,
  type BurgerDonenessPreference,
  type BurgerSaucePreference,
  type BurgerTypePreference,
  isBurgerBreadPreference,
  isBurgerDonenessPreference,
  isBurgerSaucePreference,
  isBurgerTypePreference,
} from '../../constants/burgerPreferences';
import '../../styles/layout.css';
import '../../styles/shared.css';
import './ProfilePage.css';

type ProfileData = {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  equipped_frame?: 'gold' | 'silver' | 'bronze' | null;
  is_private?: boolean | null;
  is_admin?: boolean | null;
  preferred_language?: string | null;
  preferred_currency?: string | null;
  favorite_burger_type?: BurgerTypePreference | null;
  favorite_sauce?: BurgerSaucePreference | null;
  favorite_doneness?: BurgerDonenessPreference | null;
  favorite_bread?: BurgerBreadPreference | null;
};

type ProfilePageProps = {
  session: Session;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenUserDashboard: (user: { id: string; username: string | null; displayName: string | null }) => void;
  adminModeEnabled?: boolean;
  onAdminModeChange?: (enabled: boolean) => void;
};

type FrameOption = {
  key: 'gold' | 'silver' | 'bronze';
  label: string;
  src: string;
  rule: string;
};

const FRAME_OPTIONS: FrameOption[] = [
  { key: 'gold', label: 'Gold', src: '/frames/gold_frame.svg', rule: 'Top 1 del mes' },
  { key: 'silver', label: 'Silver', src: '/frames/silver_frame.svg', rule: 'Top 2 del mes' },
  { key: 'bronze', label: 'Bronze', src: '/frames/bronze_frame.svg', rule: 'Top 3 del mes' },
];

export function ProfilePage({
  session,
  theme,
  onToggleTheme,
  onOpenUserDashboard,
  adminModeEnabled = false,
  onAdminModeChange,
}: Readonly<ProfilePageProps>) {
  const navigate = useNavigate();
  const username = (session.user.user_metadata as { username?: string } | null)?.username;
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const usernameInputRef = useRef('');
  const [bioInput, setBioInput] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const { t } = useTranslation();
  const { language, currency, setLanguage, setCurrency } = usePreferences();
  const [languageInput, setLanguageInput] = useState(language);
  const [currencyInput, setCurrencyInput] = useState(currency);
  const [favoriteBurgerTypeInput, setFavoriteBurgerTypeInput] = useState<BurgerTypePreference | ''>('');
  const [favoriteSauceInput, setFavoriteSauceInput] = useState<BurgerSaucePreference | ''>('');
  const [favoriteDonenessInput, setFavoriteDonenessInput] = useState<BurgerDonenessPreference | ''>('');
  const [favoriteBreadInput, setFavoriteBreadInput] = useState<BurgerBreadPreference | ''>('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const BIO_LIMIT = 250;
  const [avatarCropSrc, setAvatarCropSrc] = useState<string | null>(null);
  const [avatarCropFile, setAvatarCropFile] = useState<File | null>(null);
  const [avatarCrop, setAvatarCrop] = useState({ x: 0, y: 0 });
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [avatarCropArea, setAvatarCropArea] = useState<Area | null>(null);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [followListMode, setFollowListMode] = useState<FollowListMode | null>(null);
  const [avatarOptionsOpen, setAvatarOptionsOpen] = useState(false);
  const [framePickerOpen, setFramePickerOpen] = useState(false);
  const [equippedFrameKey, setEquippedFrameKey] = useState<FrameOption['key'] | null>(null);
  const [unlockedFrames, setUnlockedFrames] = useState<Record<FrameOption['key'], boolean>>({
    gold: false,
    silver: false,
    bronze: false,
  });
  const [monthlyRank, setMonthlyRank] = useState<number | null>(null);
  const [framesLoading, setFramesLoading] = useState(false);
  const [pendingNavPath, setPendingNavPath] = useState<string | null>(null);
  const languageOptions = useMemo(
    () => [
      { value: 'en', label: 'English' },
      { value: 'es', label: 'Español' },
      { value: 'th', label: 'ไทย' },
      { value: 'fr', label: 'Français' },
      { value: 'it', label: 'Italiano' },
      { value: 'de', label: 'Deutsch' },
      { value: 'ja', label: '日本語' },
    ],
    []
  );
  const currencyOptions = useMemo(
    () => [
      { value: 'EUR', label: '€ Euro' },
      { value: 'THB', label: '฿ Baht' },
      { value: 'USD', label: '$ USD' },
      { value: 'GBP', label: '£ GBP' },
      { value: 'AED', label: 'د.إ AED' },
      { value: 'JPY', label: '¥ Yen' },
    ],
    []
  );
  const profileCacheKey = `bw-profile-${session.user.id}`;
  const followCountsCacheKey = `bw-profile-follow-counts-${session.user.id}`;
  const parseFrameKey = useCallback((value: string | null | undefined): FrameOption['key'] | null => {
    if (value === 'gold' || value === 'silver' || value === 'bronze') return value;
    return null;
  }, []);

  const syncBurgerPreferenceInputs = useCallback((nextProfile: ProfileData) => {
    setFavoriteBurgerTypeInput(
      isBurgerTypePreference(nextProfile.favorite_burger_type) ? nextProfile.favorite_burger_type : ''
    );
    setFavoriteSauceInput(
      isBurgerSaucePreference(nextProfile.favorite_sauce) ? nextProfile.favorite_sauce : ''
    );
    setFavoriteDonenessInput(
      isBurgerDonenessPreference(nextProfile.favorite_doneness) ? nextProfile.favorite_doneness : ''
    );
    setFavoriteBreadInput(
      isBurgerBreadPreference(nextProfile.favorite_bread) ? nextProfile.favorite_bread : ''
    );
  }, []);

  const loadProfile = useCallback(async (options?: { showLoading?: boolean; skipCache?: boolean }) => {
    const showLoading = options?.showLoading ?? true;
    if (showLoading) setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (error) {
      setError(error.message);
      setProfile(null);
    } else {
      const nextProfile = data as ProfileData;
      setProfile(nextProfile);

      const incomingUsername = nextProfile?.username ?? username ?? '';
      const currentInput = usernameInputRef.current ?? '';
      const userIsEditing = currentInput.trim() !== '' && currentInput.trim() !== incomingUsername;
      if (!userIsEditing) {
        setUsernameInput(incomingUsername);
      }
      setBioInput(data?.bio ?? '');
      setAvatarPreview(data?.avatar_url ?? null);
      setIsPrivate(Boolean(data?.is_private));
      syncBurgerPreferenceInputs(nextProfile);
      if (!options?.skipCache) {
        try {
          sessionStorage.setItem(profileCacheKey, JSON.stringify(data));
        } catch {
          // Ignore cache write errors (private mode, quota, etc.).
        }
      }
      setLanguageInput((data as ProfileData)?.preferred_language ?? language);
      setCurrencyInput((data as ProfileData)?.preferred_currency ?? currency);
    }
    if (showLoading) setLoading(false);
  }, [currency, language, profileCacheKey, session.user.id, syncBurgerPreferenceInputs, username]);

  useEffect(() => {
    const cached = sessionStorage.getItem(profileCacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as ProfileData;
        setProfile(parsed);
        const cachedUsername = parsed.username ?? username ?? '';
        const currentInput = usernameInputRef.current ?? '';
        if (!(currentInput.trim() && currentInput.trim() !== cachedUsername)) {
          setUsernameInput(cachedUsername);
        }
        setBioInput(parsed.bio ?? '');
        setAvatarPreview(parsed.avatar_url ?? null);
        setIsPrivate(Boolean(parsed.is_private));
        syncBurgerPreferenceInputs(parsed);
        setLanguageInput((parsed as ProfileData)?.preferred_language ?? language);
        setCurrencyInput((parsed as ProfileData)?.preferred_currency ?? currency);
        return;
      } catch {
        // Fall through to fetch.
      }
    }

    loadProfile();
  }, [currency, language, loadProfile, profileCacheKey, syncBurgerPreferenceInputs, username]);

  const loadFollowCounts = useCallback(async () => {
    const { data: followRows, error } = await supabase
      .from('follows')
      .select('follower_id, following_id')
      .or(`following_id.eq.${session.user.id},follower_id.eq.${session.user.id}`);

    if (error) {
      console.error('Error cargando follows', error);
      return;
    }

    const followerIds = new Set<string>();
    const followingIds = new Set<string>();
    (followRows ?? []).forEach((row) => {
      const typed = row as { follower_id: string; following_id: string };
      if (typed.following_id === session.user.id) followerIds.add(typed.follower_id);
      if (typed.follower_id === session.user.id) followingIds.add(typed.following_id);
    });

    const nextFollowers = followerIds.size;
    const nextFollowing = followingIds.size;

    setFollowCounts({ followers: nextFollowers, following: nextFollowing });

    try {
      sessionStorage.setItem(
        followCountsCacheKey,
        JSON.stringify({
          followers: nextFollowers,
          following: nextFollowing,
        })
      );
    } catch {
      // Ignore cache write errors (private mode, quota, etc.).
    }
  }, [followCountsCacheKey, session.user.id]);

  const loadCurrentMonthRank = useCallback(async () => {
    setFramesLoading(true);
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const { data, error } = await supabase
      .from('entries')
      .select('user_id, rating, restaurant_id, datetime')
      .eq('is_burger', true)
      .eq('visibility', 'public')
      .is('deleted_at', null)
      .gte('datetime', monthStart.toISOString())
      .lt('datetime', monthEnd.toISOString());

    if (error) {
      setMonthlyRank(null);
      setFramesLoading(false);
      return;
    }

    const rows = (data ?? []) as {
      user_id: string;
      rating: number | null;
      restaurant_id: string | null;
      datetime: string;
    }[];

    if (!rows.length) {
      setMonthlyRank(null);
      setFramesLoading(false);
      return;
    }

    const byUser = new Map<
      string,
      { burgers: number; ratingSum: number; ratingCount: number; restaurants: Set<string>; lastTs: number }
    >();

    rows.forEach((row) => {
      const current = byUser.get(row.user_id) ?? {
        burgers: 0,
        ratingSum: 0,
        ratingCount: 0,
        restaurants: new Set<string>(),
        lastTs: 0,
      };
      current.burgers += 1;
      if (row.rating != null) {
        current.ratingSum += row.rating;
        current.ratingCount += 1;
      }
      if (row.restaurant_id) current.restaurants.add(row.restaurant_id);
      const ts = new Date(row.datetime).getTime();
      if (!Number.isNaN(ts) && ts > current.lastTs) current.lastTs = ts;
      byUser.set(row.user_id, current);
    });

    const ranking = Array.from(byUser.entries()).map(([userId, stats]) => ({
      userId,
      burgers: stats.burgers,
      restaurantCount: stats.restaurants.size,
      lastTs: stats.lastTs,
    }));

    ranking.sort((a, b) => {
      if (b.burgers !== a.burgers) return b.burgers - a.burgers;
      if (a.lastTs !== b.lastTs) return a.lastTs - b.lastTs;
      if (b.restaurantCount !== a.restaurantCount) return b.restaurantCount - a.restaurantCount;
      return a.userId.localeCompare(b.userId);
    });

    const index = ranking.findIndex((row) => row.userId === session.user.id);
    setMonthlyRank(index >= 0 ? index + 1 : null);
    setFramesLoading(false);
  }, [session.user.id]);

  const loadAvailableMonthlyFrame = useCallback(async () => {
    const { data: latestRows, error: latestError } = await supabase
      .from('monthly_frame_results')
      .select('year_month')
      .order('year_month', { ascending: false })
      .limit(1);

    if (latestError) {
      if (latestError.code !== '42P01') {
        console.error('Error loading latest monthly frame results', latestError);
      }
      setUnlockedFrames({ gold: false, silver: false, bronze: false });
      return;
    }

    const latestMonth = (latestRows?.[0] as { year_month?: string | null } | undefined)?.year_month ?? null;
    if (!latestMonth) {
      setUnlockedFrames({ gold: false, silver: false, bronze: false });
      return;
    }

    const { data, error } = await supabase
      .from('monthly_frame_results')
      .select('frame_key')
      .eq('year_month', latestMonth)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (error) {
      console.error('Error loading available monthly frame', error);
      setUnlockedFrames({ gold: false, silver: false, bronze: false });
      return;
    }

    const allowed = parseFrameKey((data as { frame_key?: string | null } | null)?.frame_key ?? null);
    setUnlockedFrames({
      gold: allowed === 'gold',
      silver: allowed === 'silver',
      bronze: allowed === 'bronze',
    });
  }, [parseFrameKey, session.user.id]);

  const persistEquippedFrame = useCallback(async (key: FrameOption['key'] | null) => {
    const { data, error: updateError } = await supabase
      .from('profiles')
      .update({ equipped_frame: key })
      .eq('id', session.user.id)
      .select()
      .single();

    if (updateError) {
      if (updateError.code !== '42703') {
        throw updateError;
      }
      // Column still not deployed. Keep local value as fallback.
      return;
    }

    setProfile(data as ProfileData);
  }, [session.user.id]);

  useRevalidateOnFocus(() => {
    loadProfile({ showLoading: false, skipCache: true });
    loadFollowCounts();
    loadAvailableMonthlyFrame();
    loadCurrentMonthRank();
  }, [loadAvailableMonthlyFrame, loadCurrentMonthRank, loadFollowCounts, loadProfile], { minIntervalMs: 120000, maxStaleMs: 600000, debounceMs: 500 });

  useEffect(() => {
    const profileFrame = parseFrameKey(profile?.equipped_frame);
    setEquippedFrameKey(profileFrame);
  }, [parseFrameKey, profile?.equipped_frame]);

  useEffect(() => {
    void loadAvailableMonthlyFrame();
  }, [loadAvailableMonthlyFrame]);

  useEffect(() => {
    loadCurrentMonthRank();
  }, [loadCurrentMonthRank]);

  useEffect(() => {
    const cachedCounts = sessionStorage.getItem(followCountsCacheKey);
    if (cachedCounts) {
      try {
        const parsed = JSON.parse(cachedCounts) as { followers: number; following: number };
        setFollowCounts(parsed);
        return;
      } catch {
        // Fall through to fetch.
      }
    }

    loadFollowCounts();
  }, [followCountsCacheKey, loadFollowCounts]);

  useEffect(() => {
    const channel = supabase
      .channel(`profile-follows-${session.user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follows', filter: `following_id=eq.${session.user.id}` },
        () => {
          loadFollowCounts();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follows', filter: `follower_id=eq.${session.user.id}` },
        () => {
          loadFollowCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadFollowCounts, session.user.id]);

  useEffect(() => {
    if (!profile) return;
      try {
        sessionStorage.setItem(profileCacheKey, JSON.stringify(profile));
      } catch {
        // Ignore cache write errors (private mode, quota, etc.).
      }
  }, [profile, profileCacheKey]);

  useEffect(() => {
    usernameInputRef.current = usernameInput;
  }, [usernameInput]);

  useEffect(() => {
    if (!avatarOptionsOpen && !framePickerOpen) return;
    return lockBodyScroll();
  }, [avatarOptionsOpen, framePickerOpen]);

  const currentAvatar = useMemo(() => avatarPreview ?? profile?.avatar_url ?? null, [avatarPreview, profile?.avatar_url]);
  const equippedFrameUrl = useMemo(
    () => FRAME_OPTIONS.find((frame) => frame.key === equippedFrameKey)?.src ?? null,
    [equippedFrameKey]
  );
  const initialLetter = (profile?.username ?? username ?? session.user.email?.[0] ?? '?').charAt(0).toUpperCase();
  const profileCompletion = useMemo(() => {
    const items = [
      Boolean(currentAvatar),
      Boolean(bioInput.trim()),
      Boolean(favoriteBurgerTypeInput),
      Boolean(favoriteSauceInput),
      Boolean(favoriteDonenessInput),
      Boolean(favoriteBreadInput),
    ];
    const completed = items.filter(Boolean).length;
    return {
      completed,
      total: items.length,
      percent: Math.round((completed / items.length) * 100),
      isComplete: completed === items.length,
    };
  }, [
    bioInput,
    currentAvatar,
    favoriteBreadInput,
    favoriteBurgerTypeInput,
    favoriteDonenessInput,
    favoriteSauceInput,
  ]);
  const idealBurgerText = useMemo(() => {
    if (!favoriteBurgerTypeInput || !favoriteSauceInput || !favoriteDonenessInput || !favoriteBreadInput) {
      return null;
    }
    return t('profile.burgerPreferences.idealBurger', {
      type: t(`profile.burgerPreferences.types.${favoriteBurgerTypeInput}`),
      sauce: t(`profile.burgerPreferences.sauces.${favoriteSauceInput}`),
      doneness: t(`profile.burgerPreferences.doneness.${favoriteDonenessInput}`),
      bread: t(`profile.burgerPreferences.breads.${favoriteBreadInput}`),
    });
  }, [favoriteBreadInput, favoriteBurgerTypeInput, favoriteDonenessInput, favoriteSauceInput, t]);

  const handleSelectFrame = async (key: FrameOption['key'] | null) => {
    if (key && !unlockedFrames[key]) return;
    const previous = equippedFrameKey;
    setEquippedFrameKey(key);
    try {
      await persistEquippedFrame(key);
      window.dispatchEvent(
        new CustomEvent('bw-avatar-frame-updated', {
          detail: { userId: session.user.id, frameKey: key },
          })
      );
      setFramePickerOpen(false);
    } catch (err) {
      setEquippedFrameKey(previous ?? null);
      const msg = err instanceof Error ? err.message : 'No se pudo guardar la decoracion.';
      setError(msg);
    }
  };

  const handleOpenFramePicker = () => {
    setAvatarOptionsOpen(false);
    setFramePickerOpen(true);
    void loadCurrentMonthRank();
  };

  const hasChanges = useMemo(() => {
    const usernameChanged = (usernameInput.trim() || '') !== (profile?.username ?? '');
    const bioChanged = (bioInput.trim() || '') !== (profile?.bio ?? '');
    const privacyChanged = Boolean(isPrivate) !== Boolean(profile?.is_private);
    const languageChanged = languageInput !== (profile?.preferred_language ?? language);
    const currencyChanged = currencyInput !== (profile?.preferred_currency ?? currency);
    const favoriteBurgerTypeChanged = (favoriteBurgerTypeInput || null) !== (profile?.favorite_burger_type ?? null);
    const favoriteSauceChanged = (favoriteSauceInput || null) !== (profile?.favorite_sauce ?? null);
    const favoriteDonenessChanged = (favoriteDonenessInput || null) !== (profile?.favorite_doneness ?? null);
    const favoriteBreadChanged = (favoriteBreadInput || null) !== (profile?.favorite_bread ?? null);
    return (
      usernameChanged ||
      bioChanged ||
      privacyChanged ||
      languageChanged ||
      currencyChanged ||
      favoriteBurgerTypeChanged ||
      favoriteSauceChanged ||
      favoriteDonenessChanged ||
      favoriteBreadChanged
    );
  }, [
    bioInput,
    currency,
    currencyInput,
    favoriteBreadInput,
    favoriteBurgerTypeInput,
    favoriteDonenessInput,
    favoriteSauceInput,
    isPrivate,
    language,
    languageInput,
    profile?.bio,
    profile?.favorite_bread,
    profile?.favorite_burger_type,
    profile?.favorite_doneness,
    profile?.favorite_sauce,
    profile?.is_private,
    profile?.preferred_currency,
    profile?.preferred_language,
    profile?.username,
    usernameInput,
  ]);

  useEffect(() => {
    const handleBeforeBottomNavNavigate = (event: Event) => {
      const custom = event as CustomEvent<{ path?: string }>;
      const nextPath = custom.detail?.path ?? null;
      if (!nextPath || !hasChanges || saving) return;
      event.preventDefault();
      setPendingNavPath(nextPath);
    };

    window.addEventListener('bw-bottom-nav-before-navigate', handleBeforeBottomNavNavigate);
    return () => {
      window.removeEventListener('bw-bottom-nav-before-navigate', handleBeforeBottomNavNavigate);
    };
  }, [hasChanges, saving]);

  const handleConfirmPendingNavigation = () => {
    if (!pendingNavPath) return;
    const nextPath = pendingNavPath;
    setPendingNavPath(null);
    navigate(nextPath);
  };

  const getStoragePathFromUrl = (url: string | null | undefined) => {
    if (!url) return null;
    const marker = '/storage/v1/object/public/avatars/';
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.slice(idx + marker.length);
  };

  const uploadAvatar = async (file: File) => {
    setError(null);
    const previousUrl = profile?.avatar_url ?? null;
    try {
      const compressed = await compressImage(file, { maxWidth: 800, maxHeight: 800, quality: 0.7 });
      const fileExt = compressed.name.split('.').pop();
      const filePath = `${session.user.id}/${Date.now()}.${fileExt ?? 'jpg'}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, compressed, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const newUrl = publicData.publicUrl;

      if (previousUrl) {
        const prevPath = getStoragePathFromUrl(previousUrl);
        if (prevPath) {
          await supabase.storage.from('avatars').remove([prevPath]);
        }
      }

      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: newUrl })
        .eq('id', session.user.id)
        .select()
        .single();
      if (updateError) throw updateError;

      setProfile(data as ProfileData);
      setAvatarPreview(newUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo actualizar la foto.';
      setError(msg);
      setAvatarPreview(previousUrl);
    }
  };

  const handleFileChange = (file: File | null) => {
    if (!file) {
      setAvatarPreview(profile?.avatar_url ?? null);
      setAvatarCropSrc(null);
      setAvatarCropFile(null);
      return;
    }
    const src = URL.createObjectURL(file);
    setAvatarCropSrc(src);
    setAvatarCropFile(file);
  };

  const handleSave = async () => {
    const nextUsername = usernameInput.trim();

    if (!nextUsername) {
      setError('El nombre de usuario no puede estar vacio.');
      return;
    }
    if (/\s/.test(nextUsername)) {
      setError('El nombre de usuario no puede tener espacios.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { data: existing, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', nextUsername)
        .neq('id', session.user.id)
        .limit(1);

      if (userError) throw userError;
      if (existing && existing.length > 0) {
        setError('Ese nombre de usuario ya está en uso.');
        setSaving(false);
        return;
      }

      const payload = {
        username: nextUsername,
        display_name: nextUsername,
        bio: bioInput.trim(),
        is_private: isPrivate,
        preferred_language: languageInput,
        preferred_currency: currencyInput,
        favorite_burger_type: favoriteBurgerTypeInput || null,
        favorite_sauce: favoriteSauceInput || null,
        favorite_doneness: favoriteDonenessInput || null,
        favorite_bread: favoriteBreadInput || null,
      };

      const attemptUpdate = async (body: Record<string, unknown>) =>
        supabase.from('profiles').update(body).eq('id', session.user.id).select().single();

      let { data, error: updateError } = await attemptUpdate(payload);
      if (updateError && updateError?.code === '42703') {
        ({ data, error: updateError } = await attemptUpdate({
          username: nextUsername,
          display_name: nextUsername,
          bio: bioInput.trim(),
          is_private: isPrivate,
        }));
      }

      if (updateError) throw updateError;

      const { error: authError } = await supabase.auth.updateUser({
        data: { username: nextUsername, display_name: nextUsername, username_set: true },
      });
      if (authError) throw authError;

      await supabase.auth.refreshSession().catch(() => {});

      setProfile(data as ProfileData);
      syncBurgerPreferenceInputs(data as ProfileData);
      setUsernameInput(nextUsername);
      setLanguage(languageInput);
      setCurrency(currencyInput);
      window.dispatchEvent(
        new CustomEvent('bw-profile-updated', {
          detail: { username: nextUsername, displayName: nextUsername },
        })
      );
      try {
        sessionStorage.setItem(profileCacheKey, JSON.stringify(data));
      } catch {
        // Ignore cache write errors (private mode, quota, etc.).
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo guardar el perfil.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };
  const handleSignOut = async () => {
    try {
      await unregisterCurrentPushSubscription();
      await supabase.auth.signOut();
      sessionStorage.clear();
    } catch (err) {
      console.error('No se pudo cerrar sesion', err);
    }
  };

  const handleAvatarCropConfirm = async () => {
    if (!avatarCropFile || !avatarCropArea) return;
    try {
      const croppedFile = await cropImageFile(avatarCropFile, avatarCropArea);
      const localPreview = URL.createObjectURL(croppedFile);
      setAvatarPreview(localPreview);
      await uploadAvatar(croppedFile);
    } finally {
      if (avatarCropSrc) URL.revokeObjectURL(avatarCropSrc);
      setAvatarCropSrc(null);
      setAvatarCropFile(null);
      setAvatarCropArea(null);
      setAvatarZoom(1);
      setAvatarCrop({ x: 0, y: 0 });
    }
  };

  const handleAvatarCropCancel = () => {
    if (avatarCropSrc) URL.revokeObjectURL(avatarCropSrc);
    setAvatarCropSrc(null);
    setAvatarCropFile(null);
    setAvatarCropArea(null);
    setAvatarZoom(1);
    setAvatarCrop({ x: 0, y: 0 });
    setAvatarPreview(profile?.avatar_url ?? null);
  };

  const handleFollowingDelta = useCallback((delta: number) => {
    setFollowCounts((prev) => ({
      ...prev,
      following: Math.max(0, prev.following + delta),
    }));
  }, []);

  const handleFollowListCount = useCallback((mode: FollowListMode, count: number) => {
    setFollowCounts((prev) => ({
      ...prev,
      [mode === 'following' ? 'following' : 'followers']: count,
    }));
  }, []);

  const handleOpenUserFeed = (user: { id: string; username: string | null; displayName: string | null }) => {
    setFollowListMode(null);
    onOpenUserDashboard(user);
  };

  return (
    <AppShell>
        <PageHeader
          title={t('profile.title')}
          subtitle={t('profile.subtitle')}
          logoAlt="Burger Wrapped"
          actions={<TopMenu theme={theme} onToggleTheme={onToggleTheme} />}
        />

        <main className="bw-main bw-profile-main">
          <section className="bw-card bw-profile-card">
            <button
              type="button"
              className="bw-icon-button bw-profile-saved-button"
              onClick={() => {
                navigate('/saved');
              }}
              aria-label={t('profile.savedPosts')}
            >
              <BookmarksOutlined fontSize="small" />
            </button>
            <button
              type="button"
              className="bw-icon-button bw-profile-wishlist-button"
              onClick={() => {
                navigate('/burger-wishlist');
              }}
              aria-label={t('profile.burgerWishlist')}
            >
              <PlaylistAdd fontSize="small" />
            </button>
            <div className="bw-profile-header">
              <button
                type="button"
                className="bw-profile-avatar-trigger"
                onClick={() => setAvatarOptionsOpen(true)}
                aria-label="Opciones de avatar"
              >
                <span className="bw-profile-avatar-shell">
                  <span className="bw-avatar bw-avatar-lg">
                    {currentAvatar ? (
                      <img
                        src={currentAvatar}
                        alt={profile?.username ?? username ?? session.user.email}
                        className="bw-avatar-image"
                      />
                    ) : (
                      <span className="bw-avatar-placeholder">{initialLetter}</span>
                    )}
                  </span>
                  {equippedFrameUrl ? (
                    <img
                      src={equippedFrameUrl}
                      alt=""
                      aria-hidden="true"
                      className="bw-profile-avatar-frame"
                    />
                  ) : null}
                </span>
              </button>
              <div>
                <h1 className="bw-profile-username" style={{ margin: 0, fontSize: 22 }}>
                  @{profile?.username ?? username ?? 'usuario'}
                </h1>
                <p className="bw-profile-email">{session.user.email}</p>
                <div className="bw-follow-inline">
                  <button type="button" className="bw-follow-link" onClick={() => setFollowListMode('following')}>
                    {followCounts.following} {t('common.following')}
                  </button>
                  <span className="bw-follow-separator">·</span>
                  <button type="button" className="bw-follow-link" onClick={() => setFollowListMode('followers')}>
                    {followCounts.followers} {t('common.followers')}
                  </button>
                </div>
              </div>
            </div>
            {loading && <p style={{ fontSize: 13 }}>{t('profile.loading')}</p>}
            {error && <p style={{ fontSize: 12, color: 'red' }}>{error}</p>}

            {!profileCompletion.isComplete ? (
              <div className="bw-profile-completion">
                <div className="bw-profile-completion-header">
                  <div>
                    <div className="bw-profile-completion-title">{t('profile.completion.title')}</div>
                    <div className="bw-profile-completion-text">{t('profile.completion.description')}</div>
                  </div>
                  <span className="bw-profile-completion-percent">{profileCompletion.percent}%</span>
                </div>
                <div
                  className="bw-profile-completion-bar"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={profileCompletion.percent}
                >
                  <span style={{ width: `${profileCompletion.percent}%` }} />
                </div>
                <div className="bw-profile-completion-meta">
                  {t('profile.completion.progress', {
                    completed: profileCompletion.completed,
                    total: profileCompletion.total,
                  })}
                </div>
              </div>
            ) : null}

            <div className="bw-profile-form">
              <div className="bw-field">
                <label className="bw-label" htmlFor="username">{t('profile.usernameLabel')}</label>
                <input
                  id="username"
                  className="bw-input"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder={t('profile.usernamePlaceholder')}
                />
                <p className="bw-helper">{t('profile.usernameHelper')}</p>
              </div>

              <div className="bw-field">
                <label className="bw-label" htmlFor="bio">{t('profile.bioLabel')}</label>
                <textarea
                  id="bio"
                  className="bw-textarea"
                  value={bioInput}
                  onChange={(e) => setBioInput(e.target.value)}
                  placeholder={t('profile.bioPlaceholder')}
                  rows={4}
                  style={{ resize: 'none' }}
                  maxLength={BIO_LIMIT}
                />
                <div className="bw-helper" style={{ textAlign: 'right', marginTop: 4 }}>
                  {bioInput.length}/{BIO_LIMIT}
                </div>
              </div>

              <div className="bw-field">
                <div className="bw-label" style={{ marginBottom: 6 }}>
                  {t('profile.burgerPreferences.title')}
                </div>
                <p className="bw-helper" style={{ marginTop: 0 }}>
                  {t('profile.burgerPreferences.description')}
                </p>
                <div className="bw-preferences-grid">
                  <div className="bw-field" style={{ marginBottom: 0 }}>
                    <label className="bw-label" htmlFor="favorite-burger-type">
                      {t('profile.burgerPreferences.typeLabel')}
                    </label>
                    <select
                      id="favorite-burger-type"
                      className="bw-input"
                      value={favoriteBurgerTypeInput}
                      onChange={(e) => {
                        const next = e.target.value;
                        setFavoriteBurgerTypeInput(isBurgerTypePreference(next) ? next : '');
                      }}
                    >
                      <option value="">{t('profile.burgerPreferences.emptyOption')}</option>
                      {BURGER_TYPE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {t(`profile.burgerPreferences.types.${option}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="bw-field" style={{ marginBottom: 0 }}>
                    <label className="bw-label" htmlFor="favorite-sauce">
                      {t('profile.burgerPreferences.sauceLabel')}
                    </label>
                    <select
                      id="favorite-sauce"
                      className="bw-input"
                      value={favoriteSauceInput}
                      onChange={(e) => {
                        const next = e.target.value;
                        setFavoriteSauceInput(isBurgerSaucePreference(next) ? next : '');
                      }}
                    >
                      <option value="">{t('profile.burgerPreferences.emptyOption')}</option>
                      {BURGER_SAUCE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {t(`profile.burgerPreferences.sauces.${option}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="bw-field" style={{ marginBottom: 0 }}>
                    <label className="bw-label" htmlFor="favorite-doneness">
                      {t('profile.burgerPreferences.donenessLabel')}
                    </label>
                    <select
                      id="favorite-doneness"
                      className="bw-input"
                      value={favoriteDonenessInput}
                      onChange={(e) => {
                        const next = e.target.value;
                        setFavoriteDonenessInput(isBurgerDonenessPreference(next) ? next : '');
                      }}
                    >
                      <option value="">{t('profile.burgerPreferences.emptyOption')}</option>
                      {BURGER_DONENESS_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {t(`profile.burgerPreferences.doneness.${option}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="bw-field" style={{ marginBottom: 0 }}>
                    <label className="bw-label" htmlFor="favorite-bread">
                      {t('profile.burgerPreferences.breadLabel')}
                    </label>
                    <select
                      id="favorite-bread"
                      className="bw-input"
                      value={favoriteBreadInput}
                      onChange={(e) => {
                        const next = e.target.value;
                        setFavoriteBreadInput(isBurgerBreadPreference(next) ? next : '');
                      }}
                    >
                      <option value="">{t('profile.burgerPreferences.emptyOption')}</option>
                      {BURGER_BREAD_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {t(`profile.burgerPreferences.breads.${option}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {idealBurgerText ? (
                  <div className="bw-profile-ideal-burger">{idealBurgerText}</div>
                ) : null}
              </div>

              <div className="bw-privacy-toggle">
                <div>
                  <div className="bw-privacy-title">{t('profile.privacyTitle')}</div>
                  <div className="bw-privacy-text">
                    {t('profile.privacyDescription')}
                  </div>
                </div>
                <label className="bw-switch">
                  <input
                    type="checkbox"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                  />
                  <span className="bw-switch-slider" aria-hidden="true" />
                </label>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />

              <div className="bw-field">
                <div className="bw-label" style={{ marginBottom: 6 }}>{t('profile.preferencesTitle')}</div>
                <p className="bw-helper" style={{ marginTop: 0 }}>{t('profile.preferencesDescription')}</p>
                <div className="bw-preferences-grid">
                  <div className="bw-field" style={{ marginBottom: 0 }}>
                    <label className="bw-label" htmlFor="language-select">{t('common.language')}</label>
                    <select
                      id="language-select"
                      className="bw-input"
                      value={languageInput}
                      onChange={(e) => setLanguageInput(e.target.value)}
                    >
                      {languageOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="bw-field" style={{ marginBottom: 0 }}>
                    <label className="bw-label" htmlFor="currency-select">{t('common.currency')}</label>
                    <select
                      id="currency-select"
                      className="bw-input"
                      value={currencyInput}
                      onChange={(e) => setCurrencyInput(e.target.value)}
                    >
                      {currencyOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="bw-helper" style={{ marginTop: 6 }}>{t('profile.preferencesNote')}</p>
              </div>

              <PushNotificationSettings userId={session.user.id} />

              {profile?.is_admin ? (
                <div className="bw-privacy-toggle">
                  <div>
                    <div className="bw-privacy-title">Modo admin</div>
                    <div className="bw-privacy-text">
                      Activa este modo para usar la navegacion de administracion.
                    </div>
                  </div>
                  <label className="bw-switch">
                    <input
                      type="checkbox"
                      checked={adminModeEnabled}
                      onChange={(e) => onAdminModeChange?.(e.target.checked)}
                    />
                    <span className="bw-switch-slider" aria-hidden="true" />
                  </label>
                </div>
              ) : null}

              <div className="bw-profile-actions">
                <button
                  type="button"
                  className="bw-btn bw-btn-danger-outline"
                  onClick={handleSignOut}
                  disabled={saving}
                >
                  {t('profile.signOut')}
                </button>
              </div>
            </div>
          </section>
        </main>

        <div className="bw-profile-save-bar">
          <button
            type="button"
            className="bw-btn bw-btn-primary bw-profile-save-button"
            onClick={handleSave}
            disabled={saving || !hasChanges}
          >
            {saving ? t('profile.saving') : t('profile.saveChanges')}
          </button>
        </div>

      {saving && (
        <div className="bw-loader-overlay">
          <div className="bw-loader-spinner" aria-label={t('profile.saving')}></div>
        </div>
      )}

      <FollowListModal
        open={Boolean(followListMode)}
        mode={followListMode}
        currentUserId={session.user.id}
        onClose={() => setFollowListMode(null)}
        onFollowingDelta={handleFollowingDelta}
        onListCount={handleFollowListCount}
        onViewPosts={handleOpenUserFeed}
      />

      <ConfirmDialog
        open={Boolean(pendingNavPath)}
        onClose={() => setPendingNavPath(null)}
        title={t('profile.unsavedLeaveTitle')}
        message={t('profile.unsavedLeaveMessage')}
        actions={(
          <>
            <button
              type="button"
              className="bw-btn bw-btn-ghost"
              onClick={() => setPendingNavPath(null)}
            >
              {t('profile.unsavedLeaveCancel')}
            </button>
            <button
              type="button"
              className="bw-btn bw-btn-danger"
              onClick={handleConfirmPendingNavigation}
            >
              {t('profile.unsavedLeaveConfirm')}
            </button>
          </>
        )}
      />

      <ModalBase
        open={avatarOptionsOpen}
        onClose={() => setAvatarOptionsOpen(false)}
        modalClassName="bw-modal bw-profile-avatar-modal"
      >
        <div className="bw-modal-header">
          <div>
            <h2 className="bw-modal-title">Avatar</h2>
            <p className="bw-modal-subtitle">Elige que quieres cambiar.</p>
          </div>
          <button
            type="button"
            className="bw-icon-button"
            onClick={() => setAvatarOptionsOpen(false)}
            aria-label={t('common.close')}
          >
            <Close fontSize="small" />
          </button>
        </div>
        <div className="bw-profile-avatar-options">
          <button
            type="button"
            className="bw-btn bw-btn-primary"
            onClick={() => {
              setAvatarOptionsOpen(false);
              fileInputRef.current?.click();
            }}
          >
            Cambiar foto de perfil
          </button>
          <button
            type="button"
            className="bw-btn bw-btn-ghost"
            onClick={handleOpenFramePicker}
          >
            Cambiar decoracion de avatar
          </button>
        </div>
      </ModalBase>

      <ModalBase
        open={framePickerOpen}
        onClose={() => setFramePickerOpen(false)}
        modalClassName="bw-modal bw-profile-avatar-modal"
      >
        <div className="bw-modal-header">
          <div>
            <h2 className="bw-modal-title">Decoracion de avatar</h2>
            <p className="bw-modal-subtitle">
              {monthlyRank ? `Tu posicion mensual: #${monthlyRank}` : 'Aun no tienes posicion en el ranking mensual.'}
            </p>
          </div>
          <button
            type="button"
            className="bw-icon-button"
            onClick={() => setFramePickerOpen(false)}
            aria-label={t('common.close')}
          >
            <Close fontSize="small" />
          </button>
        </div>
        <div className="bw-profile-frame-list">
          <button
            type="button"
            className={`bw-profile-frame-item ${equippedFrameKey === null ? 'is-selected' : ''}`}
            onClick={() => {
              void handleSelectFrame(null);
            }}
          >
            <span className="bw-profile-frame-preview bw-profile-frame-preview-none">X</span>
            <span className="bw-profile-frame-meta">
              <span className="bw-profile-frame-name">Sin marco</span>
              <span className="bw-profile-frame-rule">Quita la decoracion actual</span>
            </span>
            {equippedFrameKey === null ? <Check fontSize="small" /> : null}
          </button>

          {FRAME_OPTIONS.map((frame) => {
            const unlocked = unlockedFrames[frame.key];
            const isSelected = equippedFrameKey === frame.key;
            return (
              <button
                type="button"
                key={frame.key}
                className={`bw-profile-frame-item ${isSelected ? 'is-selected' : ''} ${!unlocked ? 'is-locked' : ''}`}
                onClick={() => {
                  void handleSelectFrame(frame.key);
                }}
                disabled={!unlocked || framesLoading}
              >
                <span className="bw-profile-frame-preview-shell">
                  <span className="bw-profile-frame-preview">
                    {currentAvatar ? (
                      <img
                        src={currentAvatar}
                        alt=""
                        className="bw-profile-frame-preview-avatar"
                      />
                    ) : (
                      <span className="bw-avatar-placeholder">{initialLetter}</span>
                    )}
                  </span>
                  <img src={frame.src} alt="" aria-hidden="true" className="bw-profile-frame-preview-overlay" />
                  {!unlocked ? (
                    <span className="bw-profile-frame-lock" title="No disponible">
                      <Block fontSize="small" />
                    </span>
                  ) : null}
                </span>
                <span className="bw-profile-frame-meta">
                  <span className="bw-profile-frame-name">{frame.label}</span>
                  <span className="bw-profile-frame-rule">{frame.rule}</span>
                </span>
                {isSelected ? <Check fontSize="small" /> : null}
              </button>
            );
          })}
        </div>
      </ModalBase>

      {avatarCropSrc && (
        <div className="bw-photo-viewer-backdrop" onClick={handleAvatarCropCancel}>
          <div className="bw-cropper" onClick={(e) => e.stopPropagation()}>
            <div className="bw-cropper-stage">
              <Cropper
                image={avatarCropSrc}
                crop={avatarCrop}
                zoom={avatarZoom}
                aspect={1}
                cropShape="round"
                onCropChange={setAvatarCrop}
                onZoomChange={setAvatarZoom}
                onCropComplete={(_area, areaPixels) => setAvatarCropArea(areaPixels)}
              />
            </div>
            <div className="bw-cropper-actions">
              <button className="bw-btn bw-btn-ghost" type="button" onClick={handleAvatarCropCancel}>
                {t('profile.cropCancel')}
              </button>
              <button className="bw-btn bw-btn-primary" type="button" onClick={handleAvatarCropConfirm}>
                {t('profile.cropSave')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}


