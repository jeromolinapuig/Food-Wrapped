import { DynamicFeed, Groups, Home } from '@mui/icons-material';
import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState, startTransition } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useRevalidateOnFocus } from '../../utils/useRevalidateOnFocus';
import './BottomNav.css';
import '../../styles/shared.css';

type BottomNavProps = {
  session: Session;
};

export function BottomNav({ session }: Readonly<BottomNavProps>) {
  const navigate = useNavigate();
  const location = useLocation();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initial, setInitial] = useState<string>('?');
  const [inviteCount, setInviteCount] = useState(0);

  const activeKey = useMemo(() => {
    if (location.pathname.startsWith('/feed')) return 'feed';
    if (location.pathname.startsWith('/groups')) return 'groups';
    if (location.pathname.startsWith('/profile')) return 'profile';
    return 'home';
  }, [location.pathname]);

  const loadProfile = useCallback(async () => {
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
  }, [session.user.email, session.user.id]);

  useEffect(() => {
    startTransition(() => {
      void loadProfile();
    });
  }, [loadProfile]);

  const loadInvites = useCallback(async () => {
    const { count, error } = await supabase
      .from('group_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('invitee_id', session.user.id);

    if (error) {
      setInviteCount(0);
      return;
    }

    setInviteCount(count ?? 0);
  }, [session.user.id]);

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

  return (
    <nav className="bw-bottom-nav" aria-label="Navegacion principal">
      <button
        type="button"
        className={`bw-bottom-nav-item ${activeKey === 'home' ? 'is-active' : ''}`}
        onClick={() => navigate('/')}
        aria-label="Inicio"
      >
        <span className="bw-bottom-nav-icon"><Home /></span>
        <span className="bw-bottom-nav-label">Inicio</span>
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
        onClick={() => navigate('/groups')}
        aria-label="Grupos"
      >
        <span className="bw-bottom-nav-icon">
          <Groups />
          {inviteCount > 0 && <span className="bw-bottom-nav-dot" />}
        </span>
        <span className="bw-bottom-nav-label">Grupos</span>
      </button>
      <button
        type="button"
        className={`bw-bottom-nav-item ${activeKey === 'profile' ? 'is-active' : ''}`}
        onClick={() => navigate('/profile')}
        aria-label="Mi perfil"
      >
        <span className="bw-bottom-nav-avatar">
          {avatarUrl ? <img src={avatarUrl} alt="Mi perfil" /> : <span>{initial}</span>}
        </span>
        <span className="bw-bottom-nav-label"></span>
      </button>
    </nav>
  );
}
