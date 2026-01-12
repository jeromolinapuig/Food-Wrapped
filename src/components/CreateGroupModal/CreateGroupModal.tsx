import { useEffect, useState } from 'react';
import { CheckCircle, Close, RadioButtonUnchecked } from '@mui/icons-material';
import type { UserSummary } from '../../types/profiles';
import { supabase } from '../../lib/supabaseClient';
import { lockBodyScroll } from '../../utils/scrollLock';
import '../../styles/shared.css';
import '../GroupsPage/GroupsPage.css';

export type CreateGroupModalProps = {
  currentUserId: string;
  currentGroupCount: number;
  maxGroups: number;
  onClose: () => void;
  onCreated: () => void;
};

const isGroupLimitError = (message?: string | null) => {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes('maximo') || lower.includes('limite');
};

export function CreateGroupModal({
  currentUserId,
  currentGroupCount,
  maxGroups,
  onClose,
  onCreated,
}: Readonly<CreateGroupModalProps>) {
  const [friends, setFriends] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState('');
  const [saving, setSaving] = useState(false);
  const isAtLimit = currentGroupCount >= maxGroups;

  useEffect(() => lockBodyScroll(), []);

  useEffect(() => {
    let cancelled = false;

    const loadFriends = async () => {
      setLoading(true);
      setError(null);

      const [{ data: outgoing, error: outgoingError }, { data: incoming, error: incomingError }] = await Promise.all([
        supabase.from('follows').select('following_id').eq('follower_id', currentUserId),
        supabase.from('follows').select('follower_id').eq('following_id', currentUserId),
      ]);

      if (cancelled) return;

      if (outgoingError || incomingError) {
        setError('No se pudieron cargar tus amigos.');
        setLoading(false);
        return;
      }

      const outgoingIds = new Set((outgoing ?? []).map((row) => (row as { following_id: string }).following_id));
      const incomingIds = new Set((incoming ?? []).map((row) => (row as { follower_id: string }).follower_id));
      const mutualIds = Array.from(outgoingIds).filter((id) => incomingIds.has(id));

      if (!mutualIds.length) {
        setFriends([]);
        setLoading(false);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', mutualIds);

      if (cancelled) return;

      if (profilesError) {
        setError('No se pudieron cargar tus amigos.');
        setLoading(false);
        return;
      }

      const mapped = (profiles ?? []).map((profile) => ({
        id: (profile as { id: string }).id,
        username: (profile as { username: string | null }).username,
        displayName: (profile as { display_name: string | null }).display_name,
        avatarUrl: (profile as { avatar_url: string | null }).avatar_url,
      }));

      setFriends(mapped);
      setLoading(false);
    };

    loadFriends();

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  const term = searchTerm.trim().toLowerCase();
  const filteredFriends = term
    ? friends.filter((friend) => {
        const u = (friend.username ?? '').toLowerCase();
        const d = (friend.displayName ?? '').toLowerCase();
        return u.includes(term) || d.includes(term);
      })
    : friends;

  const toggleSelected = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleCreate = async () => {
    if (isAtLimit) {
      setError('No puedes crear mas de 6 grupos.');
      return;
    }
    if (saving || !groupName.trim() || selectedIds.size === 0) return;
    setSaving(true);
    setError(null);

    const { data: groupRow, error: groupError } = await supabase
      .from('groups')
      .insert({ name: groupName.trim(), owner_id: currentUserId })
      .select('id')
      .single();

    if (groupError || !groupRow) {
      if (isGroupLimitError(groupError?.message)) {
        setError('No puedes crear mas de 6 grupos.');
      } else {
        setError('No se pudo crear el grupo.');
      }
      setSaving(false);
      return;
    }

    const groupId = (groupRow as { id: string }).id;
    const invitePayload = Array.from(selectedIds)
      .filter((userId) => userId !== currentUserId)
      .map((userId) => ({
        group_id: groupId,
        inviter_id: currentUserId,
        invitee_id: userId,
      }));

    if (invitePayload.length) {
      const { error: invitesError } = await supabase.from('group_invitations').insert(invitePayload);

      if (invitesError) {
        if (isGroupLimitError(invitesError.message)) {
          setError('Alguno de los usuarios ya tiene el maximo de 6 grupos.');
        } else {
          setError('No se pudieron enviar las invitaciones.');
        }
        setSaving(false);
        return;
      }
    }

    const { error: ownerMemberError } = await supabase
      .from('group_members')
      .insert({ group_id: groupId, user_id: currentUserId });

    if (ownerMemberError) {
      if (isGroupLimitError(ownerMemberError.message)) {
        setError('No puedes unirte a mas de 6 grupos.');
      } else {
        setError('No se pudo aヵadir al creador al grupo.');
      }
      setSaving(false);
      return;
    }

    setSaving(false);
    window.dispatchEvent(new Event('bw-invites-updated'));
    onCreated();
  };

  return (
    <div className="bw-modal-backdrop" onClick={onClose}>
      <div className="bw-modal bw-group-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bw-modal-header">
          <div>
            <h2 className="bw-modal-title">Crear grupo</h2>
            <p className="bw-modal-subtitle">Selecciona amigos con los que quieres formar el grupo.</p>
          </div>
          <button type="button" className="bw-icon-button" onClick={onClose} aria-label="Cerrar">
            <Close fontSize="small" />
          </button>
        </div>

        {isAtLimit && (
          <p className="bw-helper" style={{ color: 'red', marginBottom: 8 }}>
            Ya tienes el maximo de {maxGroups} grupos.
          </p>
        )}

        <div className="bw-field bw-group-name-field">
          <label className="bw-label" htmlFor="bw-group-name">
            Nombre del grupo
          </label>
          <input
            id="bw-group-name"
            className="bw-input"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Ej. Amigos del burger"
          />
        </div>

        {friends.length > 5 && (
          <div className="bw-group-search">
            <input
              type="search"
              className="bw-input"
              placeholder="Buscar por nombre de usuario..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}

        <div className="bw-group-modal-body">
          {loading && <p className="bw-helper">Cargando amigos...</p>}
          {error && <p className="bw-helper" style={{ color: 'red' }}>{error}</p>}
          {!loading && !error && !filteredFriends.length && (
            <p className="bw-helper">
              {friends.length ? 'No hay resultados.' : 'Aカn no tienes amigos que te sigan y a los que sigas.'}
            </p>
          )}

          {!loading && !error && filteredFriends.length > 0 && (
            <div className="bw-group-friends">
              {filteredFriends.map((friend) => {
                const isSelected = selectedIds.has(friend.id);
                const displayName = friend.displayName ?? friend.username ?? 'Usuario';
                return (
                  <button
                    key={friend.id}
                    type="button"
                    className="bw-user-card bw-group-friend-card"
                    onClick={() => toggleSelected(friend.id)}
                  >
                    <div className="bw-user-info">
                      <div className="bw-avatar bw-avatar-sm">
                        {friend.avatarUrl ? (
                          <img src={friend.avatarUrl} alt={displayName} className="bw-avatar-image" />
                        ) : (
                          <div className="bw-avatar-placeholder">
                            {(friend.username ?? '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="bw-user-name">@{friend.username ?? 'usuario'}</div>
                        <div className="bw-user-meta">{displayName}</div>
                      </div>
                    </div>
                    <span className={`bw-group-check ${isSelected ? 'is-selected' : ''}`} aria-hidden="true">
                      {isSelected ? <CheckCircle fontSize="small" /> : <RadioButtonUnchecked fontSize="small" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="bw-group-modal-actions">
          <button
            type="button"
            className="bw-fab bw-group-create-button"
            disabled={isAtLimit || selectedIds.size === 0 || !groupName.trim() || saving}
            onClick={handleCreate}
          >
            {saving ? 'Creando...' : 'Crear grupo'}
          </button>
        </div>
      </div>
    </div>
  );
}
