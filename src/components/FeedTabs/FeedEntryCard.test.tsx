import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedEntryCard } from './FeedEntryCard';
import type { FeedEntry } from './types';

const navigateMock = vi.fn();
const downloadMock = vi.fn().mockResolvedValue(undefined);
const clipboardWriteTextMock = vi.fn().mockResolvedValue(undefined);
const nativeShareMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@mui/icons-material', () => ({
  Bookmark: () => null,
  ChatBubbleOutline: () => null,
  CheckCircleOutline: () => null,
  ChevronRight: () => null,
  Delete: () => null,
  DeleteOutline: () => null,
  Edit: () => null,
  Favorite: () => null,
  FavoriteBorder: () => null,
  Image: () => null,
  Link: () => null,
  MoreVert: () => null,
  OpenInFull: () => null,
  PlaylistAdd: () => null,
  Share: () => null,
  Star: () => null,
  StarBorder: () => null,
  StarHalf: () => null,
  StorefrontOutlined: () => null,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@mui/material', () => ({
  IconButton: ({ children, ...props }: { children: ReactNode }) => <button type="button" {...props}>{children}</button>,
  Menu: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null),
  MenuItem: ({ onClick, children, disabled }: { onClick?: () => void; children: ReactNode; disabled?: boolean }) => (
    <button type="button" disabled={disabled} onClick={onClick}>{children}</button>
  ),
  ListItemIcon: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  ListItemText: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock('../../context/PreferencesContext', () => ({
  usePreferences: () => ({
    formatCurrency: (amount: number) => `EUR ${amount.toFixed(2)}`,
  }),
}));

vi.mock('../../utils/downloadEntryPostImage', () => ({
  downloadEntryPostImage: (...args: unknown[]) => downloadMock(...args),
}));

vi.mock('../Comments/EntryComments', () => ({
  EntryComments: ({ variant }: { variant: string }) => <div>comments-{variant}</div>,
}));

const baseEntry: FeedEntry = {
  id: 'e1',
  userId: 'u1',
  username: 'user1',
  displayName: 'User 1',
  avatarUrl: null,
  avatarFrame: null,
  datetime: '2026-02-01T10:00:00.000Z',
  restaurantName: 'Burger Place',
  burgerName: 'Smash',
  rating: 4.5,
  price: 12,
  currency: 'EUR',
  additionalNotes: 'nota',
  isBurger: true,
  meatType: 'beef',
  burgerOrigin: 'restaurant',
  ingredients: null,
  photoUrl: 'https://example.com/p.jpg',
  restaurantId: 'r1',
  burgerId: 'b1',
};

describe('FeedEntryCard', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    downloadMock.mockClear();
    clipboardWriteTextMock.mockClear();
    nativeShareMock.mockClear();
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWriteTextMock },
    });
    Object.defineProperty(window.navigator, 'share', {
      configurable: true,
      value: nativeShareMock,
    });
  });

  it('mantiene accesibles las acciones de perfil, restaurante y foto', () => {
    const onOpenProfile = vi.fn();
    const onPreviewPhoto = vi.fn();
    render(
      <FeedEntryCard
        entry={baseEntry}
        viewerId="u2"
        isUserFeed={false}
        isReadOnly={false}
        showOwnerActions={false}
        reactions={{ likeCount: 0, liked: false, saved: false }}
        isLikePending={false}
        isSavePending={false}
        onToggleLike={() => {}}
        onToggleSave={() => {}}
        onOpenProfile={onOpenProfile}
        onPreviewPhoto={onPreviewPhoto}
        commentMode="preview"
        comments={[]}
        commentCount={0}
        commentLoading={false}
        commentError={null}
        commentDraft=""
        commentSubmitting={false}
        maxCommentLength={250}
        onCommentDraftChange={() => {}}
        onSubmitComment={() => {}}
        onRequestDeleteComment={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'feed.viewProfile' }));
    fireEvent.click(screen.getByRole('button', { name: 'feed.viewRestaurant' }));
    fireEvent.click(screen.getByRole('button', { name: 'common.viewPhoto' }));

    expect(onOpenProfile).toHaveBeenCalledWith('u1');
    expect(navigateMock).toHaveBeenCalledWith('/search', expect.objectContaining({
      state: expect.objectContaining({ selectedRestaurantId: 'r1' }),
    }));
    expect(onPreviewPhoto).toHaveBeenCalledWith('https://example.com/p.jpg');
  });

  it('lanza acciones de like, comentarios y owner actions', () => {
    const onToggleLike = vi.fn();
    const onOpenEntry = vi.fn();
    const onEditEntry = vi.fn();
    const onDeleteEntry = vi.fn();
    render(
      <FeedEntryCard
        entry={baseEntry}
        viewerId="u1"
        isUserFeed={false}
        isReadOnly={false}
        showOwnerActions
        reactions={{ likeCount: 2, liked: false, saved: false }}
        isLikePending={false}
        isSavePending={false}
        onToggleLike={onToggleLike}
        onToggleSave={() => {}}
        onOpenEntry={onOpenEntry}
        onEditEntry={onEditEntry}
        onDeleteEntry={onDeleteEntry}
        onPreviewPhoto={() => {}}
        commentMode="preview"
        comments={[]}
        commentCount={0}
        commentLoading={false}
        commentError={null}
        commentDraft=""
        commentSubmitting={false}
        maxCommentLength={250}
        onCommentDraftChange={() => {}}
        onSubmitComment={() => {}}
        onRequestDeleteComment={() => {}}
      />
    );

    fireEvent.click(screen.getByTitle('feed.like'));
    fireEvent.click(screen.getByRole('button', { name: 'comments.viewComments' }));
    fireEvent.click(screen.getByRole('button', { name: 'common.edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));
    expect(onToggleLike).toHaveBeenCalledWith('e1');
    expect(onOpenEntry).toHaveBeenCalledWith('e1');
    expect(onEditEntry).toHaveBeenCalledWith(baseEntry);
    expect(onDeleteEntry).toHaveBeenCalledWith(baseEntry);
  });

  it('abre opciones de compartir y comparte la foto del post', async () => {
    render(
      <FeedEntryCard
        entry={baseEntry}
        viewerId="u1"
        isUserFeed={false}
        isReadOnly={false}
        showOwnerActions={false}
        reactions={{ likeCount: 0, liked: false, saved: false }}
        isLikePending={false}
        isSavePending={false}
        onToggleLike={() => {}}
        onToggleSave={() => {}}
        onPreviewPhoto={() => {}}
        commentMode="preview"
        comments={[]}
        commentCount={0}
        commentLoading={false}
        commentError={null}
        commentDraft=""
        commentSubmitting={false}
        maxCommentLength={250}
        onCommentDraftChange={() => {}}
        onSubmitComment={() => {}}
        onRequestDeleteComment={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Share post' }));
    expect(screen.getByRole('button', { name: 'Share link' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Share photo' }));
    await waitFor(() => {
      expect(downloadMock).toHaveBeenCalledTimes(1);
    });
  });

  it('permite compartir enlace pero no foto en posts de otra persona', () => {
    render(
      <FeedEntryCard
        entry={baseEntry}
        viewerId="u2"
        isUserFeed={false}
        isReadOnly={false}
        showOwnerActions={false}
        reactions={{ likeCount: 0, liked: false, saved: false }}
        isLikePending={false}
        isSavePending={false}
        onToggleLike={() => {}}
        onToggleSave={() => {}}
        onPreviewPhoto={() => {}}
        commentMode="preview"
        comments={[]}
        commentCount={0}
        commentLoading={false}
        commentError={null}
        commentDraft=""
        commentSubmitting={false}
        maxCommentLength={250}
        onCommentDraftChange={() => {}}
        onSubmitComment={() => {}}
        onRequestDeleteComment={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Share post' }));
    expect(screen.getByRole('button', { name: 'Share link' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Share photo' })).not.toBeInTheDocument();
  });

  it('copia el enlace y abre el selector nativo al compartir enlace', async () => {
    render(
      <FeedEntryCard
        entry={baseEntry}
        viewerId="u2"
        isUserFeed={false}
        isReadOnly={false}
        showOwnerActions={false}
        reactions={{ likeCount: 0, liked: false, saved: false }}
        isLikePending={false}
        isSavePending={false}
        onToggleLike={() => {}}
        onToggleSave={() => {}}
        onPreviewPhoto={() => {}}
        commentMode="preview"
        comments={[]}
        commentCount={0}
        commentLoading={false}
        commentError={null}
        commentDraft=""
        commentSubmitting={false}
        maxCommentLength={250}
        onCommentDraftChange={() => {}}
        onSubmitComment={() => {}}
        onRequestDeleteComment={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Share post' }));
    fireEvent.click(screen.getByRole('button', { name: 'Share link' }));

    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledWith('http://localhost:3000/posts/e1');
      expect(nativeShareMock).toHaveBeenCalledWith({
        title: 'Share post',
        url: 'http://localhost:3000/posts/e1',
      });
    });
  });
});
