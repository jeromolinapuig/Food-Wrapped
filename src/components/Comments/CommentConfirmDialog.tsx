import { ConfirmDialog } from '../common/ConfirmDialog';
import type { EntryComment } from './types';

type CommentConfirm = {
  entryId: string;
  comment: EntryComment;
};

type CommentConfirmDialogProps = {
  commentConfirm: CommentConfirm | null;
  onCancel: () => void;
  onConfirm: () => void;
  isProcessing: boolean;
};

export function CommentConfirmDialog({
  commentConfirm,
  onCancel,
  onConfirm,
  isProcessing,
}: Readonly<CommentConfirmDialogProps>) {
  return (
    <ConfirmDialog
      open={Boolean(commentConfirm)}
      onClose={onCancel}
      title="Eliminar comentario"
      actions={(
        <>
          <button
            className="bw-btn bw-btn-ghost"
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
          >
            Cancelar
          </button>
          <button
            className="bw-btn bw-btn-danger"
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? 'Eliminando...' : 'Eliminar comentario'}
          </button>
        </>
      )}
    />
  );
}
