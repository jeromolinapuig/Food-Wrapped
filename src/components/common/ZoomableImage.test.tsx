import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ZoomableImage } from './ZoomableImage';

describe('ZoomableImage', () => {
  it('permite hacer reset de zoom', () => {
    render(<ZoomableImage src="/photo.jpg" alt="foto" />);
    const image = screen.getByRole('img', { name: 'foto' });
    const container = image.closest('.bw-photo-zoomable');
    expect(container).toBeTruthy();

    fireEvent.pointerDown(container as Element, { pointerId: 1, clientX: 10, clientY: 10, pointerType: 'touch' });
    fireEvent.pointerDown(container as Element, { pointerId: 2, clientX: 60, clientY: 10, pointerType: 'touch' });
    fireEvent.pointerMove(container as Element, { pointerId: 2, clientX: 120, clientY: 10, pointerType: 'touch' });

    const reset = screen.getByRole('button', { name: 'Restablecer zoom' });
    expect(reset).toBeInTheDocument();
    fireEvent.click(reset);
    expect(screen.queryByRole('button', { name: 'Restablecer zoom' })).not.toBeInTheDocument();
  });
});
