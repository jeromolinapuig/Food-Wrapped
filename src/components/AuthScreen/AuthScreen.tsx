import { type FormEvent, useState } from 'react';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import Close from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import './AuthScreen.css';

export function AuthScreen() {
  const navigate = useNavigate();
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
        throw new Error('El nombre de usuario es obligatorio.');
      }
      if (mode === 'signup' && hasUsernameWhitespace(username)) {
        throw new Error('El nombre de usuario no puede tener espacios.');
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
          throw new Error('Ese nombre de usuario ya esta en uso.');
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
            throw new Error('Ya existe una cuenta con ese email.');
          }
          throw error;
        }
        if (data?.user?.identities && data.user.identities.length === 0) {
          throw new Error('Ya existe una cuenta con ese email.');
        }
        setSignupNotice('Revisa tu correo. Te hemos enviado un enlace para verificar la cuenta.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Algo ha ido mal';
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
      setError('Escribe tu email para recuperar la contraseña.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetNotice('Te enviamos un email con el enlace para crear una nueva contraseña.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo enviar el correo.';
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
      const message = err instanceof Error ? err.message : 'No se pudo iniciar con Google.';
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
          aria-label="Cerrar"
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
            <h5 className="auth-subtitle">Guarda tus sitios, notas y precios en un solo lugar.</h5>
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
            Entrar
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
            Crear cuenta
          </button>
        </div>

        <div className="auth-oauth">
          <button
            type="button"
            className="auth-oauth-button"
            onClick={handleGoogleSignIn}
            disabled={isBusy}
          >
            <span className="auth-oauth-icon" aria-hidden="true">G</span>
            {oauthLoading ? 'Conectando...' : 'Continuar con Google'}
          </button>
        </div>
        <div className="auth-divider">
          <span>o</span>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <label className="auth-field">
              <span>Nombre de usuario</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ej. burgerlover"
                required={mode === 'signup'}
              />
            </label>
          )}

          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
            />
          </label>

          <label className="auth-field">
            <span>Contraseña</span>
            <div className="auth-password">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                className="auth-eye"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
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
                He olvidado mi contraseña
              </button>
            )}
          </label>

          {error && <p className="auth-error">{error}</p>}
          {signupNotice && <p className="auth-notice">{signupNotice}</p>}
          {resetNotice && <p className="auth-notice">{resetNotice}</p>}

          <button className="auth-submit" type="submit" disabled={isBusy}>
            {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Registrarme'}
          </button>
        </form>

        <p className="auth-secondary">
          {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
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
            {mode === 'login' ? 'Registrate' : 'Inicia sesion'}
          </button>
        </p>
      </div>
    </div>
  );
}
