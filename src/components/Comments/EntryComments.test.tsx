import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EntryComments } from './EntryComments';

vi.mock('@mui/icons-material', () => ({
  DeleteOutline: () => null,
}));

vi.mock('../common/Avatar', () => ({
  Avatar: () => <span>avatar</span>,
}));

const baseComment = {
  id: 'c1',
  entryId: 'entry-1',
  body: 'Great burger',
  userId: 'author-1',
  username: 'author',
  displayName: 'Author',
  avatarUrl: null,
  avatarFrame: null,
  createdAt: '2026-02-01T10:00:00.000Z',
};

describe('EntryComments functional flows', () => {
  it('shows login message when viewer is not authenticated', () => {
    render(
      <EntryComments
        variant="card"
        entryUserId="entry-owner"
        viewerId={null}
        commentMode="full"
        comments={[baseComment]}
        commentCount={1}
        isLoading={false}
        error={null}
        draft=""
        isSubmitting={false}
        maxLength={500}
        onDraftChange={() => {}}
        onSubmit={() => {}}
        onRequestDelete={() => {}}
      />
    );

    expect(screen.getByText('comments.loginToComment')).toBeInTheDocument();
  });

  it('allows viewer to type and submit a comment', async () => {
    const user = userEvent.setup();
    const onDraftChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <EntryComments
        variant="card"
        entryUserId="entry-owner"
        viewerId="viewer-1"
        commentMode="full"
        comments={[]}
        commentCount={0}
        isLoading={false}
        error={null}
        draft="new comment"
        isSubmitting={false}
        maxLength={500}
        onDraftChange={onDraftChange}
        onSubmit={onSubmit}
        onRequestDelete={() => {}}
      />
    );

    await user.type(screen.getByRole('textbox'), '!');
    expect(onDraftChange).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'comments.comment' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('lets comment owner request deletion from inline mode', async () => {
    const user = userEvent.setup();
    const onRequestDelete = vi.fn();

    render(
      <EntryComments
        variant="inline"
        entryUserId="entry-owner"
        viewerId="author-1"
        commentMode="preview"
        comments={[baseComment]}
        commentCount={1}
        isLoading={false}
        error={null}
        draft=""
        isSubmitting={false}
        maxLength={500}
        onDraftChange={() => {}}
        onSubmit={() => {}}
        onRequestDelete={onRequestDelete}
      />
    );

    await user.click(screen.getByRole('button', { name: 'comments.delete' }));
    expect(onRequestDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }));
  });
});
