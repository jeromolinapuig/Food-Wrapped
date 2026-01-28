import { type FormEvent, useState } from 'react';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import Close from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useTranslation } from 'react-i18next';
import './AuthScreen.css';

export function AuthScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupNotice, setSignupNotice] = useState<string | null>(null);
  const [resetNotice, setResetNotice] = useState<string | null>(null);
  const hasUsernameWhitespace = (value: string) => /\s/.test(value);
  const isBusy = loading || oauthLoading;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetNotice(null);
    setLoading(true);

    try {
      setSignupNotice(null);
      if (mode === 'signup' && !username.trim()) {
        throw new Error(t('auth.usernameRequired'));
      }
      if (mode === 'signup' && hasUsernameWhitespace(username)) {
        throw new Error(t('auth.usernameNoSpaces'));
      }
      if (mode === 'signup') {
        const trimmedUsername = username.trim();
        const { data: existingUsers, error: existingError } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', trimmedUsername)
          .limit(1);
        if (existingError) throw existingError;
        if (existingUsers && existingUsers.length > 0) {
          throw new Error(t('auth.usernameExists'));
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: trimmedUsername,
              username_set: true,
            },
          },
        });
        if (error) {
          if (error.message?.toLowerCase().includes('already') || error.status === 400) {
            throw new Error(t('auth.emailExists'));
          }
          throw error;
        }
        if (data?.user?.identities && data.user.identities.length === 0) {
          throw new Error(t('auth.emailExists'));
        }
        setSignupNotice(t('auth.verifyEmail'));
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('auth.genericError');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError(null);
    setSignupNotice(null);
    setResetNotice(null);
    if (!email.trim()) {
      setError(t('auth.errorEmail'));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetNotice(t('auth.resetNotice'));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('auth.resetError');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setSignupNotice(null);
    setResetNotice(null);
    setOauthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/login`,
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('auth.resetError');
      setError(message);
      setOauthLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-blob auth-blob-1" />
      <div className="auth-blob auth-blob-2" />

      <div className="auth-card">
        <button
          type="button"
          className="auth-close"
          aria-label={t('common.close')}
          onClick={() => navigate('/')}
        >
          <Close fontSize="small" />
        </button>
        <div className="auth-brand">
          <div className="auth-logo">
            <img src="/logo.png" alt="Burger Wrapped" />
          </div>
          <div>
            <h1 className="auth-title">Burger Wrapped</h1>
            <h5 className="auth-subtitle">{t('auth.subtitle')}</h5>
          </div>
        </div>

        <div className="auth-toggle">
          <button
            type="button"
            className={mode === 'login' ? 'is-active' : ''}
            onClick={() => {
              setMode('login');
              setError(null);
              setSignupNotice(null);
              setResetNotice(null);
            }}
          >
            {t('auth.titleLogin')}
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'is-active' : ''}
            onClick={() => {
              setMode('signup');
              setError(null);
              setSignupNotice(null);
              setResetNotice(null);
            }}
          >
            {t('auth.titleSignup')}
          </button>
        </div>

        <div className="auth-oauth">
          <button
            type="button"
            className="auth-oauth-button"
            onClick={handleGoogleSignIn}
            disabled={isBusy}
          >
            <img src="/google.png" alt="" className="auth-oauth-icon" aria-hidden="true" />
            {oauthLoading ? t('auth.connecting') : t('auth.continueWithGoogle')}
          </button>
        </div>
        <div className="auth-divider">
          <span>{t('auth.or')}</span>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <label className="auth-field">
              <span>{t('auth.usernameLabel')}</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('auth.usernamePlaceholder')}
                required={mode === 'signup'}
              />
            </label>
          )}

          <label className="auth-field">
            <span>{t('common.email')}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholder')}
              required
            />
          </label>

          <label className="auth-field">
            <span>{t('auth.passwordLabel')}</span>
            <div className="auth-password">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.passwordPlaceholder')}
                required
              />
              <button
                type="button"
                className="auth-eye"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
              </button>
            </div>
            {mode === 'login' && (
              <button
                type="button"
                className="auth-forgot"
                onClick={handleResetPassword}
                disabled={loading}
              >
                {t('auth.forgotPassword')}
              </button>
            )}
          </label>

          {error && <p className="auth-error">{error}</p>}
          {signupNotice && <p className="auth-notice">{signupNotice}</p>}
          {resetNotice && <p className="auth-notice">{resetNotice}</p>}

          <button className="auth-submit" type="submit" disabled={isBusy}>
            {loading ? t('common.loading') : mode === 'login' ? t('auth.titleLogin') : t('auth.signupCta')}
          </button>
        </form>

        <p className="auth-secondary">
          {mode === 'login' ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
          <button
            type="button"
            className="auth-link"
            onClick={() => {
              setMode((prev) => (prev === 'login' ? 'signup' : 'login'));
              setError(null);
              setSignupNotice(null);
              setResetNotice(null);
            }}
          >
            {mode === 'login' ? t('auth.switchToSignup') : t('auth.switchToLogin')}
          </button>
        </p>
      </div>
    </div>
  );
}





