import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BackButton } from './BackButton';

describe('BackButton', () => {
  it('lanza onClick al pulsar', () => {
    const onClick = vi.fn();
    render(<BackButton onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
