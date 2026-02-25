import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LandingPage } from './LandingPage';

describe('LandingPage', () => {
  it('renderiza contenido principal y dispara login desde CTA', () => {
    const onLogin = vi.fn();
    render(<LandingPage onLogin={onLogin} />);

    expect(screen.getByRole('heading', { name: 'Burger Wrapped' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'landing.cta' }));
    expect(onLogin).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'landing.privacy' })).toHaveAttribute('href', '/privacy');
  });
});
