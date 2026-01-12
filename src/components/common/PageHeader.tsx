import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  logoSrc?: string;
  logoAlt?: string;
};

export function PageHeader({
  title,
  subtitle,
  leading,
  actions,
  logoSrc = '/logo.png',
  logoAlt = 'My Bite Story',
}: Readonly<PageHeaderProps>) {
  return (
    <header className="bw-header">
      {leading}
      <div className="bw-header-icon">
        <img src={logoSrc} alt={logoAlt} />
      </div>
      <div style={{ flex: 1 }}>
        <h1 className="bw-title">{title}</h1>
        {subtitle ? <p className="bw-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="bw-header-actions">{actions}</div> : null}
    </header>
  );
}
