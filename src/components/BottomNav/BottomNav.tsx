import { DynamicFeed, EmojiEvents, Groups, Home, LocalDining, MoreHoriz, PersonOutline, Store } from '@mui/icons-material';
import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState, startTransition } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  const [inviteCount, setInviteCount] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const isGuest = !session;
  const userId = session?.user.id ?? null;

  const activeKey = useMemo(() => {
    if (adminModeEnabled && isAdmin) {
      if (location.pathname.startsWith('/admin/users')) return 'admin-users';
      if (location.pathname.startsWith('/admin/reports')) return 'admin-reports';
      if (location.pathname.startsWith('/profile')) return 'profile';
      return 'admin-feed';
    }
    if (location.pathname.startsWith('/users')) {
      const state = location.state as { returnTo?: string } | null;
      const returnTo = state?.returnTo ?? '';
      if (returnTo.startsWith('/groups')) return 'groups';
      if (returnTo.startsWith('/feed')) return 'feed';
      if (returnTo.startsWith('/ranking')) return 'more';
      if (returnTo.startsWith('/restaurants')) return 'more';
      if (returnTo.startsWith('/my-top-burgers')) return 'more';
      if (returnTo.startsWith('/profile')) return 'profile';
    }
    if (location.pathname === '/' || location.pathname.startsWith('/home')) return 'home';
    if (location.pathname.startsWith('/feed')) return 'feed';
    if (location.pathname.startsWith('/groups')) return 'groups';
    if (location.pathname.startsWith('/ranking')) return 'more';
    if (location.pathname.startsWith('/restaurants')) return 'more';
    if (location.pathname.startsWith('/my-top-burgers')) return 'more';
    if (location.pathname.startsWith('/profile')) return 'profile';
    return 'home';
  }, [adminModeEnabled, isAdmin, location.pathname]);

  const loadProfile = useCallback(async () => {
    if (!session || (adminModeEnabled && isAdmin)) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('avatar_url, equipped_frame, username, display_name')
      .eq('id', session.user.id)
      .single();

    if (error || !data) {
      setAvatarUrl(null);
      setAvatarFrame(null);
      setInitial(session.user.email?.charAt(0).toUpperCase() ?? '?');
      return;
    }

    const profile = data as {
      avatar_url: string | null;
      equipped_frame: 'gold' | 'silver' | 'bronze' | null;
      username: string | null;
      display_name: string | null;
    };
    const base = profile.username ?? profile.display_name ?? session.user.email ?? '?';
    setAvatarUrl(profile.avatar_url);
    setAvatarFrame(profile.equipped_frame ?? null);
    setInitial(base.charAt(0).toUpperCase());
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
    window.addEventListener('bw-avatar-frame-updated', handleFrameUpdated);
    return () => {
      window.removeEventListener('bw-avatar-frame-updated', handleFrameUpdated);
    };
  }, [userId]);

  const loadInvites = useCallback(async () => {
    if (!userId || (adminModeEnabled && isAdmin)) return;
    const { count, error } = await supabase
      .from('group_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('invitee_id', userId);

    if (error) {
      setInviteCount(0);
      return;
    }

    setInviteCount(count ?? 0);
  }, [adminModeEnabled, isAdmin, userId]);

  useEffect(() => {
    startTransition(() => {
      void loadInvites();
    });

    const handleInvitesUpdated = () => loadInvites();
    window.addEventListener('bw-invites-updated', handleInvitesUpdated);

    return () => {
      window.removeEventListener('bw-invites-updated', handleInvitesUpdated);
    };
  }, [loadInvites, location.pathname]);

  useRevalidateOnFocus(
    () => {
      loadProfile();
      loadInvites();
    },
    [loadInvites, loadProfile],
    { minIntervalMs: 300000, maxStaleMs: 1200000, debounceMs: 500 }
  );

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  const handleClick = (path: string) => {
    setMoreOpen(false);
    navigate(path);
  };

  useEffect(() => {
    if (adminModeEnabled && isAdmin) return;
    if (!moreOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [adminModeEnabled, isAdmin, moreOpen]);

  if (adminModeEnabled && isAdmin) {
    return (
      <nav className="bw-bottom-nav" aria-label={t('common.navigation', { defaultValue: 'Navigation' })}>
        <button
          type="button"
          className={`bw-bottom-nav-item ${activeKey === 'admin-feed' ? 'is-active' : ''}`}
          onClick={() => navigate('/admin/feed')}
          aria-label="Admin Feed"
        >
          <span className="bw-bottom-nav-icon"><DynamicFeed /></span>
          <span className="bw-bottom-nav-label">Feed</span>
        </button>
        <button
          type="button"
          className={`bw-bottom-nav-item ${activeKey === 'admin-users' ? 'is-active' : ''}`}
          onClick={() => navigate('/admin/users')}
          aria-label="Admin Usuarios"
        >
          <span className="bw-bottom-nav-icon"><Groups /></span>
          <span className="bw-bottom-nav-label">Usuarios</span>
        </button>
        <button
          type="button"
          className={`bw-bottom-nav-item ${activeKey === 'admin-reports' ? 'is-active' : ''}`}
          onClick={() => navigate('/admin/reports')}
          aria-label="Admin Reportes"
        >
          <span className="bw-bottom-nav-icon"><EmojiEvents /></span>
          <span className="bw-bottom-nav-label">Reportes</span>
        </button>
        <button
          type="button"
          className={`bw-bottom-nav-item ${activeKey === 'profile' ? 'is-active' : ''}`}
          onClick={() => navigate('/profile')}
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

  return (
    <nav className="bw-bottom-nav" aria-label={t('common.navigation', { defaultValue: 'Navigation' })}>
      <button
        type="button"
        className={`bw-bottom-nav-item ${activeKey === 'home' ? 'is-active' : ''}`}
        onClick={() => navigate('/')}
        aria-label={t('common.home', { defaultValue: 'Home' })}
      >
        <span className="bw-bottom-nav-icon"><Home /></span>
        <span className="bw-bottom-nav-label">{t('common.home', { defaultValue: 'Home' })}</span>
      </button>
      <button
        type="button"
        className={`bw-bottom-nav-item ${activeKey === 'feed' ? 'is-active' : ''}`}
        onClick={() => navigate('/feed')}
        aria-label="Feed"
      >
        <span className="bw-bottom-nav-icon"><DynamicFeed /></span>
        <span className="bw-bottom-nav-label">Feed</span>
      </button>
      <button
        type="button"
        className={`bw-bottom-nav-item ${activeKey === 'groups' ? 'is-active' : ''}`}
        onClick={() => handleClick('/groups')}
        aria-label={t('common.groups', { defaultValue: 'Groups' })}
      >
        <span className="bw-bottom-nav-icon">
          <Groups />
          {inviteCount > 0 && <span className="bw-bottom-nav-dot" />}
        </span>
        <span className="bw-bottom-nav-label">{t('common.groups', { defaultValue: 'Groups' })}</span>
      </button>
      <div className={`bw-bottom-nav-more ${activeKey === 'more' ? 'is-active' : ''}`}>
        <button
          type="button"
          className={`bw-bottom-nav-item ${activeKey === 'more' ? 'is-active' : ''}`}
          onClick={() => setMoreOpen((prev) => !prev)}
          aria-label={t('common.more', { defaultValue: 'More' })}
          aria-haspopup="menu"
          aria-expanded={moreOpen}
        >
          <span className="bw-bottom-nav-icon"><MoreHoriz /></span>
          <span className="bw-bottom-nav-label">{t('common.more', { defaultValue: 'More' })}</span>
        </button>
        {moreOpen && (
          <>
            <button
              type="button"
              className="bw-bottom-nav-menu-backdrop"
              onClick={() => setMoreOpen(false)}
              aria-label={t('common.close', { defaultValue: 'Close' })}
            />
            <div className="bw-bottom-nav-menu" role="menu">
              <button
                type="button"
                className="bw-bottom-nav-menu-item"
                role="menuitem"
                onClick={() => handleClick('/ranking')}
              >
                <span className="bw-bottom-nav-menu-icon"><EmojiEvents fontSize="small" /></span>
                <span className="bw-bottom-nav-menu-label">
                  {t('common.ranking', { defaultValue: 'Ranking' })}
                </span>
              </button>
              <button
                type="button"
                className="bw-bottom-nav-menu-item"
                role="menuitem"
                onClick={() => handleClick('/restaurants')}
              >
                <span className="bw-bottom-nav-menu-icon"><Store fontSize="small" /></span>
                <span className="bw-bottom-nav-menu-label">
                  {t('common.restaurants', { defaultValue: 'Restaurants' })}
                </span>
              </button>
              <button
                type="button"
                className="bw-bottom-nav-menu-item"
                role="menuitem"
                onClick={() => handleClick('/my-top-burgers')}
              >
                <span className="bw-bottom-nav-menu-icon"><LocalDining fontSize="small" /></span>
                <span className="bw-bottom-nav-menu-label">
                  {t('myTopBurgers.title', { defaultValue: 'Mi top burgers' })}
                </span>
              </button>
            </div>
          </>
        )}
      </div>
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
    </nav>
  );
}
