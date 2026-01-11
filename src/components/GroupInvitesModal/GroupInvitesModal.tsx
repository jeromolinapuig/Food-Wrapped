import { useEffect, useState } from 'react';
import { Close } from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import { lockBodyScroll } from '../../utils/scrollLock';
import '../../styles/shared.css';
import '../GroupsPage/GroupsPage.css';

export type GroupInvite = {
  id: string;
  groupId: string;
  groupName: string | null;
  inviterId: string;
  inviterUsername: string | null;
  inviterDisplayName: string | null;
};

type GroupInvitesModalProps = {
  currentUserId: string;
  currentGroupCount: number;
  maxGroups: number;
  invites: GroupInvite[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onChanged: () => void;
};

const isGroupLimitError = (message?: string | null) => {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes('maximo') || lower.includes('limite');
};

export function GroupInvitesModal({
  currentUserId,
  currentGroupCount,
  maxGroups,
  invites,
  loading,
  error,
  onClose,
  onChanged,
}: Readonly<GroupInvitesModalProps>) {
  const [confirmAction, setConfirmAction] = useState<{
    invite: GroupInvite;
    action: 'accept' | 'reject';
  } | null>(null);
  const [mutating, setMutating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const isAtLimit = currentGroupCount >= maxGroups;

  useEffect(() => lockBodyScroll(), []);

  const handleConfirm = async () => {
    if (!confirmAction) return;
    const { invite, action } = confirmAction;
    setMutating(true);
    setActionError(null);

    if (action === 'accept') {
      if (isAtLimit) {
        setActionError(`No puedes unirte a mas de ${maxGroups} grupos.`);
        setMutating(false);
        setConfirmAction(null);
        return;
      }
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({ group_id: invite.groupId, user_id: currentUserId });

      if (memberError) {
        if (isGroupLimitError(memberError.message)) {
          setActionError(`No puedes unirte a mas de ${maxGroups} grupos.`);
        }
        setMutating(false);
        return;
      }
    }

    const { error: deleteError } = await supabase
      .from('group_invitations')
      .delete()
      .eq('id', invite.id);

    if (deleteError) {
      setActionError('No se pudo actualizar la invitacion.');
      setMutating(false);
      return;
    }

    setMutating(false);
    setConfirmAction(null);
    onChanged();
    window.dispatchEvent(new Event('bw-invites-updated'));
  };

  return (
    <div className="bw-modal-backdrop" onClick={onClose}>
      <div className="bw-modal bw-group-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bw-modal-header">
          <div>
            <h2 className="bw-modal-title">
              Invitaciones a grupos{isAtLimit ? ` (no puedes unirte a mas de ${maxGroups})` : ''}
            </h2>
            <p className="bw-modal-subtitle">Gestiona las invitaciones pendientes.</p>
          </div>
          <button type="button" className="bw-icon-button" onClick={onClose} aria-label="Cerrar">
            <Close fontSize="small" />
          </button>
        </div>

        <div className="bw-group-modal-body">
          {loading && <p className="bw-helper">Cargando invitaciones...</p>}
          {error && <p className="bw-helper" style={{ color: 'red' }}>{error}</p>}
          {actionError && <p className="bw-helper" style={{ color: 'red' }}>{actionError}</p>}
          {!loading && !error && invites.length === 0 && (
            <p className="bw-helper">No tienes invitaciones pendientes.</p>
          )}

          {!loading && !error && invites.length > 0 && (
            <div className="bw-group-invites">
              {invites.map((invite) => {
                const inviterHandle = invite.inviterUsername ?? invite.inviterDisplayName ?? 'usuario';
                const groupLabel = invite.groupName ? `"${invite.groupName}"` : 'este grupo';
                return (
                  <div key={invite.id} className="bw-group-invite-card">
                    <p className="bw-group-invite-text">
                      @{inviterHandle} te ha invitado a unirte a {groupLabel}.
                    </p>
                    <div className="bw-group-invite-actions">
                      <button
                        type="button"
                        className="bw-btn bw-btn-ghost"
                        onClick={() => setConfirmAction({ invite, action: 'reject' })}
                        disabled={mutating}
                      >
                        Rechazar
                      </button>
                      <button
                        type="button"
                        className="bw-btn bw-btn-primary"
                        onClick={() => setConfirmAction({ invite, action: 'accept' })}
                        disabled={mutating || isAtLimit}
                      >
                        Aceptar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {confirmAction && (
        <div className="bw-confirm-backdrop" onClick={(e) => e.stopPropagation()}>
          <div className="bw-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="bw-confirm-title">
              {confirmAction.action === 'accept'
                ? '¿Estas seguro que quieres aceptar la invitacion?'
                : '¿Estas seguro que quieres rechazar la invitacion?'}
            </h3>
            <div className="bw-confirm-actions">
              <button
                className="bw-btn bw-btn-ghost"
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={mutating}
              >
                Cancelar
              </button>
              <button
                className="bw-btn bw-btn-primary"
                type="button"
                onClick={handleConfirm}
                disabled={mutating}
              >
                {mutating ? 'Procesando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
