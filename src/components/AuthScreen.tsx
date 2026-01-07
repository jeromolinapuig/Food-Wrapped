import { type FormEvent, useState } from 'react';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { supabase } from '../lib/supabaseClient';
import '../styles/auth-screen.css';

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signup' && !username.trim()) {
        throw new Error('El nombre de usuario es obligatorio.');
      }
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username.trim(),
            },
          },
        });
        if (error) throw error;
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
            <h1 className="auth-title">Burger Wrapped</h1>
            <h5 className="auth-subtitle">Guarda tus sitios, notas y precios en un solo lugar.</h5>
          </div>
        </div>

        <div className="auth-toggle">
          <button
            type="button"
            className={mode === 'login' ? 'is-active' : ''}
            onClick={() => setMode('login')}
          >
            Entrar
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'is-active' : ''}
            onClick={() => setMode('signup')}
          >
            Crear cuenta
          </button>
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
          </label>

          {error && <p className="auth-error">{error}</p>}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Registrarme'}
          </button>
        </form>

        <p className="auth-secondary">
          {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
          <button
            type="button"
            className="auth-link"
            onClick={() => setMode((prev) => (prev === 'login' ? 'signup' : 'login'))}
          >
            {mode === 'login' ? 'Registrate' : 'Inicia sesion'}
          </button>
        </p>
      </div>
    </div>
  );
}
