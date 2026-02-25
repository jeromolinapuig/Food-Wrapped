import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('muestra contenido y propaga cierre por backdrop', () => {
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        open
        onClose={onClose}
        title="titulo"
        message="mensaje"
        actions={<button type="button">accion</button>}
      />
    );

    expect(screen.getByText('titulo')).toBeInTheDocument();
    expect(screen.getByText('mensaje')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'accion' }));
    expect(onClose).toHaveBeenCalledTimes(0);
    fireEvent.click(document.querySelector('.bw-confirm-backdrop') as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
