import { useEffect, useState } from 'react';
import { CheckCircle, Close, Delete, RadioButtonUnchecked } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { GroupMemberWithRole } from '../../types/groups';
import type { UserSummary } from '../../types/profiles';
import { supabase } from '../../lib/supabaseClient';
import { lockBodyScroll } from '../../utils/scrollLock';
import '../../styles/shared.css';
import '../GroupsPage/GroupsPage.css';

export type GroupManageModalProps = {
  currentUserId: string;
  groupId: string;
  groupName: string | null;
  onClose: () => void;
  onChanged: () => void;
};

const isGroupLimitError = (message?: string | null) => {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes('maximo') || lower.includes('limite');
};

export function GroupManageModal({
  currentUserId,
  groupId,
  groupName,
  onClose,
  onChanged,
}: Readonly<GroupManageModalProps>) {
  const { t } = useTranslation();
  const [members, setMembers] = useState<GroupMemberWithRole[]>([]);
  const [friends, setFriends] = useState<UserSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [groupTitle, setGroupTitle] = useState(groupName ?? '');
  const [initialGroupTitle, setInitialGroupTitle] = useState(groupName ?? '');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => lockBodyScroll(), []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);

      const { data: groupRow, error: groupError } = await supabase
        .from('groups')
        .select('id, owner_id')
        .eq('id', groupId)
        .single();

      if (cancelled) return;

      if (groupError || !groupRow) {
        setError(t('groupManage.loading'));
        setLoading(false);
        return;
      }

      const ownerId = (groupRow as { owner_id: string; name?: string | null }).owner_id;
      const name = (groupRow as { name?: string | null }).name ?? groupName ?? '';
      setGroupTitle(name);
      setInitialGroupTitle(name);

      const { data: memberRows, error: membersError } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId);

      if (cancelled) return;

      if (membersError) {
        setError(t('groupManage.loading'));
        setLoading(false);
        return;
      }

      const memberIds = new Set<string>();
      memberIds.add(ownerId);
      (memberRows ?? []).forEach((row) => memberIds.add((row as { user_id: string }).user_id));

      const memberIdList = Array.from(memberIds);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', memberIdList);

      if (cancelled) return;

      if (profilesError) {
        setError(t('groupManage.loading'));
        setLoading(false);
        return;
      }

      const mappedMembers = (profilesData ?? []).map((profile) => {
        const id = (profile as { id: string }).id;
        return {
          id,
          username: (profile as { username: string | null }).username,
          displayName: (profile as { display_name: string | null }).display_name,
          avatarUrl: (profile as { avatar_url: string | null }).avatar_url,
          isOwner: id === ownerId,
        };
      });
      setMembers(mappedMembers);

      const [{ data: outgoing }, { data: incoming }] = await Promise.all([
        supabase.from('follows').select('following_id').eq('follower_id', currentUserId),
        supabase.from('follows').select('follower_id').eq('following_id', currentUserId),
      ]);

      if (cancelled) return;

      const outgoingIds = new Set((outgoing ?? []).map((row) => (row as { following_id: string }).following_id));
      const incomingIds = new Set((incoming ?? []).map((row) => (row as { follower_id: string }).follower_id));
      const mutualIds = Array.from(outgoingIds).filter((id) => incomingIds.has(id));
      const inviteCandidates = mutualIds.filter((id) => !memberIds.has(id));

      if (!inviteCandidates.length) {
        setFriends([]);
        setLoading(false);
        return;
      }

      const { data: friendsData, error: friendsError } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', inviteCandidates);

      if (cancelled) return;

      if (friendsError) {
        setError(t('groupManage.loading'));
        setLoading(false);
        return;
      }

      const mappedFriends = (friendsData ?? []).map((profile) => ({
        id: (profile as { id: string }).id,
        username: (profile as { username: string | null }).username,
        displayName: (profile as { display_name: string | null }).display_name,
        avatarUrl: (profile as { avatar_url: string | null }).avatar_url,
      }));
      setFriends(mappedFriends);
      setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, groupId, groupName]);

  const handleRename = async () => {
    const nextName = groupTitle.trim();
    if (!nextName || saving) return;
    if (nextName === initialGroupTitle.trim()) return;
    setSaving(true);
    const { error: renameError } = await supabase
      .from('groups')
      .update({ name: nextName })
      .eq('id', groupId)
      .eq('owner_id', currentUserId);
    if (renameError) {
      setError(t('groupManage.errorRename'));
      setSaving(false);
      return;
    }
    setInitialGroupTitle(nextName);
    setSaving(false);
    onChanged();
  };

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

  const handleInvite = async () => {
    if (!selectedIds.size || saving) return;
    setSaving(true);
    const payload = Array.from(selectedIds).map((userId) => ({
      group_id: groupId,
      inviter_id: currentUserId,
      invitee_id: userId,
    }));

    const { error: inviteError } = await supabase.from('group_invitations').insert(payload);

    if (inviteError) {
      if (isGroupLimitError(inviteError.message)) {
        setError(t('groupManage.errorInviteLimit'));
      } else {
        setError(t('groupManage.errorInvite'));
      }
      setSaving(false);
      return;
    }

    setSelectedIds(new Set());
    setSaving(false);
    onChanged();
    window.dispatchEvent(new Event('bw-invites-updated'));
  };

  const handleDeleteGroup = async () => {
    if (saving) return;
    setSaving(true);
    const { error: deleteError } = await supabase
      .from('groups')
      .delete()
      .eq('id', groupId)
      .eq('owner_id', currentUserId);
    if (deleteError) {
      setError(t('groupManage.errorDelete'));
      setSaving(false);
      return;
    }
    setSaving(false);
    setConfirmDelete(false);
    onChanged();
    onClose();
  };

  const handleRemoveMember = async (member: GroupMemberWithRole) => {
    if (saving || member.isOwner) return;
    const confirmRemove = window.confirm(t('groupManage.confirmRemove', { user: member.username ?? 'usuario' }));
    if (!confirmRemove) return;
    setSaving(true);
    const { error: removeError } = await supabase
      .from('group_members')
      .delete()
      .match({ group_id: groupId, user_id: member.id });
    if (removeError) {
      setError(t('groupManage.errorRemove'));
      setSaving(false);
      return;
    }
    setMembers((prev) => prev.filter((row) => row.id !== member.id));
    setSaving(false);
    onChanged();
  };

  return (
    <div className="bw-modal-backdrop" onClick={onClose}>
      <div className="bw-modal bw-group-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bw-modal-header">
          <div>
            <h2 className="bw-modal-title">{t('groupManage.title')}</h2>
            <p className="bw-modal-subtitle">
              {t('groupManage.subtitle', { name: groupName ?? t('groups.title', { defaultValue: 'Group' }) })}
            </p>
          </div>
          <div className="bw-modal-header-actions">
            <button
              type="button"
              className="bw-icon-button bw-icon-danger"
              onClick={() => setConfirmDelete(true)}
              aria-label={t('groupManage.deleteAriaLabel')}
            >
              <Delete fontSize="small" />
            </button>
            <button type="button" className="bw-icon-button" onClick={onClose} aria-label={t('common.close')}>
              <Close fontSize="small" />
            </button>
          </div>
        </div>

        <div className="bw-group-modal-body">
          {loading && <p className="bw-helper">{t('groupManage.loading')}</p>}
          {error && <p className="bw-helper" style={{ color: 'red' }}>{error}</p>}

          {!loading && (
            <>
              <div className="bw-group-section">
                <div className="bw-group-section-title">{t('groupManage.groupNameSection')}</div>
                <div className="bw-group-rename">
                  <input
                    className="bw-input"
                    value={groupTitle}
                    onChange={(e) => setGroupTitle(e.target.value)}
                    placeholder={t('groupManage.groupNamePlaceholder')}
                  />
                  <button
                    type="button"
                    className="bw-btn bw-btn-primary"
                    onClick={handleRename}
                    disabled={saving || !groupTitle.trim() || groupTitle.trim() === initialGroupTitle.trim()}
                  >
                    {t('groupManage.save')}
                  </button>
                </div>
              </div>
              <div className="bw-group-section">
                <div className="bw-group-section-title">{t('groupManage.membersSection')}</div>
                <div className="bw-group-members">
                  {members.map((member) => {
                    const name = member.displayName ?? member.username ?? t('common.user', { defaultValue: 'User' });
                    return (
                      <div key={member.id} className="bw-group-member-row">
                        <div className="bw-group-member-info">
                          <div className="bw-avatar bw-avatar-sm">
                            {member.avatarUrl ? (
                              <img src={member.avatarUrl} alt={name} className="bw-avatar-image" />
                            ) : (
                              <div className="bw-avatar-placeholder">
                                {(member.username ?? '?').charAt(0).toUpperCase()}
                              </div>
                            )}
                            </div>
                            <div>
                              <div className="bw-user-name">@{member.username ?? t('common.user', { defaultValue: 'user' })}</div>
                              <div className="bw-user-meta">{name}</div>
                            </div>
                          </div>
                          {member.isOwner ? (
                            <span className="bw-group-owner">{t('groupManage.admin')}</span>
                          ) : (
                            <button
                              type="button"
                              className="bw-group-remove"
                              onClick={() => handleRemoveMember(member)}
                              disabled={saving}
                            >
                              {t('groupManage.remove')}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  {!members.length && <p className="bw-helper">{t('groupManage.noMembers')}</p>}
                </div>
              </div>

              <div className="bw-group-section">
                <div className="bw-group-section-title">{t('groupManage.inviteFriendsSection')}</div>
                <div className="bw-group-search">
                  <input
                    type="search"
                    className="bw-input"
                    placeholder={t('groupManage.searchPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {!friends.length && <p className="bw-helper">{t('groupManage.noFriends')}</p>}
                {friends.length > 0 && (
                  <div className="bw-group-friends">
                    {filteredFriends.map((friend) => {
                      const isSelected = selectedIds.has(friend.id);
                      const displayName = friend.displayName ?? friend.username ?? t('common.user', { defaultValue: 'User' });
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
                              <div className="bw-user-name">@{friend.username ?? t('common.user', { defaultValue: 'user' })}</div>
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
                <div className="bw-group-modal-actions bw-group-modal-actions-sticky">
                  <button
                    type="button"
                    className="bw-fab bw-group-create-button"
                    disabled={selectedIds.size === 0 || saving}
                    onClick={handleInvite}
                  >
                    {saving ? t('groupManage.sending') : t('groupManage.invite')}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {confirmDelete && (
        <div className="bw-confirm-backdrop" onClick={() => setConfirmDelete(false)}>
          <div className="bw-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="bw-confirm-title">{t('groupManage.confirmDelete')}</h3>
            <p className="bw-confirm-text">{t('groupManage.confirmDeleteText')}</p>
            <div className="bw-confirm-actions">
              <button
                className="bw-btn bw-btn-ghost"
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={saving}
              >
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </button>
              <button
                className="bw-btn bw-btn-primary"
                type="button"
                onClick={handleDeleteGroup}
                disabled={saving}
              >
                {saving ? t('groupManage.deleting') : t('groupManage.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
