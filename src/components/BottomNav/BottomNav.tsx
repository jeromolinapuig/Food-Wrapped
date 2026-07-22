import { Close, DynamicFeed, EmojiEvents, Groups, Home, MoreHoriz, NotificationsActive, PersonOutline, Search } from '@mui/icons-material';
import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState, startTransition } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  isBurgerBreadPreference,
  isBurgerDonenessPreference,
  isBurgerSaucePreference,
  isBurgerTypePreference,
} from '../../constants/burgerPreferences';
import { supabase } from '../../lib/supabaseClient';
import { useRevalidateOnFocus } from '../../utils/useRevalidateOnFocus';
import { Avatar } from '../common/Avatar';
import './BottomNav.css';
import '../../styles/shared.css';
import { useTranslation } from 'react-i18next';

type BottomNavProps = {
  session: Session | null;
  onRequireLogin?: () => void;
  adminModeEnabled?: boolean;
  isAdmin?: boolean;
};

export function BottomNav({
  session,
  onRequireLogin,
  adminModeEnabled = false,
  isAdmin = false,
}: Readonly<BottomNavProps>) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFrame, setAvatarFrame] = useState<'gold' | 'silver' | 'bronze' | null>(null);
  const [initial, setInitial] = useState<string>('?');
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [profileSuggestionDismissedUserId, setProfileSuggestionDismissedUserId] = useState<string | null>(null);
  const isGuest = !session;
  const userId = session?.user.id ?? null;
  const profileSuggestionDismissedKey = userId ? `bw-profile-suggestion-dismissed-${userId}` : null;

  const activeKey = useMemo(() => {
    if (adminModeEnabled && isAdmin) {
      if (location.pathname.startsWith('/admin/users')) return 'admin-users';
      if (location.pathname.startsWith('/admin/reports')) return 'admin-reports';
      if (location.pathname.startsWith('/admin/notifications')) return 'admin-notifications';
      if (location.pathname.startsWith('/profile')) return 'profile';
      return 'admin-feed';
    }
    if (location.pathname.startsWith('/users')) {
      const state = location.state as { returnTo?: string } | null;
      const returnTo = state?.returnTo ?? '';
      if (returnTo.startsWith('/groups')) return 'more';
      if (returnTo.startsWith('/feed')) return 'feed';
      if (returnTo.startsWith('/search')) return 'search';
      if (returnTo.startsWith('/ranking')) return 'more';
      if (returnTo.startsWith('/burger-wishlist')) return 'more';
      if (returnTo.startsWith('/burger-calendar')) return 'more';
      if (returnTo.startsWith('/my-top-burgers')) return 'more';
      if (returnTo.startsWith('/saved')) return 'more';
      if (returnTo.startsWith('/more')) return 'more';
      if (returnTo.startsWith('/profile')) return 'profile';
    }
    if (location.pathname === '/' || location.pathname.startsWith('/home')) return 'home';
    if (location.pathname.startsWith('/feed')) return 'feed';
    if (location.pathname.startsWith('/search')) return 'search';
    if (location.pathname.startsWith('/groups')) return 'more';
    if (location.pathname.startsWith('/ranking')) return 'more';
    if (location.pathname.startsWith('/burger-wishlist')) return 'more';
    if (location.pathname.startsWith('/burger-calendar')) return 'more';
    if (location.pathname.startsWith('/my-top-burgers')) return 'more';
    if (location.pathname.startsWith('/saved')) return 'more';
    if (location.pathname.startsWith('/more')) return 'more';
    if (location.pathname.startsWith('/profile')) return 'profile';
    return 'home';
  }, [adminModeEnabled, isAdmin, location.pathname, location.state]);

  const loadProfile = useCallback(async () => {
    if (!session || (adminModeEnabled && isAdmin)) return;
    let { data, error } = await supabase
      .from('profiles')
      .select('avatar_url, equipped_frame, username, display_name, bio, favorite_burger_type, favorite_sauce, favorite_doneness, favorite_bread')
      .eq('id', session.user.id)
      .single();

    if (error && (error as { code?: string }).code === '42703') {
      ({ data, error } = await supabase
        .from('profiles')
        .select('avatar_url, equipped_frame, username, display_name')
        .eq('id', session.user.id)
        .single());
    }

    if (error || !data) {
      setAvatarUrl(null);
      setAvatarFrame(null);
      setInitial(session.user.email?.charAt(0).toUpperCase() ?? '?');
      setProfileIncomplete(false);
      return;
    }

    const profile = data as {
      avatar_url: string | null;
      equipped_frame: 'gold' | 'silver' | 'bronze' | null;
      username: string | null;
      display_name: string | null;
      bio?: string | null;
      favorite_burger_type?: string | null;
      favorite_sauce?: string | null;
      favorite_doneness?: string | null;
      favorite_bread?: string | null;
    };
    const base = profile.username ?? profile.display_name ?? session.user.email ?? '?';
    setAvatarUrl(profile.avatar_url);
    setAvatarFrame(profile.equipped_frame ?? null);
    setInitial(base.charAt(0).toUpperCase());
    setProfileIncomplete(!(
      profile.avatar_url &&
      profile.bio?.trim() &&
      isBurgerTypePreference(profile.favorite_burger_type) &&
      isBurgerSaucePreference(profile.favorite_sauce) &&
      isBurgerDonenessPreference(profile.favorite_doneness) &&
      isBurgerBreadPreference(profile.favorite_bread)
    ));
  }, [adminModeEnabled, isAdmin, session]);

  useEffect(() => {
    startTransition(() => {
      void loadProfile();
    });
  }, [loadProfile]);

  useEffect(() => {
    if (!userId) return;
    const handleFrameUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ userId?: string; frameKey?: 'gold' | 'silver' | 'bronze' | null }>;
      if (custom.detail?.userId !== userId) return;
      setAvatarFrame(custom.detail?.frameKey ?? null);
    };
    const handleProfileUpdated = () => {
      void loadProfile();
    };
    window.addEventListener('bw-avatar-frame-updated', handleFrameUpdated);
    window.addEventListener('bw-profile-updated', handleProfileUpdated);
    return () => {
      window.removeEventListener('bw-avatar-frame-updated', handleFrameUpdated);
      window.removeEventListener('bw-profile-updated', handleProfileUpdated);
    };
  }, [loadProfile, userId]);

  useRevalidateOnFocus(
    () => {
      loadProfile();
    },
    [loadProfile],
    { minIntervalMs: 300000, maxStaleMs: 1200000, debounceMs: 500 }
  );

  const requestNavigation = (path: string) => {
    if (location.pathname === path) return false;
    const event = new CustomEvent('bw-bottom-nav-before-navigate', {
      cancelable: true,
      detail: { path },
    });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  };

  const handleClick = (path: string) => {
    if (requestNavigation(path)) return;
    navigate(path);
  };

  const handleDismissProfileSuggestion = () => {
    setProfileSuggestionDismissedUserId(userId);
    if (profileSuggestionDismissedKey) {
      window.localStorage.setItem(profileSuggestionDismissedKey, 'true');
    }
  };

  const handleOpenProfileSuggestion = () => {
    handleDismissProfileSuggestion();
    handleClick('/profile/settings');
  };

  if (adminModeEnabled && isAdmin) {
    return (
      <nav className="bw-bottom-nav is-admin" aria-label={t('common.navigation', { defaultValue: 'Navigation' })}>
        <button
          type="button"
          className={`bw-bottom-nav-item ${activeKey === 'admin-feed' ? 'is-active' : ''}`}
          onClick={() => handleClick('/admin/feed')}
          aria-label="Admin Feed"
        >
          <span className="bw-bottom-nav-icon"><DynamicFeed /></span>
          <span className="bw-bottom-nav-label">Feed</span>
        </button>
        <button
          type="button"
          className={`bw-bottom-nav-item ${activeKey === 'admin-users' ? 'is-active' : ''}`}
          onClick={() => handleClick('/admin/users')}
          aria-label="Admin Usuarios"
        >
          <span className="bw-bottom-nav-icon"><Groups /></span>
          <span className="bw-bottom-nav-label">Usuarios</span>
        </button>
        <button
          type="button"
          className={`bw-bottom-nav-item ${activeKey === 'admin-reports' ? 'is-active' : ''}`}
          onClick={() => handleClick('/admin/reports')}
          aria-label="Admin Reportes"
        >
          <span className="bw-bottom-nav-icon"><EmojiEvents /></span>
          <span className="bw-bottom-nav-label">Reportes</span>
        </button>
        <button
          type="button"
          className={`bw-bottom-nav-item ${activeKey === 'admin-notifications' ? 'is-active' : ''}`}
          onClick={() => handleClick('/admin/notifications')}
          aria-label="Admin Notificaciones"
        >
          <span className="bw-bottom-nav-icon"><NotificationsActive /></span>
          <span className="bw-bottom-nav-label">Avisos</span>
        </button>
        <button
          type="button"
          className={`bw-bottom-nav-item ${activeKey === 'profile' ? 'is-active' : ''}`}
          onClick={() => handleClick('/profile')}
          aria-label={t('profile.title')}
        >
          <span className="bw-bottom-nav-icon"><PersonOutline /></span>
          <span className="bw-bottom-nav-label">
            {t('common.profile', { defaultValue: 'Profile' })}
          </span>
        </button>
      </nav>
    );
  }

  const showProfileSuggestion = Boolean(
    !isGuest &&
    profileIncomplete &&
    profileSuggestionDismissedUserId !== userId &&
    (!profileSuggestionDismissedKey || window.localStorage.getItem(profileSuggestionDismissedKey) !== 'true') &&
    activeKey !== 'profile'
  );

  return (
    <nav
      className={`bw-bottom-nav is-main ${showProfileSuggestion ? 'is-profile-suggestion-open' : ''}`}
      aria-label={t('common.navigation', { defaultValue: 'Navigation' })}
    >
      <button
        type="button"
        className={`bw-bottom-nav-item ${activeKey === 'home' ? 'is-active' : ''}`}
        onClick={() => handleClick('/')}
        aria-label={t('common.home', { defaultValue: 'Home' })}
      >
        <span className="bw-bottom-nav-icon"><Home /></span>
        <span className="bw-bottom-nav-label">{t('common.home', { defaultValue: 'Home' })}</span>
      </button>
      <button
        type="button"
        className={`bw-bottom-nav-item ${activeKey === 'feed' ? 'is-active' : ''}`}
        onClick={() => handleClick('/feed')}
        aria-label="Feed"
      >
        <span className="bw-bottom-nav-icon"><DynamicFeed /></span>
        <span className="bw-bottom-nav-label">Feed</span>
      </button>
      <button
        type="button"
        className={`bw-bottom-nav-item ${activeKey === 'search' ? 'is-active' : ''}`}
        onClick={() => handleClick('/search')}
        aria-label={t('common.search', { defaultValue: 'Search' })}
      >
        <span className="bw-bottom-nav-icon"><Search /></span>
        <span className="bw-bottom-nav-label">{t('common.search', { defaultValue: 'Search' })}</span>
      </button>
      <button
        type="button"
        className={`bw-bottom-nav-item ${activeKey === 'more' ? 'is-active' : ''}`}
        onClick={() => handleClick('/more')}
        aria-label={t('common.more', { defaultValue: 'More' })}
      >
        <span className="bw-bottom-nav-icon"><MoreHoriz /></span>
        <span className="bw-bottom-nav-label">{t('common.more', { defaultValue: 'More' })}</span>
      </button>
      <div className="bw-bottom-nav-profile">
        {showProfileSuggestion && (
          <div className="bw-profile-suggestion" role="status">
            <button
              type="button"
              className="bw-profile-suggestion-close"
              onClick={handleDismissProfileSuggestion}
              aria-label={t('common.close', { defaultValue: 'Close' })}
            >
              <Close fontSize="small" />
            </button>
            <span className="bw-profile-suggestion-title">{t('dashboard.profileReminderTitle')}</span>
            <span className="bw-profile-suggestion-text">{t('dashboard.profileReminderText')}</span>
            <button
              type="button"
              className="bw-profile-suggestion-action"
              onClick={handleOpenProfileSuggestion}
            >
              {t('dashboard.profileReminderAction')}
            </button>
          </div>
        )}
        <button
          type="button"
          className={`bw-bottom-nav-item ${activeKey === 'profile' ? 'is-active' : ''}`}
          onClick={() => {
            if (isGuest) {
              onRequireLogin?.();
              return;
            }
            handleClick('/profile');
          }}
          aria-label={t('profile.title')}
        >
          <span className="bw-bottom-nav-avatar">
            {isGuest ? (
              <span className="bw-bottom-nav-icon">
                <PersonOutline />
              </span>
            ) : (
              <Avatar
                url={avatarUrl}
                initial={initial}
                frameKey={avatarFrame}
                alt="Mi perfil"
                className="bw-bottom-nav-avatar-core"
              />
            )}
          </span>
          <span className="bw-bottom-nav-label">
            {isGuest ? t('common.guest', { defaultValue: 'Guest' }) : t('common.profile', { defaultValue: 'Profile' })}
          </span>
        </button>
      </div>
    </nav>
  );
}
