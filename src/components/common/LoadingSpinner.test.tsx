import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingSpinner } from './LoadingSpinner';

describe('LoadingSpinner accessibility', () => {
  it('announces loading with the shared translated label', () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole('status', { name: 'common.loading' })).toBeInTheDocument();
  });

  it('keeps a busy button named and disabled until its action completes', () => {
    const { rerender } = render(<button disabled><LoadingSpinner inline label="Saving burger" /></button>);
    expect(screen.getByRole('button', { name: 'Saving burger' })).toBeDisabled();
    expect(screen.getByRole('status', { name: 'Saving burger' })).toBeInTheDocument();
    rerender(<button>Save burger</button>);
    expect(screen.getByRole('button', { name: 'Save burger' })).toBeEnabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
