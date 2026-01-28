import { useEffect, useState } from 'react';
import { Close } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { GroupInvite } from '../../types/groups';
import { supabase } from '../../lib/supabaseClient';
import { lockBodyScroll } from '../../utils/scrollLock';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { ModalBase } from '../common/ModalBase';
import '../../styles/shared.css';
import '../GroupsPage/GroupsPage.css';

export type { GroupInvite } from '../../types/groups';

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
  const { t } = useTranslation();
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
        setActionError(t('groupInvites.limitError', { max: maxGroups }));
        setMutating(false);
        setConfirmAction(null);
        return;
      }
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({ group_id: invite.groupId, user_id: currentUserId });

      if (memberError) {
        if (isGroupLimitError(memberError.message)) {
          setActionError(t('groupInvites.limitError', { max: maxGroups }));
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
      setActionError(t('groupInvites.updateError'));
      setMutating(false);
      return;
    }

    setMutating(false);
    setConfirmAction(null);
    onChanged();
    window.dispatchEvent(new Event('bw-invites-updated'));
  };

  return (
    <>
      <ModalBase onClose={onClose} modalClassName="bw-modal bw-group-modal">
        <div className="bw-modal-header">
          <div>
            <h2 className="bw-modal-title">
              {isAtLimit ? t('groupInvites.titleLimit', { max: maxGroups }) : t('groupInvites.title')}
            </h2>
            <p className="bw-modal-subtitle">{t('groupInvites.subtitle')}</p>
          </div>
          <button type="button" className="bw-icon-button" onClick={onClose} aria-label={t('common.close')}>
            <Close fontSize="small" />
          </button>
        </div>

        <div className="bw-group-modal-body">
          {loading && <p className="bw-helper">{t('groupInvites.loading')}</p>}
          {error && <p className="bw-helper" style={{ color: 'red' }}>{error}</p>}
          {actionError && <p className="bw-helper" style={{ color: 'red' }}>{actionError}</p>}
          {!loading && !error && invites.length === 0 && (
            <p className="bw-helper">{t('groupInvites.noInvites')}</p>
          )}

          {!loading && !error && invites.length > 0 && (
            <div className="bw-group-invites">
              {invites.map((invite) => {
                const inviterHandle = invite.inviterUsername ?? invite.inviterDisplayName ?? 'usuario';
                const groupLabel = invite.groupName ? `"${invite.groupName}"` : t('groupInvites.thisGroup');
                return (
                  <div key={invite.id} className="bw-group-invite-card">
                    <p className="bw-group-invite-text">
                      {t('groupInvites.inviteText', { inviter: inviterHandle, group: groupLabel })}
                    </p>
                    <div className="bw-group-invite-actions">
                      <button
                        type="button"
                        className="bw-btn bw-btn-ghost"
                        onClick={() => setConfirmAction({ invite, action: 'reject' })}
                        disabled={mutating}
                      >
                        {t('groupInvites.reject')}
                      </button>
                      <button
                        type="button"
                        className="bw-btn bw-btn-primary"
                        onClick={() => setConfirmAction({ invite, action: 'accept' })}
                        disabled={mutating || isAtLimit}
                      >
                        {t('groupInvites.accept')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ModalBase>
      <ConfirmDialog
        open={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        title={
          confirmAction?.action === 'accept'
            ? t('groupInvites.acceptConfirm')
            : t('groupInvites.rejectConfirm')
        }
        actions={(
          <>
            <button
              className="bw-btn bw-btn-ghost"
              type="button"
              onClick={() => setConfirmAction(null)}
              disabled={mutating}
            >
              {t('common.cancel')}
            </button>
            <button
              className="bw-btn bw-btn-primary"
              type="button"
              onClick={handleConfirm}
              disabled={mutating}
            >
              {mutating ? t('groupInvites.processing') : t('groupInvites.confirm')}
            </button>
          </>
        )}
      />
    </>
  );
}
