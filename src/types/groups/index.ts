export type GroupMemberPreview = {
  id: string;
  initial: string;
  avatarUrl: string | null;
  avatarFrame?: 'gold' | 'silver' | 'bronze' | null;
};

export type GroupCard = {
  id: string;
  name: string;
  members: number;
  membersPreview: GroupMemberPreview[];
  isOwner: boolean;
};

export type GroupInvite = {
  id: string;
  groupId: string;
  groupName: string | null;
  inviterId: string;
  inviterUsername: string | null;
  inviterDisplayName: string | null;
};

export type GroupMember = {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  avatarFrame?: 'gold' | 'silver' | 'bronze' | null;
  isOwner?: boolean;
};

export type GroupMemberWithRole = GroupMember & { isOwner: boolean };
