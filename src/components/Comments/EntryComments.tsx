import { DeleteOutline } from '@mui/icons-material';
import { UserAvatar } from '../common/UserAvatar';
import { useTranslation } from 'react-i18next';
import type { CommentMode, EntryComment } from './types';

type EntryCommentsProps = {
  variant: 'inline' | 'card';
  entryUserId: string;
  viewerId: string | null;
  canComment?: boolean;
  canModerateComments?: boolean;
  commentMode: CommentMode;
  comments: EntryComment[];
  commentCount: number;
  isLoading: boolean;
  error: string | null;
  draft: string;
  isSubmitting: boolean;
  maxLength: number;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onRequestDelete: (comment: EntryComment) => void;
};

const getPreviewCommentLimit = (comments: EntryComment[]) => {
  if (comments.length <= 2) return comments.length;
  const sample = comments.slice(0, 3);
  const totalLength = sample.reduce((sum, comment) => sum + comment.body.length, 0);
  const hasLong = sample.some((comment) => comment.body.length > 140);
  return hasLong || totalLength > 260 ? 2 : 3;
};

export function EntryComments({
  variant,
  entryUserId,
  viewerId,
  canComment = true,
  canModerateComments = false,
  commentMode,
  comments,
  commentCount,
  isLoading,
  error,
  draft,
  isSubmitting,
  maxLength,
  onDraftChange,
  onSubmit,
  onRequestDelete,
}: Readonly<EntryCommentsProps>) {
  const { t } = useTranslation();
  const shouldShowComments =
    commentMode === 'full' || Boolean(error) || commentCount > 0;

  if (variant === 'inline' && (commentMode !== 'preview' || !shouldShowComments)) return null;
  if (variant === 'card' && (commentMode !== 'full' || !shouldShowComments)) return null;

  const previewLimit = commentMode === 'preview' ? getPreviewCommentLimit(comments) : comments.length;
  const visibleComments = commentMode === 'preview' ? comments.slice(0, previewLimit) : comments;

  if (variant === 'inline') {
    return (
      <div className="bw-comment-inline">
        <div className="bw-comment-block">
          {error && <p className="bw-helper" style={{ color: 'red' }}>{error}</p>}
          {!!visibleComments.length && (
            <div className="bw-comment-list">
              {visibleComments.map((comment) => {
                const canDelete = canModerateComments || Boolean(viewerId && (viewerId === comment.userId || viewerId === entryUserId));
                const commentName = comment.displayName || comment.username;
                const content = (
                  <>
                    <div className="bw-comment-avatar">
                      <UserAvatar
                        avatarUrl={comment.avatarUrl}
                        avatarFrame={comment.avatarFrame}
                        username={comment.username}
                        displayName={comment.displayName}
                        loading="lazy"
                      />
                    </div>
                    <div className="bw-comment-body">
                      <div className="bw-comment-meta">
                        <span className="bw-comment-name">{commentName}</span>
                      </div>
                      <p className="bw-comment-text">{comment.body}</p>
                    </div>
                  </>
                );

                return (
                  <div className="bw-comment-item" key={comment.id}>
                    {content}
                    {canDelete && (
                      <button
                        type="button"
                        className="bw-comment-delete-button"
                        onClick={() => onRequestDelete(comment)}
                        aria-label={t('comments.delete')}
                        title={t('comments.delete')}
                      >
                        <DeleteOutline fontSize="small" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <article className="bw-comment-card">
      <div className="bw-comment-block">
        {error && <p className="bw-helper" style={{ color: 'red' }}>{error}</p>}
        {isLoading && (
          <p className="bw-helper">{t('comments.loading')}</p>
        )}
        {!!visibleComments.length && (
          <div className="bw-comment-list">
            {visibleComments.map((comment) => {
              const canDelete = canModerateComments || Boolean(viewerId && (viewerId === comment.userId || viewerId === entryUserId));
              const commentName = comment.displayName || comment.username;
              const commentDate = new Date(comment.createdAt).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });
              const content = (
                <>
                  <div className="bw-comment-avatar">
                    <UserAvatar
                      avatarUrl={comment.avatarUrl}
                      avatarFrame={comment.avatarFrame}
                      username={comment.username}
                      displayName={comment.displayName}
                      loading="lazy"
                    />
                  </div>
                  <div className="bw-comment-body">
                    <div className="bw-comment-meta">
                      <span className="bw-comment-name">{commentName}</span>
                      <span className="bw-comment-date">{commentDate}</span>
                    </div>
                    <p className="bw-comment-text">{comment.body}</p>
                  </div>
                </>
              );

              return (
                <div className="bw-comment-item" key={comment.id}>
                  {content}
                  {canDelete && (
                    <button
                      type="button"
                      className="bw-comment-delete-button"
                      onClick={() => onRequestDelete(comment)}
                      aria-label={t('comments.delete')}
                      title={t('comments.delete')}
                    >
                      <DeleteOutline fontSize="small" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {!isLoading && !visibleComments.length && (
          <p className="bw-helper">{t('comments.beFirst')}</p>
        )}
        {viewerId && canComment ? (
          <form
            className="bw-comment-form"
            onSubmit={(event) => {
              event.preventDefault();
              void onSubmit();
            }}
          >
            <textarea
              className="bw-textarea bw-comment-input"
              rows={3}
              placeholder={t('comments.placeholder')}
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              maxLength={maxLength}
              disabled={isSubmitting}
            />
            <div className="bw-comment-actions">
              <button
                className="bw-btn bw-btn-primary"
                type="submit"
                disabled={isSubmitting || !draft.trim()}
              >
                {isSubmitting ? t('comments.commenting') : t('comments.comment')}
              </button>
            </div>
          </form>
        ) : (
          <p className="bw-helper">{t('comments.loginToComment')}</p>
        )}
      </div>
    </article>
  );
}
