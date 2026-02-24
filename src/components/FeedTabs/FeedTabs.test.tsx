import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedTabs } from './FeedTabs';

type FeedEntry = {
  id: string;
  user_id: string;
};

const { feedState, feedReactionsState, feedCommentsState } = vi.hoisted(() => ({
  feedState: {
    activeTab: 'global',
    setActiveTab: vi.fn(),
    entries: [] as FeedEntry[],
    loading: false,
    loadingMore: false,
    hasMore: false,
    error: null as string | null,
    privacyBlocked: false,
    monthOptions: [] as { value: string; label: string }[],
    effectiveMonthFilter: 'all',
    setEffectiveMonthFilter: vi.fn(),
    authNotice: null as string | null,
    setAuthNotice: vi.fn(),
    loadMoreRef: vi.fn(),
    viewerId: 'viewer-1',
    isUserFeed: false,
    isCustomList: false,
    hasEntryFilter: false,
  },
  feedReactionsState: {
    entryReactions: {},
    pendingLikes: {},
    pendingSaves: {},
    loadEntryReactions: vi.fn(),
    toggleLike: vi.fn(),
    toggleSave: vi.fn(),
  },
  feedCommentsState: {
    entryComments: {},
    commentCounts: {},
    commentDrafts: {},
    commentLoading: {},
    commentErrors: {},
    commentActioning: {},
    commentConfirm: null,
    maxCommentLength: 500,
    setCommentConfirm: vi.fn(),
    setCommentDraft: vi.fn(),
    submitComment: vi.fn(),
    deleteComment: vi.fn(),
  },
}));

vi.mock('@mui/icons-material', () => ({
  Close: () => null,
}));

vi.mock('./useFeedEntries', () => ({
  useFeedEntries: () => feedState,
}));

vi.mock('./useEntryReactions', () => ({
  useEntryReactions: () => feedReactionsState,
}));

vi.mock('../Comments/useEntryComments', () => ({
  useEntryComments: () => feedCommentsState,
}));

vi.mock('./FeedHeader', () => ({
  FeedHeader: () => <div>feed-header</div>,
}));

vi.mock('./FeedEntryCard', () => ({
  FeedEntryCard: ({ entry, onPreviewPhoto }: { entry: FeedEntry; onPreviewPhoto: (url: string) => void }) => (
    <div>
      <span>{`entry-${entry.id}`}</span>
      <button type="button" onClick={() => onPreviewPhoto(`https://img/${entry.id}.jpg`)}>
        preview-photo-{entry.id}
      </button>
    </div>
  ),
}));

vi.mock('../common/LoginOverlay', () => ({
  LockedContent: ({ onLogin }: { onLogin: () => void }) => (
    <div>
      <span>locked-feed-content</span>
      <button type="button" onClick={onLogin}>locked-login</button>
    </div>
  ),
}));

vi.mock('../Comments/CommentConfirmDialog', () => ({
  CommentConfirmDialog: () => null,
}));

vi.mock('../common/ZoomableImage', () => ({
  ZoomableImage: ({ src }: { src: string }) => <div>{`zoomable-${src}`}</div>,
}));

vi.mock('../../utils/scrollLock', () => ({
  lockBodyScroll: () => () => {},
}));

describe('FeedTabs functional flows', () => {
  beforeEach(() => {
    feedState.activeTab = 'global';
    feedState.entries = [];
    feedState.loading = false;
    feedState.error = null;
    feedState.isUserFeed = false;
    feedState.privacyBlocked = false;
    feedState.isCustomList = false;
    feedState.hasEntryFilter = false;
  });

  it('locks following tab for read-only users and triggers login callback', async () => {
    const user = userEvent.setup();
    const onRequireLogin = vi.fn();
    feedState.activeTab = 'following';

    render(<FeedTabs currentUserId={null} isReadOnly onRequireLogin={onRequireLogin} />);

    expect(screen.getByText('locked-feed-content')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'locked-login' }));
    expect(onRequireLogin).toHaveBeenCalledTimes(1);
  });

  it('renders empty placeholder when there are no feed entries', () => {
    render(<FeedTabs currentUserId="viewer-1" />);
    expect(screen.getByText('No posts in this feed yet.')).toBeInTheDocument();
  });

  it('opens and closes photo preview from an entry card', async () => {
    const user = userEvent.setup();
    feedState.entries = [{ id: 'entry-1', user_id: 'author-1' }];

    render(<FeedTabs currentUserId="viewer-1" />);
    await user.click(screen.getByRole('button', { name: 'preview-photo-entry-1' }));

    expect(screen.getByText('zoomable-https://img/entry-1.jpg')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cerrar imagen' }));
    expect(screen.queryByText('zoomable-https://img/entry-1.jpg')).not.toBeInTheDocument();
  });
});
