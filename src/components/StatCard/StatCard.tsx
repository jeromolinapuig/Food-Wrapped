import type { ReactNode } from 'react';
import './StatCard.css';

type StatCardProps = {
  icon: ReactNode;
  value: string;
  label: string;
  onClick?: () => void;
  isActive?: boolean;
};

export function StatCard({ icon, value, label, onClick, isActive }: StatCardProps) {
  const clickable = typeof onClick === 'function';
  const className = `bw-stat-card${clickable ? ' is-clickable' : ''}${isActive ? ' is-active' : ''}`;

  return (
    <article className={className} role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : -1} onClick={onClick}>
      <div className="bw-stat-icon">{icon}</div>
      <div className="bw-stat-value">{value}</div>
      <div className="bw-stat-label">{label}</div>
    </article>
  );
}
