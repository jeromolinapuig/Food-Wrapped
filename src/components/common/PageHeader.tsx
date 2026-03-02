import type { ReactNode } from 'react';
import { Avatar } from './Avatar';

type PageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  logoSrc?: string;
  logoAlt?: string;
  logoVariant?: 'square' | 'avatar';
  logoFrameKey?: 'gold' | 'silver' | 'bronze' | null;
};

export function PageHeader({
  title,
  subtitle,
  leading,
  actions,
  logoSrc = '/logo.png',
  logoAlt = 'My Bite Story',
  logoVariant = 'square',
  logoFrameKey = null,
}: Readonly<PageHeaderProps>) {
  const iconClassName = ['bw-header-icon', logoVariant === 'avatar' ? 'is-avatar' : null]
    .filter(Boolean)
    .join(' ');

  return (
    <header className="bw-header">
      {leading}
      <div className={iconClassName}>
        {logoVariant === 'avatar' ? (
          <Avatar url={logoSrc} alt={logoAlt} frameKey={logoFrameKey} className="bw-header-avatar-core" />
        ) : (
          <img src={logoSrc} alt={logoAlt} />
        )}
      </div>
      <div style={{ flex: 1 }}>
        <h1 className="bw-title">{title}</h1>
        {subtitle ? <p className="bw-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="bw-header-actions">{actions}</div> : null}
    </header>
  );
}
