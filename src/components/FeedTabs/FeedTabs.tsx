import { startTransition, useEffect, useState, type ReactNode } from 'react';
import { Close } from '@mui/icons-material';
import { lockBodyScroll } from '../../utils/scrollLock';
import { LockedContent } from '../common/LoginOverlay';
import { CommentConfirmDialog } from '../Comments/CommentConfirmDialog';
import { useEntryComments } from '../Comments/useEntryComments';
import type { CommentMode } from '../Comments/types';
import { FeedEntryCard } from './FeedEntryCard';
import { FeedHeader } from './FeedHeader';
import { useEntryReactions } from './useEntryReactions';
import { useFeedEntries } from './useFeedEntries';
import type { FeedEntry } from './types';
import '../../styles/shared.css';
import './FeedTabs.css';
import '../EntryCard/EntryCard.css';


type FeedTabsProps = {
  currentUserId: string | null;
  isReadOnly?: boolean;
  onRequireLogin?: () => void;
  refreshKey?: number;
  onOpenProfile?: (userId: string) => void;
  onOpenEntry?: (entryId: string) => void;
  focusUserId?: string | null;
  userIdsFilter?: string[] | null;
  entryIdsFilter?: string[] | null;
  ignorePrivacy?: boolean;
  onCountChange?: (count: number) => void;
  hideHeader?: boolean;
  headerOnly?: boolean;
  monthFilter?: string;
  onMonthFilterChange?: (value: string) => void;
  showOwnerActions?: boolean;
  onEditEntry?: (entry: FeedEntry) => void;
  onDeleteEntry?: (entry: FeedEntry) => void;
  commentMode?: CommentMode;
  lockedPreview?: ReactNode;
};

/* NOSONAR */
export function FeedTabs({
  currentUserId,
  isReadOnly = false,
  onRequireLogin,
  refreshKey = 0,
  onOpenProfile,
  onOpenEntry,
  focusUserId,
  userIdsFilter,
  entryIdsFilter,
  ignorePrivacy = false,
  onCountChange,
  hideHeader = false,
  headerOnly = false,
  monthFilter,
  onMonthFilterChange,
  showOwnerActions = false,
  onEditEntry,
  onDeleteEntry,
  commentMode = 'preview',
  lockedPreview,
}: Readonly<FeedTabsProps>) {
  const {
    activeTab,
    setActiveTab,
    entries,
    loading,
    loadingMore,
    hasMore,
    error,
    privacyBlocked,
    monthOptions,
    effectiveMonthFilter,
    setEffectiveMonthFilter,
    authNotice,
    setAuthNotice,
    loadMoreRef,
    viewerId,
    isUserFeed,
    isCustomList,
    hasEntryFilter,
  } = useFeedEntries({
    currentUserId,
    isReadOnly,
    focusUserId,
    userIdsFilter,
    entryIdsFilter,
    ignorePrivacy,
    onCountChange,
    headerOnly,
    hideHeader,
    refreshKey,
    monthFilter,
    onMonthFilterChange,
  });
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const {
    entryReactions,
    pendingLikes,
    pendingSaves,
    loadEntryReactions,
    toggleLike,
    toggleSave,
  } = useEntryReactions({ viewerId, isReadOnly, onRequireLogin });
  const {
    entryComments,
    commentCounts,
    commentDrafts,
    commentLoading,
    commentErrors,
    commentActioning,
    commentConfirm,
    maxCommentLength,
    setCommentConfirm,
    setCommentDraft,
    submitComment,
    deleteComment,
  } = useEntryComments({
    entries,
    commentMode,
    headerOnly,
    refreshKey,
    viewerId,
  });

  useEffect(() => {
    if (headerOnly) return;
    const entryIds = entries.map((entry) => entry.id);
    startTransition(() => {
      void loadEntryReactions(entryIds);
    });
  }, [entries, headerOnly, loadEntryReactions]);

  useEffect(() => {
    if (!photoPreviewUrl) return;
    return lockBodyScroll();
  }, [photoPreviewUrl]);

  const renderPlaceholderText = () => {
    if (isUserFeed && effectiveMonthFilter !== 'all') return 'Este usuario no tiene comidas publicas en este mes.';
    if (isUserFeed) return 'Este usuario no tiene comidas publicas todavia.';
    if (hasEntryFilter && effectiveMonthFilter !== 'all') return 'No tienes posts guardados en este mes.';
    if (hasEntryFilter) return 'No tienes posts guardados.';
    if (isCustomList && effectiveMonthFilter !== 'all') return 'Este grupo no tiene comidas publicas en este mes.';
    if (isCustomList) return 'Este grupo no tiene comidas publicas todavia.';
    if (privacyBlocked) return 'Este perfil es privado.';
    if (isReadOnly && activeTab === 'following') return 'Inicia sesión para ver a quienes sigues.';
    if (activeTab === 'following') return 'No hay entradas publicas de la gente a la que sigues.';
    return 'No hay comidas todavia en este feed.';
  };

  const renderLockedFeedPreview = () =>
    lockedPreview ?? (
      <div className="bw-locked-placeholder">
        <div className="bw-locked-row">
          <div className="bw-locked-pill" />
          <div className="bw-locked-pill" />
        </div>
        <div className="bw-locked-list">
          {['l1', 'l2', 'l3', 'l4'].map((k) => (
            <div className="bw-locked-list-item" key={`locked-feed-${k}`} />
          ))}
        </div>
      </div>
    );

  const shouldLockFollowing =
    isReadOnly && activeTab === 'following' && !focusUserId && !isCustomList && !hasEntryFilter;

  return (
    <section className="bw-feed">
      <FeedHeader
        hideHeader={hideHeader}
        isUserFeed={isUserFeed}
        isCustomList={isCustomList}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isReadOnly={isReadOnly}
        authNotice={authNotice}
        onAuthNoticeChange={setAuthNotice}
        effectiveMonthFilter={effectiveMonthFilter}
        onMonthFilterChange={setEffectiveMonthFilter}
        monthOptions={monthOptions}
      />

      {(() => {
        if (headerOnly && !hideHeader) return null;
        if (shouldLockFollowing) {
          return (
            <LockedContent
              title="Inicia sesión para ver a quienes sigues"
              message="Entra con tu cuenta para ver el feed de la gente a la que sigues."
              actionLabel="Iniciar sesión"
              onLogin={onRequireLogin ?? (() => {})}
              preview={renderLockedFeedPreview()}
              blurAmount={10}
            />
          );
        }
        return (
          <div className="bw-history-list">
        {loading && (
          <>
            <div className="bw-history-card bw-skeleton">
              <div className="bw-skeleton-line bw-skeleton-short" />
              <div className="bw-skeleton-line" />
              <div className="bw-skeleton-line" />
            </div>
            <div className="bw-history-card bw-skeleton">
              <div className="bw-skeleton-line bw-skeleton-short" />
              <div className="bw-skeleton-line" />
              <div className="bw-skeleton-line" />
            </div>
          </>
        )}
        {error && <p style={{ color: 'red', fontSize: 12 }}>{error}</p>}
        {!loading && !entries.length && <p style={{ fontSize: 13, opacity: 0.8 }}>{renderPlaceholderText()}</p>}

        {!loading &&
          entries.map((entry) => {
            const comments = entryComments[entry.id] ?? [];
            const commentCount = commentCounts[entry.id] ?? comments.length;
            const commentError = commentErrors[entry.id];
            const commentDraft = commentDrafts[entry.id] ?? '';
            const isCommentLoading = Boolean(commentLoading[entry.id]);
            const isCommentSubmitting = Boolean(commentActioning[entry.id]);
            const reactions = entryReactions[entry.id] ?? { likeCount: 0, liked: false, saved: false };
            const isLikePending = Boolean(pendingLikes[entry.id]);
            const isSavePending = Boolean(pendingSaves[entry.id]);

            return (
              <FeedEntryCard
                key={entry.id}
                entry={entry}
                viewerId={viewerId}
                isUserFeed={isUserFeed}
                isReadOnly={isReadOnly}
                showOwnerActions={showOwnerActions}
                reactions={reactions}
                isLikePending={isLikePending}
                isSavePending={isSavePending}
                onToggleLike={toggleLike}
                onToggleSave={toggleSave}
                onOpenProfile={onOpenProfile}
                onOpenEntry={onOpenEntry}
                onEditEntry={onEditEntry}
                onDeleteEntry={onDeleteEntry}
                onPreviewPhoto={(url) => setPhotoPreviewUrl(url)}
                commentMode={commentMode}
                comments={comments}
                commentCount={commentCount}
                commentLoading={isCommentLoading}
                commentError={commentError}
                commentDraft={commentDraft}
                commentSubmitting={isCommentSubmitting}
                maxCommentLength={maxCommentLength}
                onCommentDraftChange={(value) => setCommentDraft(entry.id, value)}
                onSubmitComment={() => submitComment(entry.id)}
                onRequestDeleteComment={(comment) => setCommentConfirm({ entryId: entry.id, comment })}
              />
            );
          })}
        {loadingMore && <div className="bw-feed-loading-more">Cargando mas...</div>}
        {!loading && !loadingMore && hasMore && <div ref={loadMoreRef} className="bw-feed-load-more" />}
      </div>
        );
      })()}

      {photoPreviewUrl && (
        <div className="bw-photo-viewer-backdrop" onClick={() => setPhotoPreviewUrl(null)}>
          <div className="bw-photo-viewer" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="bw-photo-viewer-close"
              onClick={() => setPhotoPreviewUrl(null)}
              aria-label="Cerrar imagen"
            >
              <Close />
            </button>
            <img src={photoPreviewUrl} alt="Foto de la entrada" />
          </div>
        </div>
      )}
      <CommentConfirmDialog
        commentConfirm={commentConfirm}
        onCancel={() => setCommentConfirm(null)}
        onConfirm={deleteComment}
        isProcessing={commentConfirm ? Boolean(commentActioning[commentConfirm.comment.id]) : false}
      />

    </section>
  );
}
