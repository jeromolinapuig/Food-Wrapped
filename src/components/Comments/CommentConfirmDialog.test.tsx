import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommentConfirmDialog } from './CommentConfirmDialog';

describe('CommentConfirmDialog', () => {
  it('abre confirmación y permite cancelar/confirmar', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <CommentConfirmDialog
        commentConfirm={{
          entryId: 'e1',
          comment: {
            id: 'c1',
            entryId: 'e1',
            userId: 'u1',
            body: 'hola',
            createdAt: '',
            username: 'u',
            displayName: null,
            avatarUrl: null,
          },
        }}
        onCancel={onCancel}
        onConfirm={onConfirm}
        isProcessing={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'comments.cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'comments.delete' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
