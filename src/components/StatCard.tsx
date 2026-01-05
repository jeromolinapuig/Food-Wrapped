import type { ReactNode } from 'react';

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
