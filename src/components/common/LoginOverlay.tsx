import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
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
  title,
  actionLabel,
  onLogin,
  message,
}: Readonly<LoginOverlayProps>) {
  const { t } = useTranslation();
  const effectiveTitle = title ?? t('loginOverlay.title');
  const effectiveAction = actionLabel ?? t('loginOverlay.action');
  return (
    <div className="bw-locked-overlay">
      <div className="bw-locked-card">
        <p className="bw-locked-eyebrow">{t('locked.section', { defaultValue: 'Guest mode' })}</p>
        <h3 className="bw-locked-title">{effectiveTitle}</h3>
        {message ? <p className="bw-locked-message">{message}</p> : null}
        <div className="bw-locked-actions">
          <button type="button" className="bw-btn bw-btn-primary" onClick={onLogin}>
            {effectiveAction}
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
