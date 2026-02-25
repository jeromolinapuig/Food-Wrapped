import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StatCard } from './StatCard';

describe('StatCard', () => {
  it('renderiza valor y etiqueta', () => {
    render(<StatCard icon={<span>*</span>} value="12" label="total" />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('total')).toBeInTheDocument();
  });

  it('es clickable cuando recibe onClick', () => {
    const onClick = vi.fn();
    render(<StatCard icon={<span>*</span>} value="1" label="clickable" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
