import { startTransition, useEffect, useRef, useState, type ReactNode } from 'react';
import { Close } from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import { lockBodyScroll } from '../../utils/scrollLock';
import { LockedContent } from '../common/LoginOverlay';
import { CommentConfirmDialog } from '../Comments/CommentConfirmDialog';
import { useEntryComments } from '../Comments/useEntryComments';
import type { CommentMode } from '../Comments/types';
import { FeedEntryCard } from './FeedEntryCard';
import { FeedHeader } from './FeedHeader';
import { TriedBurgerModal } from './TriedBurgerModal';
import { useBurgerWishlist } from './useBurgerWishlist';
import { useEntryReactions } from './useEntryReactions';
import { useFeedEntries } from './useFeedEntries';
import type {
  FeedEntry,
  FeedMeatTypeFilterSelection,
  FeedMonthFilterSelection,
  FeedPriceFilter,
  FeedPriceFilterRange,
  FeedPriceFilterSelection,
  FeedTab,
} from './types';
import { useTranslation } from 'react-i18next';
import { ZoomableImage } from '../common/ZoomableImage';
import '../../styles/shared.css';
import './FeedTabs.css';
import '../EntryCard/EntryCard.css';


type FeedTabsProps = {
  currentUserId: string | null;
  isReadOnly?: boolean;
  adminMode?: boolean;
  onRequireLogin?: () => void;
  refreshKey?: number;
  onOpenProfile?: (userId: string) => void;
  onOpenEntry?: (entryId: string) => void;
  focusUserId?: string | null;
  userIdsFilter?: string[] | null;
  entryIdsFilter?: string[] | null;
  restaurantIdFilter?: string | null;
  forcedTab?: FeedTab | null;
  ignorePrivacy?: boolean;
  onCountChange?: (count: number) => void;
  hideHeader?: boolean;
  hideMonthFilter?: boolean;
  headerOnly?: boolean;
  monthFilter?: FeedMonthFilterSelection;
  onMonthFilterChange?: (value: string) => void;
  priceFilter?: FeedPriceFilterSelection;
  priceFilterRanges?: Record<Exclude<FeedPriceFilter, 'all'>, FeedPriceFilterRange>;
  priceFilterCurrency?: string;
  convertPriceAmount?: (amount: number, fromCurrency: string, toCurrency: string) => number;
  meatTypeFilter?: FeedMeatTypeFilterSelection;
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
  adminMode = false,
  onRequireLogin,
  refreshKey = 0,
  onOpenProfile,
  onOpenEntry,
  focusUserId,
  userIdsFilter,
  entryIdsFilter,
  restaurantIdFilter,
  forcedTab,
  ignorePrivacy = false,
  onCountChange,
  hideHeader = false,
  hideMonthFilter = false,
  headerOnly = false,
  monthFilter,
  onMonthFilterChange,
  priceFilter,
  priceFilterRanges,
  priceFilterCurrency,
  convertPriceAmount,
  meatTypeFilter,
  showOwnerActions = false,
  onEditEntry,
  onDeleteEntry,
  commentMode = 'preview',
  lockedPreview,
}: Readonly<FeedTabsProps>) {
  const PHOTO_PREVIEW_HISTORY_KEY = 'bwPhotoPreviewOpen';
  const { t } = useTranslation();
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
    adminMode,
    focusUserId,
    userIdsFilter,
    entryIdsFilter,
    restaurantIdFilter,
    forcedTab,
    ignorePrivacy,
    onCountChange,
    headerOnly,
    hideHeader,
    refreshKey,
    monthFilter,
    onMonthFilterChange,
    priceFilter,
    priceFilterRanges,
    priceFilterCurrency,
    convertPriceAmount,
    meatTypeFilter,
  });
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [triedBurgerModal, setTriedBurgerModal] = useState<{
    entry: FeedEntry;
    initialRating: number | null;
    canDelete: boolean;
  } | null>(null);
  const photoPreviewHistoryEntryRef = useRef(false);
  const {
    entryReactions,
    pendingLikes,
    pendingSaves,
    loadEntryReactions,
    toggleLike,
    toggleSave,
  } = useEntryReactions({ viewerId, isReadOnly, onRequireLogin });
  const {
    burgerStatuses,
    pendingBurgerKeys,
    getBurgerKey,
    loadBurgerStatuses,
    toggleWantToTry,
    saveTriedBurger,
    deleteTriedBurger,
  } = useBurgerWishlist({ viewerId, isReadOnly, onRequireLogin });
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
    canComment: !isReadOnly && !adminMode,
    canModerateComments: adminMode,
  });

  useEffect(() => {
    if (headerOnly) return;
    const entryIds = entries.map((entry) => entry.id);
    startTransition(() => {
      void loadEntryReactions(entryIds);
      void loadBurgerStatuses(entries);
    });
  }, [entries, headerOnly, loadBurgerStatuses, loadEntryReactions]);

  useEffect(() => {
    const handleBurgerWishlistUpdated = () => {
      void loadBurgerStatuses(entries);
    };
    window.addEventListener('bw-burger-wishlist-updated', handleBurgerWishlistUpdated);
    return () => window.removeEventListener('bw-burger-wishlist-updated', handleBurgerWishlistUpdated);
  }, [entries, loadBurgerStatuses]);

  useEffect(() => {
    if (!photoPreviewUrl) return;
    return lockBodyScroll();
  }, [photoPreviewUrl]);

  useEffect(() => {
    const handlePopState = () => {
      if (!photoPreviewHistoryEntryRef.current) return;
      photoPreviewHistoryEntryRef.current = false;
      setPhotoPreviewUrl(null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleOpenPhotoPreview = (url: string) => {
    if (!photoPreviewHistoryEntryRef.current) {
      const nextState =
        window.history.state && typeof window.history.state === 'object'
          ? { ...window.history.state, [PHOTO_PREVIEW_HISTORY_KEY]: true }
          : { [PHOTO_PREVIEW_HISTORY_KEY]: true };
      window.history.pushState(nextState, '', window.location.href);
      photoPreviewHistoryEntryRef.current = true;
    }
    setPhotoPreviewUrl(url);
  };

  const handleClosePhotoPreview = () => {
    if (photoPreviewHistoryEntryRef.current) {
      const currentState =
        window.history.state && typeof window.history.state === 'object'
          ? { ...window.history.state }
          : {};
      delete (currentState as Record<string, unknown>)[PHOTO_PREVIEW_HISTORY_KEY];
      window.history.replaceState(currentState, '', window.location.href);
      photoPreviewHistoryEntryRef.current = false;
    }
    setPhotoPreviewUrl(null);
  };

  const renderPlaceholderText = () => {
    const isAllMonths = Array.isArray(effectiveMonthFilter)
      ? effectiveMonthFilter.includes('all')
      : effectiveMonthFilter === 'all';
    if (isUserFeed && !isAllMonths) return t('feed.noMonthUser', { defaultValue: 'No public posts this month.' });
    if (isUserFeed) return t('feed.noUserPosts', { defaultValue: 'No public posts yet.' });
    if (hasEntryFilter && !isAllMonths) return t('feed.noSavedMonth', { defaultValue: 'No saved posts this month.' });
    if (hasEntryFilter) return t('feed.noSaved', { defaultValue: 'No saved posts.' });
    if (isCustomList && !isAllMonths) return t('feed.noGroupMonth', { defaultValue: 'No group posts this month.' });
    if (isCustomList) return t('feed.noGroup', { defaultValue: 'No group posts yet.' });
    if (privacyBlocked) return t('feed.privateProfile', { defaultValue: 'This profile is private.' });
    if (isReadOnly && activeTab === 'following') return t('feedTabs.lockedFollowing');
    if (activeTab === 'following') return t('feed.noFollowingPosts', { defaultValue: 'No posts from people you follow.' });
    return t('feed.empty', { defaultValue: 'No posts in this feed yet.' });
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

  const renderPostSkeletons = () => (
    <>
      {Array.from({ length: 2 }).map((_, index) => (
        <article
          className="bw-history-card bw-feed-entry bw-feed-entry-skeleton bw-skeleton"
          key={`feed-skeleton-${index}`}
          aria-hidden="true"
        >
          <div className="bw-feed-entry-header">
            <div className="bw-feed-user">
              <div className="bw-feed-skeleton-avatar" />
              <div className="bw-feed-skeleton-user">
                <div className="bw-skeleton-line bw-skeleton-short" />
                <div className="bw-skeleton-line" />
              </div>
            </div>
            <div className="bw-feed-skeleton-date bw-skeleton-line" />
          </div>
          <div className="bw-feed-body">
            <div className="bw-skeleton-line bw-feed-skeleton-title" />
            <div className="bw-skeleton-line bw-skeleton-short" />
            <div className="bw-feed-skeleton-photo" />
            <div className="bw-feed-footer-row">
              <div className="bw-feed-skeleton-actions">
                <div className="bw-feed-skeleton-pill" />
                <div className="bw-feed-skeleton-pill" />
              </div>
              <div className="bw-feed-skeleton-price bw-skeleton-line" />
            </div>
          </div>
        </article>
      ))}
    </>
  );

  const shouldLockFollowing =
    isReadOnly && activeTab === 'following' && !focusUserId && !isCustomList && !hasEntryFilter;

  const handleReportEntry = async (entry: FeedEntry) => {
    if (!viewerId) return;
    await supabase
      .from('entry_reports')
      .upsert(
        {
          entry_id: entry.id,
          reporter_id: viewerId,
          reason: 'reportado desde feed',
          status: 'pending',
        },
        { onConflict: 'entry_id,reporter_id' }
      );
  };

  return (
    <section className="bw-feed">
      <FeedHeader
        hideHeader={hideHeader}
        isUserFeed={isUserFeed}
        isCustomList={isCustomList}
        hideMonthFilter={hideMonthFilter}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isReadOnly={isReadOnly}
        authNotice={authNotice}
        onAuthNoticeChange={setAuthNotice}
        effectiveMonthFilter={Array.isArray(effectiveMonthFilter) ? effectiveMonthFilter[0] ?? 'all' : effectiveMonthFilter}
        onMonthFilterChange={setEffectiveMonthFilter}
        monthOptions={monthOptions}
      />

      {(() => {
        if (headerOnly && !hideHeader) return null;
        if (shouldLockFollowing) {
          return (
            <LockedContent
              title={t('feedTabs.titleLocked')}
              message={t('feedTabs.lockedFollowing')}
              actionLabel={t('common.login')}
              onLogin={onRequireLogin ?? (() => {})}
              preview={renderLockedFeedPreview()}
              blurAmount={10}
            />
          );
        }
        return (
          <div className="bw-history-list">
        {loading && renderPostSkeletons()}
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
            const burgerKey = getBurgerKey(entry);

            return (
              <FeedEntryCard
                key={entry.id}
                entry={entry}
                viewerId={viewerId}
                isUserFeed={isUserFeed}
                isReadOnly={isReadOnly}
                showOwnerActions={showOwnerActions}
                adminMode={adminMode}
                reactions={reactions}
                isLikePending={isLikePending}
                isSavePending={isSavePending}
                onToggleLike={toggleLike}
                onToggleSave={toggleSave}
                burgerStatus={burgerKey ? burgerStatuses[burgerKey] : null}
                isBurgerActionPending={burgerKey ? Boolean(pendingBurgerKeys[burgerKey]) : false}
                onToggleWantToTry={(selectedEntry) => void toggleWantToTry(selectedEntry)}
                onOpenTriedModal={(selectedEntry) => {
                  const selectedKey = getBurgerKey(selectedEntry);
                  const selectedStatus = selectedKey ? burgerStatuses[selectedKey] : null;
                  setTriedBurgerModal({
                    entry: selectedEntry,
                    initialRating: selectedStatus?.rating ?? null,
                    canDelete: Boolean(selectedStatus?.canDeleteTried),
                  });
                }}
                onOpenProfile={onOpenProfile}
                onOpenEntry={onOpenEntry}
                onEditEntry={onEditEntry}
                onDeleteEntry={onDeleteEntry}
                onReportEntry={handleReportEntry}
                onPreviewPhoto={handleOpenPhotoPreview}
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
        {loadingMore && <div className="bw-feed-loading-more">{t('common.loading')}</div>}
        {!loading && !loadingMore && hasMore && <div ref={loadMoreRef} className="bw-feed-load-more" />}
      </div>
        );
      })()}

      {photoPreviewUrl && (
        <div className="bw-photo-viewer-backdrop" onClick={handleClosePhotoPreview}>
          <div className="bw-photo-viewer" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="bw-photo-viewer-close"
              onClick={handleClosePhotoPreview}
              aria-label="Cerrar imagen"
            >
              <Close />
            </button>
            <ZoomableImage src={photoPreviewUrl} alt="Foto de la entrada" />
          </div>
        </div>
      )}
      <CommentConfirmDialog
        commentConfirm={commentConfirm}
        onCancel={() => setCommentConfirm(null)}
        onConfirm={deleteComment}
        isProcessing={commentConfirm ? Boolean(commentActioning[commentConfirm.comment.id]) : false}
      />
      <TriedBurgerModal
        open={Boolean(triedBurgerModal)}
        entry={triedBurgerModal?.entry ?? null}
        initialRating={triedBurgerModal?.initialRating ?? null}
        canDelete={Boolean(triedBurgerModal?.canDelete)}
        onClose={() => setTriedBurgerModal(null)}
        onSave={saveTriedBurger}
        onDelete={deleteTriedBurger}
      />

    </section>
  );
}
