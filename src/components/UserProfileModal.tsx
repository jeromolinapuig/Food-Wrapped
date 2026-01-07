import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { CheckCircleOutline, Close, GroupAdd } from '@mui/icons-material';
import { supabase } from '../lib/supabaseClient';

type UserProfileModalProps = {
  open: boolean;
  userId: string | null;
  session: Session;
  onClose: () => void;
  onFollowChange?: (userId: string, isFollowing: boolean) => void;
  onViewPosts?: (user: { id: string; username: string | null; displayName: string | null }) => void;
};

type PublicProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

export function UserProfileModal({ open, userId, session, onClose, onFollowChange, onViewPosts }: Readonly<UserProfileModalProps>) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isIncoming, setIsIncoming] = useState(false);
  const [followId, setFollowId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const shouldShow = open && Boolean(userId);

  useEffect(() => {
    if (!shouldShow || !userId) return;
    if (userId === session.user.id) {
      onClose();
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);

      const [{ data: profileData, error: profileError }, { data: followData, error: followError }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, bio')
          .eq('id', userId)
          .single(),
        supabase
          .from('follows')
          .select('id, follower_id, following_id')
          .or(`and(follower_id.eq.${session.user.id},following_id.eq.${userId}),and(follower_id.eq.${userId},following_id.eq.${session.user.id})`),
      ]);

      if (cancelled) return;

      if (profileError) {
        setError(profileError.message);
        setProfile(null);
        setLoading(false);
        return;
      }

      setProfile(profileData as PublicProfile);

      if (followError) {
        console.error('Error loading follow state', followError);
        setIsFollowing(false);
        setFollowId(null);
        setIsIncoming(false);
      } else {
        let outgoingId: number | null = null;
        let incoming = false;
        (followData ?? []).forEach((row) => {
          const r = row as { id: number; follower_id: string; following_id: string };
          if (r.follower_id === session.user.id && r.following_id === userId) {
            outgoingId = r.id;
          }
          if (r.follower_id === userId && r.following_id === session.user.id) {
            incoming = true;
          }
        });
        setIsFollowing(Boolean(outgoingId));
        setFollowId(outgoingId);
        setIsIncoming(incoming);
      }

      setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [shouldShow, userId, session.user.id, onClose]);

  const handleToggleFollow = async () => {
    if (!userId || saving) return;
    const currentUserId = session.user.id;

    if (isFollowing) {
      if (!followId) return;
      setSaving(true);
      const { error: deleteError } = await supabase.from('follows').delete().eq('id', followId);
      if (deleteError) {
        console.error('Error al dejar de seguir', deleteError);
      } else {
        setIsFollowing(false);
        setFollowId(null);
        onFollowChange?.(userId, false);
      }
      setSaving(false);
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from('follows')
      .insert({ follower_id: currentUserId, following_id: userId })
      .select('id')
      .single();
    if (error || !data) {
      console.error('Error al seguir', error);
    } else {
      setIsFollowing(true);
      setFollowId((data as { id: number }).id);
      onFollowChange?.(userId, true);
    }
    setSaving(false);
  };

  if (!shouldShow) return null;

  const displayName = profile?.display_name || profile?.username || 'Usuario';
  const handleText = isFollowing && isIncoming ? 'Os seguís mutuamente' : isIncoming ? 'Te sigue' : '';

  const handleViewPosts = () => {
    if (!profile) return;
    onViewPosts?.({
      id: profile.id,
      username: profile.username,
      displayName: profile.display_name,
    });
  };

  return (
    <div className="bw-modal-backdrop" onClick={onClose}>
      <div className="bw-modal bw-user-profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bw-modal-header" style={{ justifyContent: 'space-between' }}>
          <div className="bw-modal-title" style={{ margin: 0 }}>Perfil</div>
          <button type="button" className="bw-icon-button" onClick={onClose} aria-label="Cerrar">
            <Close fontSize="small" />
          </button>
        </div>

        {loading && <p style={{ fontSize: 13 }}>Cargando perfil...</p>}
        {error && <p style={{ color: 'red', fontSize: 12 }}>{error}</p>}

        {!loading && profile && (
          <div className="bw-profile-form" style={{ gap: 14 }}>
            <div className="bw-profile-header" style={{ marginBottom: 4 }}>
              <div className="bw-avatar bw-avatar-lg">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={displayName} className="bw-avatar-image" />
                ) : (
                  <div className="bw-avatar-placeholder">{(profile.username ?? '?').charAt(0).toUpperCase()}</div>
                )}
              </div>
              <div className="bw-profile-header-body">
                <h1 className="bw-profile-username" style={{ margin: 0, fontSize: 22 }}>
                  @{profile.username ?? 'usuario'}
                </h1>
                <div className="bw-profile-subline">
                  {handleText && <p className="bw-profile-email" style={{ margin: 0 }}>{handleText}</p>}
                  <button
                    type="button"
                    className="bw-link-button bw-link-inline"
                    onClick={handleViewPosts}
                  >
                    Ver sus posts
                  </button>
                </div>
              </div>
            </div>

            <div className="bw-field">
              <label className="bw-label">Bio</label>
              <div className="bw-textarea" style={{ opacity: 0.8, minHeight: 90 }}>
                {profile.bio || 'Sin bio todavía.'}
              </div>
            </div>

            <div className="bw-profile-actions" style={{ justifyContent: 'center', gap: 6, flexDirection: 'column', alignItems: 'center' }}>
              <button
                type="button"
                className={`bw-btn bw-btn-primary ${isFollowing ? 'bw-btn-muted' : ''}`}
                onClick={handleToggleFollow}
                disabled={saving}
              >
                {isFollowing ? (
                  <>
                    <CheckCircleOutline fontSize="small" />
                    Dejar de seguir
                  </>
                ) : (
                  <>
                    <GroupAdd fontSize="small" />
                    Seguir
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
