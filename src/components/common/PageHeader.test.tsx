import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('renderiza título, subtítulo, logo y acciones', () => {
    render(
      <PageHeader
        title="Titulo"
        subtitle="Subtitulo"
        logoSrc="/img.png"
        logoAlt="logo-alt"
        actions={<button type="button">accion</button>}
      />
    );

    expect(screen.getByText('Titulo')).toBeInTheDocument();
    expect(screen.getByText('Subtitulo')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'logo-alt' })).toHaveAttribute('src', '/img.png');
    expect(screen.getByRole('button', { name: 'accion' })).toBeInTheDocument();
  });
});
