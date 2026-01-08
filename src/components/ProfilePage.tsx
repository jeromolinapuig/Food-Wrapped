import { useEffect, useMemo, useRef, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { TopMenu } from './TopMenu';
import { FollowListModal, type FollowListMode } from './FollowListModal';
import { cropImageFile } from '../utils/cropImage';
import '../styles/layout.css';
import '../styles/shared.css';
import '../styles/profile.css';

type ProfileData = {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

type ProfilePageProps = {
  session: Session;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onNavigate: (page: 'dashboard' | 'feed' | 'profile' | 'groups') => void;
  onOpenUserDashboard: (user: { id: string; username: string | null; displayName: string | null }) => void;
};

const compressImage = async (file: File, maxDimension = 800, quality = 0.8): Promise<File> => {
  if (!file.type.startsWith('image/')) return file;
  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error('No se pudo generar la imagen comprimida.'));
        },
        'image/jpeg',
        quality
      );
    });

    const name = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return file;
  }
};

export function ProfilePage({ session, theme, onToggleTheme, onNavigate, onOpenUserDashboard }: Readonly<ProfilePageProps>) {
  const username = (session.user.user_metadata as { username?: string } | null)?.username;
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [bioInput, setBioInput] = useState('');
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

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('profiles')
        .select('username, display_name, avatar_url, bio')
        .eq('id', session.user.id)
        .single();

      if (error) {
        setError(error.message);
        setProfile(null);
      } else {
        setProfile(data as ProfileData);
        setUsernameInput(data?.username ?? username ?? '');
        setBioInput(data?.bio ?? '');
        setAvatarPreview(data?.avatar_url ?? null);
      }
      setLoading(false);
    };

    loadProfile();
  }, [session.user.id, username]);

  useEffect(() => {
    const loadFollowCounts = async () => {
      const [{ count: followersCount, error: followersError }, { count: followingCount, error: followingError }] = await Promise.all([
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', session.user.id),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', session.user.id),
      ]);

      if (followersError) {
        console.error('Error cargando seguidores', followersError);
      } else if (typeof followersCount === 'number') {
        setFollowCounts((prev) => ({ ...prev, followers: followersCount }));
      }

      if (followingError) {
        console.error('Error cargando seguidos', followingError);
      } else if (typeof followingCount === 'number') {
        setFollowCounts((prev) => ({ ...prev, following: followingCount }));
      }
    };

    loadFollowCounts();
  }, [session.user.id]);

  const currentAvatar = useMemo(() => avatarPreview ?? profile?.avatar_url ?? null, [avatarPreview, profile?.avatar_url]);
  const hasChanges = useMemo(() => {
    const usernameChanged = (usernameInput.trim() || '') !== (profile?.username ?? '');
    const bioChanged = (bioInput.trim() || '') !== (profile?.bio ?? '');
    return usernameChanged || bioChanged;
  }, [bioInput, profile?.bio, profile?.username, usernameInput]);

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
      const compressed = await compressImage(file);
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
    if (!usernameInput.trim()) {
      setError('El nombre de usuario no puede estar vacío.');
      return;
    }

      setSaving(true);
      setError(null);

      try {
        // Check username uniqueness
      const { data: existing, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', usernameInput.trim())
        .neq('id', session.user.id)
        .limit(1);

      if (userError) throw userError;
      if (existing && existing.length > 0) {
        setError('Ese nombre de usuario ya está en uso.');
        setSaving(false);
        return;
      }

      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({
          username: usernameInput.trim(),
          display_name: usernameInput.trim(),
          bio: bioInput.trim(),
        })
        .eq('id', session.user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setProfile(data as ProfileData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo guardar el perfil.';
      setError(msg);
    } finally {
      setSaving(false);
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

  const handleFollowingDelta = (delta: number) => {
    setFollowCounts((prev) => ({
      ...prev,
      following: Math.max(0, prev.following + delta),
    }));
  };

  const handleOpenUserFeed = (user: { id: string; username: string | null; displayName: string | null }) => {
    setFollowListMode(null);
    onOpenUserDashboard(user);
  };

  return (
    <div className="bw-app-root">
      <div className="bw-shell">
        <header className="bw-header">
          <div className="bw-header-icon">
            <img src="/logo.png" alt="Burger Wrapped" />
          </div>
          <div style={{ flex: 1 }}>
            <h1 className="bw-title">Mi perfil</h1>
          </div>

          <TopMenu theme={theme} onToggleTheme={onToggleTheme} />
        </header>

        <main className="bw-main">
          <section className="bw-card bw-profile-card">
            <div className="bw-profile-header">
              <div className="bw-avatar bw-avatar-lg">
                {currentAvatar ? (
                  <img
                    src={currentAvatar}
                    alt={profile?.username ?? username ?? session.user.email}
                    className="bw-avatar-image"
                    onClick={() => fileInputRef.current?.click()}
                  />
                ) : (
                  <div className="bw-avatar-placeholder" onClick={() => fileInputRef.current?.click()}>
                    {(profile?.username ?? username ?? session.user.email?.[0] ?? '?')
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <h1 className="bw-profile-username" style={{ margin: 0, fontSize: 22 }}>
                  @{profile?.username ?? username ?? 'usuario'}
                </h1>
                <p className="bw-profile-email">{session.user.email}</p>
                <div className="bw-follow-inline">
                  <button type="button" className="bw-follow-link" onClick={() => setFollowListMode('following')}>
                    {followCounts.following} Seguidos
                  </button>
                  <span className="bw-follow-separator">·</span>
                  <button type="button" className="bw-follow-link" onClick={() => setFollowListMode('followers')}>
                    {followCounts.followers} Seguidores
                  </button>
                </div>
              </div>
            </div>
            {loading && <p style={{ fontSize: 13 }}>Cargando perfil...</p>}
            {error && <p style={{ fontSize: 12, color: 'red' }}>{error}</p>}

            <div className="bw-profile-form">
              <div className="bw-field">
                <label className="bw-label" htmlFor="username">Nombre de usuario</label>
                <input
                  id="username"
                  className="bw-input"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="usuario"
                />
                <p className="bw-helper">Debe ser único. Este será tu nombre visible.</p>
              </div>

              <div className="bw-field">
                <label className="bw-label" htmlFor="bio">Bio</label>
                <textarea
                  id="bio"
                  className="bw-textarea"
                  value={bioInput}
                  onChange={(e) => setBioInput(e.target.value)}
                  placeholder="Cuenta algo sobre ti..."
                  rows={4}
                  style={{ resize: 'none' }}
                  maxLength={BIO_LIMIT}
                />
                <div className="bw-helper" style={{ textAlign: 'right', marginTop: 4 }}>
                  {bioInput.length}/{BIO_LIMIT}
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />

              <div className="bw-profile-actions">
                <button
                  type="button"
                  className="bw-btn bw-btn-primary"
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                >
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>

      {saving && (
        <div className="bw-loader-overlay">
          <div className="bw-loader-spinner" aria-label="Guardando..."></div>
        </div>
      )}

      <FollowListModal
        open={Boolean(followListMode)}
        mode={followListMode}
        currentUserId={session.user.id}
        onClose={() => setFollowListMode(null)}
        onFollowingDelta={handleFollowingDelta}
        onViewPosts={handleOpenUserFeed}
      />

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
                Cancelar
              </button>
              <button className="bw-btn bw-btn-primary" type="button" onClick={handleAvatarCropConfirm}>
                Recortar y guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

