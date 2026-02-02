import { DynamicFeed, EmojiEvents, Groups, Home, PersonOutline } from '@mui/icons-material';
import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState, startTransition } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useRevalidateOnFocus } from '../../utils/useRevalidateOnFocus';
import './BottomNav.css';
import '../../styles/shared.css';
import { useTranslation } from 'react-i18next';

type BottomNavProps = {
  session: Session | null;
  onRequireLogin?: () => void;
};

export function BottomNav({ session, onRequireLogin }: Readonly<BottomNavProps>) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initial, setInitial] = useState<string>('?');
  const [inviteCount, setInviteCount] = useState(0);
  const isGuest = !session;
  const userId = session?.user.id ?? null;

  const activeKey = useMemo(() => {
    if (location.pathname.startsWith('/users')) {
      const state = location.state as { returnTo?: string } | null;
      const returnTo = state?.returnTo ?? '';
      if (returnTo.startsWith('/groups')) return 'groups';
      if (returnTo.startsWith('/feed')) return 'feed';
      if (returnTo.startsWith('/ranking')) return 'ranking';
      if (returnTo.startsWith('/profile')) return 'profile';
    }
    if (location.pathname === '/' || location.pathname.startsWith('/home')) return 'home';
    if (location.pathname.startsWith('/feed')) return 'feed';
    if (location.pathname.startsWith('/groups')) return 'groups';
    if (location.pathname.startsWith('/ranking')) return 'ranking';
    if (location.pathname.startsWith('/profile')) return 'profile';
    return 'home';
  }, [location.pathname]);

  const loadProfile = useCallback(async () => {
    if (!session) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('avatar_url, username, display_name')
      .eq('id', session.user.id)
      .single();

    if (error || !data) {
      setAvatarUrl(null);
      setInitial(session.user.email?.charAt(0).toUpperCase() ?? '?');
      return;
    }

    const profile = data as { avatar_url: string | null; username: string | null; display_name: string | null };
    const base = profile.username ?? profile.display_name ?? session.user.email ?? '?';
    setAvatarUrl(profile.avatar_url);
    setInitial(base.charAt(0).toUpperCase());
  }, [session]);

  useEffect(() => {
    startTransition(() => {
      void loadProfile();
    });
  }, [loadProfile]);

  const loadInvites = useCallback(async () => {
    if (!userId) return;
    const { count, error } = await supabase
      .from('group_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('invitee_id', userId);

    if (error) {
      setInviteCount(0);
      return;
    }

    setInviteCount(count ?? 0);
  }, [userId]);

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

  const handleClick = (path: string) => navigate(path);

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
      <button
        type="button"
        className={`bw-bottom-nav-item ${activeKey === 'ranking' ? 'is-active' : ''}`}
        onClick={() => handleClick('/ranking')}
        aria-label={t('common.ranking', { defaultValue: 'Ranking' })}
      >
        <span className="bw-bottom-nav-icon"><EmojiEvents /></span>
        <span className="bw-bottom-nav-label">{t('common.ranking', { defaultValue: 'Ranking' })}</span>
      </button>
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
          ) : avatarUrl ? (
            <img src={avatarUrl} alt="Mi perfil" />
          ) : (
            <span className="bw-bottom-nav-initial">{initial}</span>
          )}
        </span>
        <span className="bw-bottom-nav-label">
          {isGuest ? t('common.guest', { defaultValue: 'Guest' }) : t('common.profile', { defaultValue: 'Profile' })}
        </span>
      </button>
    </nav>
  );
}
