import type { ReactNode } from 'react';
import { ModalBase } from './ModalBase';

type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  message?: ReactNode;
  actions: ReactNode;
  backdropClassName?: string;
  modalClassName?: string;
};

export function ConfirmDialog({
  open,
  onClose,
  title,
  message,
  actions,
  backdropClassName,
  modalClassName = 'bw-confirm-modal',
}: Readonly<ConfirmDialogProps>) {
  return (
    <ModalBase
      open={open}
      onClose={onClose}
      backdropClassName={backdropClassName ?? 'bw-confirm-backdrop'}
      modalClassName={modalClassName}
    >
      <h3 className="bw-confirm-title">{title}</h3>
      {message ? <p className="bw-confirm-text">{message}</p> : null}
      <div className="bw-confirm-actions">{actions}</div>
    </ModalBase>
  );
}
