import type { ReactNode } from 'react';
import '../styles/stat-card.css';

type StatCardProps = {
  icon: ReactNode;
  value: string;
  label: string;
};

export function StatCard({ icon, value, label }: StatCardProps) {
  return (
    <article className="bw-stat-card">
      <div className="bw-stat-icon">{icon}</div>
      <div className="bw-stat-value">{value}</div>
      <div className="bw-stat-label">{label}</div>
    </article>
  );
}
