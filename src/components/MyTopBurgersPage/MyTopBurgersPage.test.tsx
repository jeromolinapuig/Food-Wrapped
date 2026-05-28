import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MyTopBurgersPage } from './MyTopBurgersPage';

type MockSession = {
  user: {
    id: string;
  };
};

type RawBurger = {
  id: string;
  datetime: string;
  rating: number | null;
  price: number | null;
  currency: string | null;
  photo_url: string | null;
  restaurant: { name: string | null } | null;
  burger: { name: string | null } | null;
};

type MockSupabase = {
  from: ReturnType<typeof vi.fn>;
};

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {
    from: vi.fn(),
  } satisfies MockSupabase,
}));

vi.mock('@mui/icons-material', () => ({
  Close: () => null,
  Euro: () => null,
  Star: () => null,
}));

vi.mock('../../lib/supabaseClient', () => ({
  supabase: supabaseMock,
}));

const session: MockSession = { user: { id: 'user-123' } };

const mockEntriesQuery = (result: { data: RawBurger[] | null; error: { message: string } | null }) => {
  const query = {
    eq: vi.fn(),
    not: vi.fn(),
  };

  query.eq.mockReturnValue(query);
  query.not.mockResolvedValue(result);

  const select = vi.fn(() => query);
  supabaseMock.from.mockReturnValue({ select });
};

describe('MyTopBurgersPage functional flows', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
  });

  it('opens a posts modal from a burger and lets user open/close the post photo viewer', async () => {
    mockEntriesQuery({
      data: [
        {
          id: '1',
          datetime: '2026-01-01T10:00:00.000Z',
          rating: 4,
          price: 10,
          currency: 'EUR',
          photo_url: 'https://cdn.example.com/burger.jpg',
          restaurant: { name: 'Alpha' },
          burger: { name: 'Smash Burger' },
        },
      ],
      error: null,
    });

    const user = userEvent.setup();
    render(<MyTopBurgersPage session={session as never} />);

    expect(await screen.findByText('Smash Burger')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Smash Burger/i })).toHaveTextContent('myTopBurgers.price');
    await user.click(screen.getByRole('button', { name: /Smash Burger/i }));

    expect(screen.getByRole('heading', { name: 'myTopBurgers.postsTitle' })).toBeInTheDocument();
    expect(screen.getAllByText('Alpha')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'common.viewPhoto' }));

    const closeButtons = screen.getAllByRole('button', { name: 'common.close' });
    expect(closeButtons).toHaveLength(2);
    await user.click(closeButtons[1]);
    expect(screen.getByRole('heading', { name: 'myTopBurgers.postsTitle' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'common.close' }));
    expect(screen.queryByRole('heading', { name: 'myTopBurgers.postsTitle' })).not.toBeInTheDocument();
  });

  it('sorts burgers by price and toggles direction on repeated click', async () => {
    mockEntriesQuery({
      data: [
        {
          id: '1',
          datetime: '2026-01-01T10:00:00.000Z',
          rating: 4,
          price: 12,
          currency: 'EUR',
          photo_url: 'https://cdn.example.com/cheap.jpg',
          restaurant: { name: 'Alpha' },
          burger: { name: 'Cheap Burger' },
        },
        {
          id: '2',
          datetime: '2026-01-02T10:00:00.000Z',
          rating: 4,
          price: 20,
          currency: 'EUR',
          photo_url: 'https://cdn.example.com/expensive.jpg',
          restaurant: { name: 'Alpha' },
          burger: { name: 'Expensive Burger' },
        },
      ],
      error: null,
    });

    const user = userEvent.setup();
    render(<MyTopBurgersPage session={session as never} />);

    const groupTitle = await screen.findByRole('heading', { name: 'Alpha' });
    const groupCard = groupTitle.closest('article');
    if (!groupCard) throw new Error('Expected restaurant group card');

    await user.click(screen.getByRole('button', { name: /myTopBurgers.sortPrice/i }));
    let burgerButtons = within(groupCard).getAllByRole('button');
    expect(burgerButtons[0]).toHaveTextContent('Expensive Burger');
    expect(burgerButtons[1]).toHaveTextContent('Cheap Burger');

    await user.click(screen.getByRole('button', { name: /myTopBurgers.sortPrice/i }));
    burgerButtons = within(groupCard).getAllByRole('button');
    expect(burgerButtons[0]).toHaveTextContent('Cheap Burger');
    expect(burgerButtons[1]).toHaveTextContent('Expensive Burger');
  });

  it('shows the highest recorded price for repeated burgers', async () => {
    mockEntriesQuery({
      data: [
        {
          id: '1',
          datetime: '2026-01-01T10:00:00.000Z',
          rating: 4,
          price: 12,
          currency: 'EUR',
          photo_url: 'https://cdn.example.com/smash-1.jpg',
          restaurant: { name: 'Alpha' },
          burger: { name: 'Smash Burger' },
        },
        {
          id: '2',
          datetime: '2026-01-02T10:00:00.000Z',
          rating: 5,
          price: 18,
          currency: 'EUR',
          photo_url: 'https://cdn.example.com/smash-2.jpg',
          restaurant: { name: 'Alpha' },
          burger: { name: 'Smash Burger' },
        },
      ],
      error: null,
    });

    render(<MyTopBurgersPage session={session as never} />);

    const burger = await screen.findByRole('button', { name: /Smash Burger/i });
    expect(burger).toHaveTextContent('myTopBurgers.highestPrice');
    expect(burger).toHaveTextContent('18');
  });

  it('shows backend error when loading fails', async () => {
    mockEntriesQuery({
      data: null,
      error: { message: 'boom-error' },
    });

    render(<MyTopBurgersPage session={session as never} />);

    expect(await screen.findByText('boom-error')).toBeInTheDocument();
  });

  it('shows empty state when there are no burgers', async () => {
    mockEntriesQuery({
      data: [],
      error: null,
    });

    render(<MyTopBurgersPage session={session as never} />);

    expect(await screen.findByText('myTopBurgers.empty')).toBeInTheDocument();
  });
});
