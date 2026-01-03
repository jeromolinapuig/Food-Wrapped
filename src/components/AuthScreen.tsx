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
        <div
            style={{
                maxWidth: 340,
                margin: '40px auto',
                padding: 16,
                borderRadius: 16,
                border: '1px solid #eee',
                fontFamily: 'system-ui, sans-serif',
            }}
        >
            <h1 style={{ marginBottom: 4 }}>Burger Wrapped</h1>
            <p style={{ marginTop: 0 }}>
                {mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}
            </p>

            <form
                onSubmit={handleSubmit}
                style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    required
                />
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Contraseña"
                    required
                />

                {error && (
                    <p style={{ color: 'red', fontSize: 12, margin: 0 }}>{error}</p>
                )}

                <button type="submit" disabled={loading} style={{ marginTop: 8 }}>
                    {loading
                        ? 'Cargando...'
                        : mode === 'login'
                            ? 'Entrar'
                            : 'Registrarme'}
                </button>
            </form>

            <button
                type="button"
                onClick={() =>
                    setMode((prev) => (prev === 'login' ? 'signup' : 'login'))
                }
                style={{
                    marginTop: 12,
                    fontSize: 12,
                    background: 'none',
                    border: 'none',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                }}
            >
                {mode === 'login'
                    ? '¿No tienes cuenta? Regístrate'
                    : '¿Ya tienes cuenta? Inicia sesión'}
            </button>
        </div>
    );
}
