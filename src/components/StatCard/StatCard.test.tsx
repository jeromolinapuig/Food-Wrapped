import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StatCard } from './StatCard';

describe('StatCard', () => {
  it('renderiza valor y etiqueta', () => {
    render(<StatCard icon={<span>*</span>} value="12" label="total" />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('total')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('es clickable cuando recibe onClick', () => {
    const onClick = vi.fn();
    render(<StatCard icon={<span>*</span>} value="1" label="clickable" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('se activa una sola vez con Enter y espacio y conserva foco', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<StatCard icon={<span>*</span>} value="1" label="clickable" onClick={onClick} />);
    const button = screen.getByRole('button');
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});
