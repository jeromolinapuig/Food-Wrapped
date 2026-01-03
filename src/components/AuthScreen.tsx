import { type FormEvent, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
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
          <div className="auth-logo">🍔</div>
          <div>
            <p className="auth-eyebrow">Burger Wrapped</p>
            <h1 className="auth-title">Tu año en hamburguesas</h1>
            <p className="auth-subtitle">
              Guarda tus sitios, notas y precios en un solo lugar.
            </p>
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
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
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
