import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LockedContent, LoginOverlay } from './LoginOverlay';

describe('LoginOverlay', () => {
  it('usa texto por defecto y ejecuta login', () => {
    const onLogin = vi.fn();
    render(<LoginOverlay onLogin={onLogin} />);
    fireEvent.click(screen.getByRole('button', { name: 'loginOverlay.action' }));
    expect(onLogin).toHaveBeenCalledTimes(1);
  });

  it('LockedContent renderiza preview con blur y overlay', () => {
    render(
      <LockedContent onLogin={() => {}} preview={<div>preview</div>} blurAmount={8} />
    );
    expect(screen.getByText('preview')).toBeInTheDocument();
    expect(document.querySelector('.bw-locked-blur')).toHaveAttribute('style', expect.stringContaining('blur(8px)'));
    expect(screen.getByText('loginOverlay.title')).toBeInTheDocument();
  });
});
