import type { ReactNode } from 'react';

type ModalBaseProps = {
  open?: boolean;
  onClose: () => void;
  children: ReactNode;
  backdropClassName?: string;
  modalClassName?: string;
};

export function ModalBase({
  open = true,
  onClose,
  children,
  backdropClassName = 'bw-modal-backdrop',
  modalClassName = 'bw-modal',
}: Readonly<ModalBaseProps>) {
  if (!open) return null;

  return (
    <div className={backdropClassName} onClick={onClose}>
      <div className={modalClassName} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
