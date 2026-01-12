import type { ReactNode } from 'react';

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: Readonly<AppShellProps>) {
  return (
    <div className="bw-app-root">
      <div className="bw-shell">{children}</div>
    </div>
  );
}
