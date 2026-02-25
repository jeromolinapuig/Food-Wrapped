import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('muestra imagen cuando hay url', () => {
    render(<Avatar url="https://example.com/avatar.jpg" alt="avatar-user" loading="lazy" />);
    const image = screen.getByRole('img', { name: 'avatar-user' });
    expect(image).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    expect(image).toHaveAttribute('loading', 'lazy');
  });

  it('muestra placeholder cuando no hay url', () => {
    render(<Avatar initial="A" />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(document.querySelector('.bw-avatar-placeholder')).toBeTruthy();
  });
});
