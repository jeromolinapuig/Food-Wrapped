import { useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { TopMenu } from './TopMenu';

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
  onNavigate: (page: 'dashboard' | 'feed' | 'profile') => void;
};

export function ProfilePage({ session, theme, onToggleTheme, onNavigate }: ProfilePageProps) {
  const username = (session.user.user_metadata as { username?: string } | null)?.username;
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [bioInput, setBioInput] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
  }, [session.user.id]);

  const currentAvatar = useMemo(() => avatarPreview ?? profile?.avatar_url ?? null, [avatarPreview, profile?.avatar_url]);

  const handleFileChange = (file: File | null) => {
    setAvatarFile(file);
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setAvatarPreview(previewUrl);
    } else {
      setAvatarPreview(profile?.avatar_url ?? null);
    }
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

      let avatarUrl = profile?.avatar_url ?? null;

      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `${session.user.id}/${Date.now()}.${fileExt ?? 'jpg'}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        avatarUrl = publicData.publicUrl;
      }

      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({
          username: usernameInput.trim(),
          display_name: usernameInput.trim(),
          bio: bioInput.trim(),
          avatar_url: avatarUrl,
        })
        .eq('id', session.user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setProfile(data as ProfileData);
      setAvatarFile(null);
      setAvatarPreview(data?.avatar_url ?? null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo guardar el perfil.';
      setError(msg);
    } finally {
      setSaving(false);
    }
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
            <p className="bw-subtitle">
              {username ?? session.user.email}
            </p>
          </div>

          <TopMenu theme={theme} onToggleTheme={onToggleTheme} onNavigate={onNavigate} />
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
                <h3 className="bw-profile-name">
                  {profile?.username ?? username ?? 'Mi perfil'}
                </h3>
                <p className="bw-profile-username">@{profile?.username ?? username ?? 'usuario'}</p>
                <p className="bw-profile-email">{session.user.email}</p>
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
                />
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
                  disabled={saving}
                >
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
