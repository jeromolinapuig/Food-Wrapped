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

  const content = (
    <>
      <div className="bw-stat-icon">{icon}</div>
      <div className="bw-stat-value">{value}</div>
      <div className="bw-stat-label">{label}</div>
    </>
  );

  return clickable ? (
    <button type="button" className={className} onClick={onClick} aria-pressed={isActive}>{content}</button>
  ) : (
    <article className={className}>{content}</article>
  );
}
