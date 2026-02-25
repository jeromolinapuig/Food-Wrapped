import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ModalBase } from './ModalBase';

describe('ModalBase', () => {
  it('no renderiza si open es false', () => {
    render(
      <ModalBase open={false} onClose={() => {}}>
        <div>modal-content</div>
      </ModalBase>
    );
    expect(screen.queryByText('modal-content')).not.toBeInTheDocument();
  });

  it('cierra al pulsar backdrop y no al pulsar contenido', () => {
    const onClose = vi.fn();
    render(
      <ModalBase onClose={onClose}>
        <button type="button">inside</button>
      </ModalBase>
    );

    fireEvent.click(screen.getByRole('button', { name: 'inside' }));
    expect(onClose).toHaveBeenCalledTimes(0);

    const backdrop = document.querySelector('.bw-modal-backdrop');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
