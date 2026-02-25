import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ModalBase } from './ModalBase';

type SlideConfirmDialogProps = {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isProcessing?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

export function SlideConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  isProcessing = false,
  onClose,
  onConfirm,
}: Readonly<SlideConfirmDialogProps>) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!open) {
      setValue(0);
    }
  }, [open]);

  const canConfirm = value >= 100 && !isProcessing;

  return (
    <ModalBase
      open={open}
      onClose={() => {
        if (isProcessing) return;
        onClose();
      }}
      backdropClassName="bw-confirm-backdrop"
      modalClassName="bw-confirm-modal"
    >
      <h3 className="bw-confirm-title">{title}</h3>
      {message ? <p className="bw-confirm-text">{message}</p> : null}

      <div className="bw-slide-confirm">
        <label htmlFor="bw-slide-confirm-input" className="bw-helper">
          Desliza de izquierda a derecha para confirmar
        </label>
        <input
          id="bw-slide-confirm-input"
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={(event) => setValue(Number(event.target.value))}
          disabled={isProcessing}
        />
      </div>

      <div className="bw-confirm-actions">
        <button
          className="bw-btn bw-btn-ghost"
          type="button"
          onClick={onClose}
          disabled={isProcessing}
        >
          {cancelLabel}
        </button>
        <button
          className="bw-btn bw-btn-danger"
          type="button"
          onClick={() => {
            if (!canConfirm) return;
            void onConfirm();
          }}
          disabled={!canConfirm}
        >
          {isProcessing ? 'Procesando...' : confirmLabel}
        </button>
      </div>
    </ModalBase>
  );
}
