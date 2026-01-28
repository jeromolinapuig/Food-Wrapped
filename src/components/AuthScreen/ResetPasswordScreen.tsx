import { type FormEvent, useEffect, useState } from 'react';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import Close from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useTranslation } from 'react-i18next';
import './AuthScreen.css';

export function ResetPasswordScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setHasSession(Boolean(data.session));
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session));
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!password || password.length < 6) {
      setError(t('resetPassword.errorLength'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('resetPassword.errorMatch'));
      return;
    }
    if (hasSession === false) {
      setError(t('resetPassword.linkExpired', { defaultValue: t('resetPassword.genericError') }));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setNotice(t('resetPassword.success'));
      await supabase.auth.signOut();
      setTimeout(() => navigate('/login'), 1200);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('resetPassword.genericError');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-blob auth-blob-1" />
      <div className="auth-blob auth-blob-2" />

      <div className="auth-card">
        <button type="button" className="auth-close" aria-label={t('common.close')} onClick={() => navigate('/')}>
          <Close fontSize="small" />
        </button>
        <div className="auth-brand">
          <div className="auth-logo">
            <img src="/logo.png" alt="Burger Wrapped" />
          </div>
          <div>
            <h1 className="auth-title">{t('resetPassword.title')}</h1>
            <h5 className="auth-subtitle">{t('resetPassword.subtitle')}</h5>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>{t('resetPassword.newPassword')}</span>
            <div className="auth-password">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('resetPassword.newPasswordPlaceholder', { defaultValue: 'Minimum 6 characters' })}
                required
              />
              <button
                type="button"
                className="auth-eye"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? t('resetPassword.hidePassword') : t('resetPassword.showPassword')}
              >
                {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
              </button>
            </div>
          </label>

          <label className="auth-field">
            <span>{t('resetPassword.repeatPassword')}</span>
            <div className="auth-password">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('resetPassword.repeatPlaceholder')}
                required
              />
              <button
                type="button"
                className="auth-eye"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={showConfirmPassword ? t('resetPassword.hidePassword') : t('resetPassword.showPassword')}
              >
                {showConfirmPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
              </button>
            </div>
          </label>

          {hasSession === false && (
            <p className="auth-error"></p>
          )}
          {error && <p className="auth-error">{error}</p>}
          {notice && <p className="auth-notice">{notice}</p>}

          <button className="auth-submit" type="submit" disabled={loading || hasSession === false}>
            {loading ? t('common.loading') : t('resetPassword.save')}
          </button>
        </form>

        <p className="auth-secondary">
          <button type="button" className="auth-link" onClick={() => navigate('/login')}>
            {t('auth.switchToLogin')}
          </button>
        </p>
      </div>
    </div>
  );
}



