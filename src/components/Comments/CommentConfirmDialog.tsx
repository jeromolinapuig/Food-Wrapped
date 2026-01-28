import { ConfirmDialog } from '../common/ConfirmDialog';
import type { EntryComment } from './types';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  return (
    <ConfirmDialog
      open={Boolean(commentConfirm)}
      onClose={onCancel}
      title={t('comments.deleteTitle')}
      message={t('comments.deleteConfirm')}
      actions={(
        <>
          <button
            className="bw-btn bw-btn-ghost"
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
          >
            {t('comments.cancel')}
          </button>
          <button
            className="bw-btn bw-btn-danger"
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? t('comments.deleting') : t('comments.delete')}
          </button>
        </>
      )}
    />
  );
}
