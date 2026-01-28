import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useTranslation } from 'react-i18next';
import './AuthScreen.css';

type ProfileRow = { username: string | null; display_name: string | null };

export function UsernameSetupScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const hasUsernameWhitespace = (value: string) => /\s/.test(value);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) {
        navigate('/login', { replace: true });
        return;
      }
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('username, display_name')
        .eq('id', session.user.id)
        .single();
      if (!mounted) return;
      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }
      const current = profile as ProfileRow | null;
      const profileUsername = current?.username ?? null;
      setUsername(profileUsername ?? current?.display_name ?? '');
      setLoading(false);
    };
    load();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setError(t('auth.usernameRequired'));
      return;
    }
    if (hasUsernameWhitespace(trimmedUsername)) {
      setError(t('auth.usernameNoSpaces'));
      return;
    }
    setSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) {
        navigate('/login', { replace: true });
        return;
      }
      const { data: existingUsers, error: existingError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', trimmedUsername)
        .limit(1);
      if (existingError) throw existingError;
      if (existingUsers && existingUsers.length > 0) {
        throw new Error(t('auth.usernameExists', { defaultValue: 'Username already in use.' }));
      }
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ username: trimmedUsername, display_name: trimmedUsername })
        .eq('id', session.user.id);
      if (profileError) throw profileError;
      const { error: userError } = await supabase.auth.updateUser({
        data: { username: trimmedUsername, username_set: true },
      });
      if (userError) throw userError;
      setNotice(t('auth.usernameSuccess', { defaultValue: 'All set. You can enter now.' }));
      setTimeout(() => navigate('/', { replace: true }), 900);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('auth.genericError');
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-blob auth-blob-1" />
        <div className="auth-blob auth-blob-2" />
        <div className="auth-card">
          <p className="auth-subtitle">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-blob auth-blob-1" />
      <div className="auth-blob auth-blob-2" />

      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">
            <img src="/logo.png" alt="Burger Wrapped" />
          </div>
          <div>
            <h1 className="auth-title">{t('auth.usernameTitle', { defaultValue: 'Choose your username' })}</h1>
            <h5 className="auth-subtitle">{t('auth.usernameSubtitle', { defaultValue: 'This name will show on your profile.' })}</h5>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>{t('auth.usernameLabel')}</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('auth.usernamePlaceholder')}
              required
            />
          </label>

          {error && <p className="auth-error">{error}</p>}
          {notice && <p className="auth-notice">{notice}</p>}

          <button className="auth-submit" type="submit" disabled={saving}>
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </form>
      </div>
    </div>
  );
}
