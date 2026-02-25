import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppShell } from './AppShell';

describe('AppShell', () => {
  it('renderiza el contenedor shell con su contenido', () => {
    render(
      <AppShell>
        <div>contenido</div>
      </AppShell>
    );

    expect(screen.getByText('contenido')).toBeInTheDocument();
    expect(document.querySelector('.bw-app-root')).toBeTruthy();
    expect(document.querySelector('.bw-shell')).toBeTruthy();
  });
});
