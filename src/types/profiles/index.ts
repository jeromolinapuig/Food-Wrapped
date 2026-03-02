export type UserSummary = {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  avatarFrame?: 'gold' | 'silver' | 'bronze' | null;
};
