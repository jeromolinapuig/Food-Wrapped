import type { ReactNode } from 'react';
import './LoginOverlay.css';

type LoginOverlayProps = {
  title?: string;
  actionLabel?: string;
  onLogin: () => void;
  message?: string;
};

type LockedContentProps = LoginOverlayProps & {
  preview?: ReactNode;
  children?: ReactNode;
  blurAmount?: number;
};

export function LoginOverlay({
  title = 'Inicia sesión',
  actionLabel = 'Iniciar sesión',
  onLogin,
  message,
}: Readonly<LoginOverlayProps>) {
  return (
    <div className="bw-locked-overlay">
      <div className="bw-locked-card">
        <p className="bw-locked-eyebrow">Modo invitado</p>
        <h3 className="bw-locked-title">{title}</h3>
        {message ? <p className="bw-locked-message">{message}</p> : null}
        <div className="bw-locked-actions">
          <button type="button" className="bw-btn bw-btn-primary" onClick={onLogin}>
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function LockedContent({
  preview,
  children,
  blurAmount = 10,
  ...overlayProps
}: Readonly<LockedContentProps>) {
  return (
    <div className="bw-locked-container">
      <div className="bw-locked-blur" style={{ filter: `blur(${blurAmount}px)` }}>
        {preview ?? children}
      </div>
      <LoginOverlay {...overlayProps} />
    </div>
  );
}
