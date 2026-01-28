import {
  Bookmark,
  BookmarkBorder,
  Delete,
  Edit,
  Favorite,
  FavoriteBorder,
  Star,
  StarBorder,
  StarHalf,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { Avatar } from '../common/Avatar';
import { EntryComments } from '../Comments/EntryComments';
import type { CommentMode, EntryComment } from '../Comments/types';
import type { FeedEntry } from './types';
import { usePreferences } from '../../context/PreferencesContext';

type EntryReactions = { likeCount: number; liked: boolean; saved: boolean };

type FeedEntryCardProps = {
  entry: FeedEntry;
  viewerId: string | null;
  isUserFeed: boolean;
  isReadOnly: boolean;
  showOwnerActions: boolean;
  reactions: EntryReactions;
  isLikePending: boolean;
  isSavePending: boolean;
  onToggleLike: (entryId: string) => void;
  onToggleSave: (entryId: string) => void;
  onOpenProfile?: (userId: string) => void;
  onOpenEntry?: (entryId: string) => void;
  onEditEntry?: (entry: FeedEntry) => void;
  onDeleteEntry?: (entry: FeedEntry) => void;
  onPreviewPhoto: (url: string) => void;
  commentMode: CommentMode;
  comments: EntryComment[];
  commentCount: number;
  commentLoading: boolean;
  commentError: string | null;
  commentDraft: string;
  commentSubmitting: boolean;
  maxCommentLength: number;
  onCommentDraftChange: (value: string) => void;
  onSubmitComment: () => void;
  onRequestDeleteComment: (comment: EntryComment) => void;
};

const renderStars = (rating: number) =>
  Array.from({ length: 5 }, (_v, i) => ({
    filled: rating >= i + 1,
    half: rating >= i + 0.5 && rating < i + 1,
  }));

export function FeedEntryCard({
  entry,
  viewerId,
  isUserFeed,
  isReadOnly,
  showOwnerActions,
  reactions,
  isLikePending,
  isSavePending,
  onToggleLike,
  onToggleSave,
  onOpenProfile,
  onOpenEntry,
  onEditEntry,
  onDeleteEntry,
  onPreviewPhoto,
  commentMode,
  comments,
  commentCount,
  commentLoading,
  commentError,
  commentDraft,
  commentSubmitting,
  maxCommentLength,
  onCommentDraftChange,
  onSubmitComment,
  onRequestDeleteComment,
}: Readonly<FeedEntryCardProps>) {
  const date = new Date(entry.datetime);
  const formattedDate = date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const { t } = useTranslation();
  const { formatCurrency } = usePreferences();
  const isSelf = viewerId ? entry.userId === viewerId : false;
  const shouldDisableProfileClick = isSelf || isUserFeed;
  const name = isSelf ? t('common.you') : entry.displayName || entry.username;
  const stars = renderStars(entry.rating);
  const canEdit = showOwnerActions && isSelf;
  const isHomemade = entry.burgerOrigin === 'homemade';
  const restaurantLabel = isHomemade
    ? t('feed.homemade')
    : entry.restaurantName ?? t('feed.restaurant');
  const likeDisabled = isReadOnly || isLikePending;
  const saveDisabled = isReadOnly || isSavePending;
  const actionLockLabel = isReadOnly ? t('feed.lockAction') : undefined;

  return (
    <div className="bw-feed-entry-wrap">
      <article className="bw-history-card bw-feed-entry">
        <div className="bw-feed-entry-header">
          {shouldDisableProfileClick ? (
            <div className="bw-feed-user">
              <Avatar
                url={entry.avatarUrl}
                alt={entry.username}
                initial={entry.username?.[0]?.toUpperCase() ?? '?'}
                loading="lazy"
              />
              <div>
                <div className="bw-feed-user-name">{name}</div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="bw-feed-user as-button"
              onClick={() => onOpenProfile?.(entry.userId)}
            >
              <Avatar
                url={entry.avatarUrl}
                alt={entry.username}
                initial={entry.username?.[0]?.toUpperCase() ?? '?'}
                loading="lazy"
              />
              <div>
                <div className="bw-feed-user-name">{name}</div>
              </div>
            </button>
          )}
          <div className="bw-feed-datetime">{formattedDate}</div>
        </div>

        <div className="bw-feed-body">
          <div className="bw-feed-restaurant">
            <div className="bw-history-restaurant">
              {isHomemade ? (
                <span className="bw-feed-homemade">
                  <img src="/homemade.png" alt="Casera" className="bw-feed-homemade-icon" />
                  <span>{restaurantLabel}</span>
                </span>
              ) : (
                restaurantLabel
              )}
            </div>
            {!isHomemade && entry.burgerName && (
              <div className="bw-feed-burger">{entry.burgerName}</div>
            )}
          </div>

          {entry.photoUrl && (
            <button
              type="button"
              className="bw-feed-photo"
              onClick={() => entry.photoUrl && onPreviewPhoto(entry.photoUrl)}
            >
              <img
                src={entry.photoUrl}
                alt={entry.burgerName ?? entry.restaurantName ?? t('common.viewPhoto')}
                loading="lazy"
              />
            </button>
          )}

          {entry.additionalNotes && (
            <p className="bw-feed-notes">{entry.additionalNotes}</p>
          )}
          {isHomemade && entry.ingredients && (
            <p className="bw-feed-ingredients">{t('feed.ingredients')}: {entry.ingredients}</p>
          )}

          <div className="bw-feed-footer">
            <div className="bw-feed-rating">
              <span className="bw-feed-stars">
                {stars.map((star, idx) => {
                  let state = 'is-empty';
                  if (star.filled) state = 'is-filled';
                  else if (star.half) state = 'is-half';
                  let Icon = StarBorder;
                  if (star.filled) Icon = Star;
                  else if (star.half) Icon = StarHalf;
                  return (
                    <span key={`${entry.id}-star-${idx}`} className={`bw-history-star ${state}`}>
                      <Icon fontSize="small" />
                    </span>
                  );
                })}
              </span>
              <span className="bw-feed-rating-number">
                {entry.rating ? `${entry.rating.toFixed(1)}` : t('feed.noRating')}
              </span>
            </div>
            <div className="bw-feed-footer-row">
              <div className="bw-feed-footer-left">
                <div className="bw-feed-actions">
                  <button
                    type="button"
                    className={`bw-feed-action ${reactions.liked ? 'is-active' : ''}`}
                    onClick={() => onToggleLike(entry.id)}
                    disabled={likeDisabled}
                    aria-pressed={reactions.liked}
                    title={actionLockLabel ?? (reactions.liked ? t('feed.unlike') : t('feed.like'))}
                  >
                    {reactions.liked ? <Favorite fontSize="small" /> : <FavoriteBorder fontSize="small" />}
                    <span className="bw-feed-action-count">{reactions.likeCount}</span>
                  </button>
                  <button
                    type="button"
                    className={`bw-feed-action ${reactions.saved ? 'is-active' : ''}`}
                    onClick={() => onToggleSave(entry.id)}
                    disabled={saveDisabled}
                    aria-pressed={reactions.saved}
                    title={actionLockLabel ?? (reactions.saved ? t('feed.unsave') : t('feed.save'))}
                  >
                    {reactions.saved ? <Bookmark fontSize="small" /> : <BookmarkBorder fontSize="small" />}
                  </button>
                </div>
              </div>
              <div className="bw-feed-footer-right">
                <div className="bw-feed-price">
                  {formatCurrency(entry.price ?? 0, { fromCurrency: entry.currency ?? 'EUR' })}
                </div>
                {canEdit && (
                  <div className="bw-history-actions">
                    <button
                      className="bw-icon-button"
                      title="Editar entrada"
                      onClick={() => onEditEntry?.(entry)}
                    >
                      <Edit fontSize="small" />
                    </button>
                    <button
                      className="bw-icon-button bw-icon-danger"
                      title="Eliminar entrada"
                      onClick={() => onDeleteEntry?.(entry)}
                    >
                      <Delete fontSize="small" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <EntryComments
          variant="inline"
          entryId={entry.id}
          entryUserId={entry.userId}
          viewerId={viewerId}
          commentMode={commentMode}
          comments={comments}
          commentCount={commentCount}
          isLoading={commentLoading}
          error={commentError}
          draft={commentDraft}
          isSubmitting={commentSubmitting}
          maxLength={maxCommentLength}
          onDraftChange={onCommentDraftChange}
          onSubmit={onSubmitComment}
          onRequestDelete={onRequestDeleteComment}
          onOpenEntry={onOpenEntry}
        />
      </article>
      <EntryComments
        variant="card"
        entryId={entry.id}
        entryUserId={entry.userId}
        viewerId={viewerId}
        commentMode={commentMode}
        comments={comments}
        commentCount={commentCount}
        isLoading={commentLoading}
        error={commentError}
        draft={commentDraft}
        isSubmitting={commentSubmitting}
        maxLength={maxCommentLength}
        onDraftChange={onCommentDraftChange}
        onSubmit={onSubmitComment}
        onRequestDelete={onRequestDeleteComment}
      />
    </div>
  );
}
