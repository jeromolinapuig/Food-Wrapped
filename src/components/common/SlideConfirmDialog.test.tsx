import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SlideConfirmDialog } from './SlideConfirmDialog';

describe('SlideConfirmDialog', () => {
  it('requires a new slide after closing and reopening the confirmation', () => {
    const props = { title: 'Eliminar', onClose: vi.fn(), onConfirm: vi.fn() };
    const { rerender } = render(<SlideConfirmDialog {...props} open />);

    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
    fireEvent.change(screen.getByRole('slider'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(props.onConfirm).toHaveBeenCalledOnce();

    rerender(<SlideConfirmDialog {...props} open={false} />);
    rerender(<SlideConfirmDialog {...props} open />);
    expect(screen.getByRole('slider')).toHaveValue('0');
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
  });
});
