export type CommentMode = 'preview' | 'full' | 'none';

export type EntryComment = {
  id: string;
  entryId: string;
  userId: string;
  body: string;
  createdAt: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type SupabaseCommentRow = {
  id: string;
  entry_id: string;
  user_id: string;
  body: string | null;
  created_at: string;
};
