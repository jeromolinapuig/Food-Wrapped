import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UserCard } from './UserCard';

describe('UserCard', () => {
  it('renderiza handle y acción en modo normal', () => {
    render(
      <UserCard
        handle="jeronimo"
        action={<button type="button">seguir</button>}
      />
    );
    expect(screen.getByText('@jeronimo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'seguir' })).toBeInTheDocument();
  });

  it('en modo asButton llama onClick', () => {
    const onClick = vi.fn();
    render(<UserCard handle="user" asButton onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: /@user/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
