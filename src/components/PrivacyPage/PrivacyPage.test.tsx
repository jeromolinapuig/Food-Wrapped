import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PrivacyPage } from './PrivacyPage';

describe('PrivacyPage', () => {
  it('muestra textos legales principales y contacto', () => {
    render(<PrivacyPage />);
    expect(screen.getByText('Politica de privacidad')).toBeInTheDocument();
    expect(screen.getByText(/Datos que recopilamos/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'burgerwrapped@gmail.com' })).toHaveAttribute(
      'href',
      'mailto:burgerwrapped@gmail.com'
    );
  });
});
