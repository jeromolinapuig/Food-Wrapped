import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { CheckCircleOutline, Close, GroupAdd } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabaseClient';
import { lockBodyScroll } from '../../utils/scrollLock';
import { ModalBase } from '../common/ModalBase';
import { Avatar } from '../common/Avatar';
import {
  type BurgerBreadPreference,
  type BurgerDonenessPreference,
  type BurgerSaucePreference,
  type BurgerTypePreference,
  isBurgerBreadPreference,
  isBurgerDonenessPreference,
  isBurgerSaucePreference,
  isBurgerTypePreference,
} from '../../constants/burgerPreferences';
import '../../styles/shared.css';
import '../ProfilePage/ProfilePage.css';
import './UserProfileModal.css';

type UserProfileModalProps = {
  open: boolean;
  userId: string | null;
  session: Session | null;
  onClose: () => void;
  onFollowChange?: (userId: string, isFollowing: boolean) => void;
  onViewPosts?: (user: { id: string; username: string | null; displayName: string | null }) => void;
  onRequireLogin?: () => void;
};

type PublicProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  equipped_frame?: 'gold' | 'silver' | 'bronze' | null;
  bio: string | null;
  is_private?: boolean | null;
  favorite_burger_type?: BurgerTypePreference | null;
  favorite_sauce?: BurgerSaucePreference | null;
  favorite_doneness?: BurgerDonenessPreference | null;
  favorite_bread?: BurgerBreadPreference | null;
};

const PUBLIC_PROFILE_SELECT =
  'id, username, display_name, avatar_url, equipped_frame, bio, is_private, favorite_burger_type, favorite_sauce, favorite_doneness, favorite_bread';
const PUBLIC_PROFILE_FALLBACK_SELECT = 'id, username, display_name, avatar_url, equipped_frame, bio, is_private';

async function fetchPublicProfile(userId: string) {
  const response = await supabase
    .from('profiles')
    .select(PUBLIC_PROFILE_SELECT)
    .eq('id', userId)
    .single();

  if (response.error && (response.error as { code?: string }).code === '42703') {
    return supabase
      .from('profiles')
      .select(PUBLIC_PROFILE_FALLBACK_SELECT)
      .eq('id', userId)
      .single();
  }

  return response;
}

export function UserProfileModal({
  open,
  userId,
  session,
  onClose,
  onFollowChange,
  onViewPosts,
  onRequireLogin,
}: Readonly<UserProfileModalProps>) {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isIncoming, setIsIncoming] = useState(false);
  const [followId, setFollowId] = useState<number | null>(null);
  const [isMutual, setIsMutual] = useState(false);
  const [saving, setSaving] = useState(false);
  const shouldShow = open && Boolean(userId);

  useEffect(() => {
    if (!shouldShow) return;
    return lockBodyScroll();
  }, [shouldShow]);

  useEffect(() => {
    if (!shouldShow || !userId) return;
    if (!session) {
      let cancelled = false;
      const loadProfile = async () => {
        setLoading(true);
        setError(null);
        const { data, error } = await fetchPublicProfile(userId);
        if (cancelled) return;
        if (error) {
          setError(error.message);
          setProfile(null);
        } else {
          setProfile(data as PublicProfile);
        }
        setLoading(false);
      };
      loadProfile();
      return () => {
        cancelled = true;
      };
    }
    if (userId === session.user.id) {
      onClose();
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);

      const [{ data: profileData, error: profileError }, { data: followData, error: followError }] = await Promise.all([
        fetchPublicProfile(userId),
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
        setIsMutual(Boolean(outgoingId && incoming));
      }

      setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [shouldShow, userId, session?.user.id, onClose, session]);

  const handleToggleFollow = async () => {
    if (!userId || saving) return;
    if (!session) {
      onRequireLogin?.();
      return;
    }
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
  const handleText = isFollowing && isIncoming ? t('userProfileModal.mutual') : isIncoming ? t('userProfileModal.followsYou') : '';
  const isPrivateBlocked = Boolean(profile?.is_private) && !isMutual;
  const favoriteBurgerType = isBurgerTypePreference(profile?.favorite_burger_type)
    ? profile.favorite_burger_type
    : null;
  const favoriteSauce = isBurgerSaucePreference(profile?.favorite_sauce) ? profile.favorite_sauce : null;
  const favoriteDoneness = isBurgerDonenessPreference(profile?.favorite_doneness)
    ? profile.favorite_doneness
    : null;
  const favoriteBread = isBurgerBreadPreference(profile?.favorite_bread) ? profile.favorite_bread : null;
  const burgerPreferenceChips = [
    favoriteBurgerType ? t(`profile.burgerPreferences.types.${favoriteBurgerType}`) : null,
    favoriteSauce ? t(`profile.burgerPreferences.sauces.${favoriteSauce}`) : null,
    favoriteDoneness ? t(`profile.burgerPreferences.doneness.${favoriteDoneness}`) : null,
    favoriteBread ? t(`profile.burgerPreferences.breads.${favoriteBread}`) : null,
  ].filter(Boolean) as string[];

  const handleViewPosts = () => {
    if (!profile) return;
    if (isPrivateBlocked) return;
    onViewPosts?.({
      id: profile.id,
      username: profile.username,
      displayName: profile.display_name,
    });
  };

  return (
    <ModalBase onClose={onClose} modalClassName="bw-modal bw-user-profile-modal">
        <div className="bw-modal-header" style={{ justifyContent: 'space-between' }}>
          <div className="bw-modal-title" style={{ margin: 0 }}>{t('userProfileModal.title')}</div>
          <button type="button" className="bw-icon-button" onClick={onClose} aria-label={t('common.close')}>
            <Close fontSize="small" />
          </button>
        </div>

        {loading && <p style={{ fontSize: 13 }}>{t('userProfileModal.loadingProfile')}</p>}
        {error && <p style={{ color: 'red', fontSize: 12 }}>{error}</p>}

        {!loading && profile && (
          <div className="bw-profile-form" style={{ gap: 14 }}>
            <div className="bw-profile-header" style={{ marginBottom: 4 }}>
              <Avatar
                url={profile.avatar_url}
                frameKey={profile.equipped_frame ?? null}
                alt={displayName}
                initial={(profile.username ?? '?').charAt(0).toUpperCase()}
                size="lg"
              />
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
                    disabled={isPrivateBlocked}
                  >
                    {isPrivateBlocked ? t('userProfileModal.privateProfile') : t('userProfileModal.viewStats')}
                  </button>
                </div>
              </div>
            </div>

            <div className="bw-field">
              <label className="bw-label">{t('userProfileModal.bioLabel')}</label>
              <div className="bw-textarea" style={{ opacity: 0.8, minHeight: 90 }}>
                {profile.bio || t('userProfileModal.noBio')}
              </div>
            </div>

            {burgerPreferenceChips.length ? (
              <div className="bw-field">
                <label className="bw-label">{t('userProfileModal.burgerPreferencesLabel')}</label>
                <div className="bw-user-profile-preferences">
                  {burgerPreferenceChips.map((chip) => (
                    <span key={chip} className="bw-user-profile-chip">
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="bw-profile-actions" style={{ justifyContent: 'center', gap: 6, flexDirection: 'column', alignItems: 'center' }}>
              {session ? (
                <button
                  type="button"
                  className={`bw-btn bw-btn-primary ${isFollowing ? 'bw-btn-muted' : ''}`}
                  onClick={handleToggleFollow}
                  disabled={saving}
                >
                  {isFollowing ? (
                    <>
                      <CheckCircleOutline fontSize="small" />
                      {t('userProfileModal.unfollow')}
                    </>
                  ) : (
                    <>
                      <GroupAdd fontSize="small" />
                      {t('userProfileModal.follow')}
                    </>
                  )}
                </button>
              ) : (
                <p className="bw-helper" style={{ margin: 0, textAlign: 'center' }}>
                  {t('userProfileModal.loginToFollow')}
                </p>
              )}
            </div>
          </div>
        )}
      </ModalBase>
  );
}
