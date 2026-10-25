import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BurgerRatingChart } from './BurgerRatingChart';

describe('Burger rating chart scale', () => {
  const column = (score: number) => within(screen.getByRole('list')).getByText(score.toLocaleString() + '★').parentElement!;

  it('places a 4.3 average between the 4 and 4.5 columns on a continuous horizontal scale', () => {
    const { container } = render(<BurgerRatingChart ratings={[4, 4, 4.5, 4.5, 4.5]} average={4.3} />);
    const marker = container.querySelector<HTMLElement>('.bw-catalog-average-marker')!;
    expect(parseFloat(column(4).style.left)).toBeCloseTo(75);
    expect(parseFloat(column(4.5).style.left)).toBeCloseTo(85);
    expect(parseFloat(marker.style.left)).toBeCloseTo(81);
    expect(screen.getByText('burgerCatalog.averageRating')).toBeInTheDocument();
    expect(marker).toHaveAttribute('aria-hidden', 'true');
  });

  it('uses the unrounded average, even when the summary displays one decimal', () => {
    const { container } = render(<BurgerRatingChart ratings={[4, 4.5]} average={4.25} />);
    const marker = container.querySelector<HTMLElement>('.bw-catalog-average-marker')!;
    expect(parseFloat(marker.style.left)).toBeCloseTo(80);
    expect(parseFloat(marker.style.left)).not.toBeCloseTo(81);
  });

  it('keeps numeric spacing when an existing score falls between half-star columns', () => {
    const { container } = render(<BurgerRatingChart ratings={[4.25, 4.25, 4.25, 4.25, 4.5]} average={4.3} />);
    expect(parseFloat(column(4.25).style.left)).toBeCloseTo(80);
    expect(parseFloat(column(4.5).style.left)).toBeCloseTo(85);
    expect(parseFloat(container.querySelector<HTMLElement>('.bw-catalog-average-marker')!.style.left)).toBeCloseTo(81);
  });

  it.each([0.5, 5])('aligns an endpoint average of %s with its score column', average => {
    const { container } = render(<BurgerRatingChart ratings={[average]} average={average} />);
    expect(container.querySelector<HTMLElement>('.bw-catalog-average-marker')!.style.left).toBe(column(average).style.left);
    expect(column(average).querySelector('.bw-catalog-bar-track')).toHaveStyle({ height: '100%' });
  });

  it('does not draw a mean for a burger without accessible ratings', () => {
    const { container } = render(<BurgerRatingChart ratings={[]} average={null} />);
    expect(container.querySelector('.bw-catalog-average-marker')).toBeNull();
    expect(screen.queryByText('burgerCatalog.averageRating')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
  });
});
