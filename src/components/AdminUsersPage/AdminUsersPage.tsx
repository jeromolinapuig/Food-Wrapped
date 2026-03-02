import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { AppShell } from '../common/AppShell';
import { PageHeader } from '../common/PageHeader';
import { UserCard } from '../common/UserCard';
import '../../styles/layout.css';
import '../../styles/shared.css';

type AdminUsersPageProps = {
  session: Session;
};

type AdminUserRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  equipped_frame: 'gold' | 'silver' | 'bronze' | null;
  bio: string | null;
  is_private: boolean | null;
  is_admin: boolean | null;
};

export function AdminUsersPage({ session }: Readonly<AdminUsersPageProps>) {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadUsers = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, equipped_frame, bio, is_private, is_admin')
        .order('username', { ascending: true })
        .limit(500);
      if (cancelled) return;
      setUsers((data ?? []) as AdminUserRow[]);
      setLoading(false);
    };
    void loadUsers();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) => {
      const username = (user.username ?? '').toLowerCase();
      const display = (user.display_name ?? '').toLowerCase();
      return username.includes(term) || display.includes(term);
    });
  }, [searchTerm, users]);

  return (
    <AppShell>
      <PageHeader
        title="Admin · Usuarios"
        subtitle={`Gestionando como ${session.user.email ?? session.user.id}`}
      />
      <main className="bw-main">
        <section className="bw-card">
          <div className="bw-field" style={{ marginBottom: 12 }}>
            <label htmlFor="admin-users-search" className="bw-label">Buscar usuario</label>
            <input
              id="admin-users-search"
              className="bw-input"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Filtrar por nombre o username"
            />
          </div>

          {loading && <p className="bw-helper">Cargando usuarios...</p>}
          {!loading && filteredUsers.length === 0 && <p className="bw-helper">No hay usuarios para mostrar.</p>}
          {!loading && filteredUsers.length > 0 && (
            <div style={{ display: 'grid', gap: 10 }}>
              {filteredUsers.map((user) => (
                <UserCard
                  key={user.id}
                  handle={user.username ?? 'usuario'}
                  avatarUrl={user.avatar_url}
                  avatarFrame={user.equipped_frame}
                  avatarAlt={user.username ?? 'usuario'}
                  avatarInitial={(user.username ?? '?').charAt(0).toUpperCase()}
                  meta={user.is_admin ? 'Admin' : user.is_private ? 'Privado' : 'Público'}
                  bio={user.bio}
                  asButton
                  onClick={() =>
                    navigate(`/users/${user.id}`, {
                      state: { returnTo: '/admin/users', returnProfileUserId: null, adminView: true },
                    })
                  }
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}



