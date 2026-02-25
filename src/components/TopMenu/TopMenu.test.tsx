import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TopMenu } from './TopMenu';

vi.mock('@mui/icons-material', () => ({
  DarkMode: () => null,
  LightMode: () => null,
}));

describe('TopMenu', () => {
  it('muestra aria-label según tema y permite alternar', () => {
    const onToggleTheme = vi.fn();
    render(<TopMenu theme="light" onToggleTheme={onToggleTheme} />);
    const button = screen.getByRole('button', { name: 'Cambiar a tema oscuro' });
    fireEvent.click(button);
    expect(onToggleTheme).toHaveBeenCalledTimes(1);
  });
});
