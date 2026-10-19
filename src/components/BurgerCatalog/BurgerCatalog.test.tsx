import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BurgerExplore } from './BurgerCatalog';

const { fromMock, navigateMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock('../../lib/supabaseClient', () => ({ supabase: { from: fromMock } }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useParams: () => ({}),
}));

describe('BurgerExplore', () => {
  let onIntersection: IntersectionObserverCallback;
  const disconnect = vi.fn();

  beforeEach(() => {
    const entries = Array.from({ length: 30 }, (_, index) => ({
      id: `e${index}`, user_id: 'user', burger_id: `b${index}`, restaurant_id: 'restaurant',
      rating: index === 29 ? 5 : 4, photo_url: null, datetime: '2026-10-01T12:00:00Z',
      restaurant: { name: 'Burger Bar' }, burger: { name: `Burger ${String(index).padStart(2, '0')}` },
    }));
    const query = {
      select: vi.fn(() => query), eq: vi.fn(() => query), not: vi.fn(() => query),
      is: vi.fn(() => query), order: vi.fn(() => query),
      range: vi.fn(() => query),
      then: (resolve: (result: { data: typeof entries; error: null }) => unknown) =>
        Promise.resolve({ data: entries, error: null }).then(resolve),
    };
    fromMock.mockReturnValue(query);
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { onIntersection = callback; }
      observe = vi.fn();
      disconnect = disconnect;
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  const revealMore = () => act(() => {
    onIntersection([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
  });

  it('reveals 24 burgers at a time and resets when the external search changes', async () => {
    const { rerender } = render(<BurgerExplore hideSearch />);
    await waitFor(() => expect(screen.getAllByRole('button')).toHaveLength(24));
    expect(screen.getAllByRole('button')[0]).toHaveTextContent('Burger 29');

    revealMore();
    expect(screen.getAllByRole('button')).toHaveLength(30);
    rerender(<BurgerExplore hideSearch searchTerm="Burger 0" />);
    expect(screen.getAllByRole('button')).toHaveLength(10);
    rerender(<BurgerExplore hideSearch searchTerm="" />);
    expect(screen.getAllByRole('button')).toHaveLength(24);
    expect(disconnect).toHaveBeenCalled();
  });

  it('resets the visible count when sorting and opens the selected burger', async () => {
    render(<BurgerExplore />);
    await waitFor(() => expect(screen.getAllByRole('button')).toHaveLength(24));
    revealMore();
    expect(screen.getAllByRole('button')).toHaveLength(30);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'best' } });
    expect(screen.getAllByRole('button')).toHaveLength(24);
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(navigateMock).toHaveBeenCalledWith('/burgers/restaurant/b29');
  });
});
