import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BurgerCollection, BurgerDetailPage, BurgerExplore } from './BurgerCatalog';

const { fromMock, navigateMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock('../../lib/supabaseClient', () => ({ supabase: { from: fromMock } }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useLocation: () => ({ key: 'default', state: null }),
  Link: ({ children }: { children: import('react').ReactNode }) => children,
  useParams: () => ({ restaurantId: 'restaurant', burgerId: 'burger' }),
}));

type Row = {
  id: string; user_id: string; burger_id: string; restaurant_id: string;
  rating: number; photo_url: string | null; datetime: string; visibility: string;
  restaurant: { name: string }; burger: { name: string };
};
const entry = (changes: Partial<Row> = {}): Row => ({
  id: 'public-post', user_id: 'public-author', burger_id: 'burger', restaurant_id: 'restaurant',
  rating: 4, photo_url: '/public.jpg', datetime: '2026-10-01T12:00:00Z', visibility: 'public',
  restaurant: { name: 'Burger Bar' }, burger: { name: 'Classic' }, ...changes,
});

function mockData(rows: Row[], profiles = [...new Set(rows.map(row => row.user_id))].map(id => ({ id, is_private: false })), profileError = false) {
  const photoRequests: string[][] = [];
  fromMock.mockImplementation((table: string) => {
    let columns = '';
    let ids: string[] | undefined;
    let range = [0, 499];
    const filters: Record<string, unknown> = {};
    const query = {
      select: vi.fn((value: string) => { columns = value; return query; }),
      eq: vi.fn((key: string, value: unknown) => { filters[key] = value; return query; }),
      not: vi.fn(() => query), is: vi.fn(() => query), order: vi.fn(() => query),
      in: vi.fn((_key: string, value: string[]) => { ids = value; return query; }),
      range: vi.fn((from: number, to: number) => { range = [from, to]; return query; }),
      then: (resolve: (value: { data: unknown[]; error: unknown }) => unknown) => {
        let data: unknown[] = [];
        if (table === 'profiles') data = profiles;
        if (table === 'entries') {
          data = rows.filter(row => Object.entries(filters).every(([key, value]) => !(key in row) || row[key as keyof Row] === value))
            .filter(row => !ids || ids.includes(row.id)).slice(range[0], range[1] + 1);
          if (columns === 'id,photo_url') photoRequests.push(ids ?? []);
        }
        return Promise.resolve({ data, error: table === 'profiles' && profileError ? { message: 'failed' } : null }).then(resolve);
      },
    };
    return query;
  });
  return photoRequests;
}

describe('BurgerExplore', () => {
  let onIntersection: IntersectionObserverCallback;
  const disconnect = vi.fn();

  beforeEach(() => {
    const entries = Array.from({ length: 30 }, (_, index) => entry({
      id: `e${index}`, user_id: 'user', burger_id: `b${index}`, restaurant_id: 'restaurant',
      rating: index === 29 ? 5 : 4, photo_url: null, datetime: '2026-10-01T12:00:00Z',
      restaurant: { name: 'Burger Bar' }, burger: { name: `Burger ${String(index).padStart(2, '0')}` },
    }));
    mockData(entries);
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

    await waitFor(() => expect(onIntersection).toBeTypeOf('function'));
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
    await waitFor(() => expect(onIntersection).toBeTypeOf('function'));
    revealMore();
    expect(screen.getAllByRole('button')).toHaveLength(30);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'best' } });
    expect(screen.getAllByRole('button')).toHaveLength(24);
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(navigateMock).toHaveBeenCalledWith('/burgers/restaurant/b29');
  });

  it('finds all burgers belonging to a restaurant from the unified query, as well as matching burger names', async () => {
    mockData([
      entry({ id: 'emmy', burger_id: 'emmy', restaurant_id: 'jenkins', restaurant: { name: 'Jénkin’s' }, burger: { name: 'Emmy B' } }),
      entry({ id: 'bbq', burger_id: 'bbq', restaurant_id: 'jenkins', restaurant: { name: 'Jénkin’s' }, burger: { name: 'BBQ' } }),
      entry({ id: 'special', burger_id: 'special', restaurant_id: 'other', restaurant: { name: 'Other Place' }, burger: { name: 'Jenkins Special' } }),
      entry({ id: 'classic', burger_id: 'classic', restaurant_id: 'cafe', restaurant: { name: 'Café Norte' }, burger: { name: 'Classic' } }),
    ]);
    const { rerender } = render(<BurgerExplore hideSearch searchTerm="  JENKINS  " />);
    await waitFor(() => expect(screen.getAllByRole('button')).toHaveLength(3));
    expect(screen.getByText('Emmy B')).toBeInTheDocument();
    expect(screen.getByText('BBQ')).toBeInTheDocument();
    expect(screen.getByText('Jenkins Special')).toBeInTheDocument();
    expect(screen.queryByText('Classic')).toBeNull();
    rerender(<BurgerExplore hideSearch searchTerm="cafenorte" />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByText('Classic')).toBeInTheDocument();
    rerender(<BurgerExplore hideSearch searchTerm="not found" />);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<BurgerExplore hideSearch searchTerm="" />);
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('filters by a partial restaurant name in the catalogue input while preserving sorting and burger navigation', async () => {
    mockData([
      entry({ id: 'first', burger_id: 'first', rating: 4 }),
      entry({ id: 'best', burger_id: 'best', rating: 5, burger: { name: 'Best Burger' } }),
      entry({ id: 'unrelated', burger_id: 'unrelated', restaurant: { name: 'Other Place' }, burger: { name: 'Unrelated' } }),
    ]);
    render(<BurgerExplore />);
    await screen.findByText('Best Burger');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'best' } });
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '  BURGER BA  ' } });
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getAllByRole('button')[0]).toHaveTextContent('Best Burger');
    expect(screen.queryByText('Unrelated')).toBeNull();
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(navigateMock).toHaveBeenCalledWith('/burgers/restaurant/best');
    expect(screen.getByRole('combobox')).toHaveValue('best');
  });

  it.each(['東京', 'กรุงเทพ'])('preserves restaurant name searches in %s', async name => {
    mockData([entry({ restaurant: { name } }),
      entry({ id: 'other', burger_id: 'other', restaurant: { name: 'Other Place' }, burger: { name: 'Unrelated' } })]);
    render(<BurgerExplore hideSearch searchTerm={name} />);
    await screen.findByText('Classic');
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByText('Unrelated')).toBeNull();
  });
});

describe('Burger privacy', () => {
  beforeEach(() => navigateMock.mockReset());

  it('identifies only the viewer\'s posts, preserves opening them, and clears ownership for guests', async () => {
    mockData([entry(), entry({ id: 'my-post', user_id: 'viewer', photo_url: '/mine.jpg' })]);
    const { container, rerender } = render(<BurgerDetailPage viewerId="viewer" />);
    const badge = await screen.findByText('burgerCatalog.ownPost');
    const ownPost = badge.closest('button')!;
    expect(ownPost).toHaveClass('is-own-post');
    expect(container.querySelectorAll('.bw-catalog-posts .is-own-post')).toHaveLength(1);
    expect(ownPost.querySelector('img')).toHaveAttribute('src', '/mine.jpg');
    fireEvent.click(ownPost);
    expect(navigateMock).toHaveBeenCalledWith('/posts/my-post', expect.anything());
    rerender(<BurgerDetailPage viewerId={null} />);
    expect(screen.queryByText('burgerCatalog.ownPost')).toBeNull();
    await waitFor(() => expect(container.querySelectorAll('.bw-catalog-posts button')).toHaveLength(2));
    expect(container.querySelector('.is-own-post')).toBeNull();
    expect(screen.queryByText('burgerCatalog.ownPost')).toBeNull();
  });

  it('locks private posts and private-profile posts without requesting their photos or exposing links', async () => {
    const photos = mockData([
      entry(),
      entry({ id: 'secret-post', user_id: 'private-post-author', visibility: 'private', photo_url: '/secret.jpg', rating: 5 }),
      entry({ id: 'secret-profile', user_id: 'private-profile-author', photo_url: '/private-profile.jpg', rating: 1 }),
    ], [
      { id: 'public-author', is_private: false },
      { id: 'private-post-author', is_private: false },
      { id: 'private-profile-author', is_private: true },
    ]);
    const { container } = render(<BurgerDetailPage viewerId="viewer" />);
    await waitFor(() => expect(screen.getAllByText('burgerCatalog.privatePost')).toHaveLength(2));
    expect(photos.flat()).toEqual(['public-post']);
    expect(container.querySelectorAll('.bw-catalog-private-post button')).toHaveLength(0);
    expect(container.querySelectorAll('.bw-catalog-private-post img')).toHaveLength(0);
    expect(container.innerHTML).not.toMatch(/secret\.jpg|private-profile\.jpg|private-post-author|private-profile-author/);
    expect(container.querySelector('.bw-catalog-summary .bw-catalog-rating')).toHaveTextContent('4.0');
    const post = container.querySelector<HTMLButtonElement>('.bw-catalog-posts button');
    fireEvent.click(post!);
    expect(navigateMock).toHaveBeenCalledWith('/posts/public-post', expect.anything());
  });

  it('opens an owner’s private burger and clears its photo immediately when the viewer changes', async () => {
    mockData([entry({ user_id: 'owner', visibility: 'private', photo_url: '/owner-private.jpg' })]);
    const { rerender, container } = render(<BurgerDetailPage viewerId="owner" />);
    await screen.findByText('burgerCatalog.privatePost');
    expect(screen.getByText('burgerCatalog.ownPost').closest('button')).toHaveClass('is-own-post');
    expect(container.querySelector('.bw-catalog-posts img')).toHaveAttribute('src', '/owner-private.jpg');
    fireEvent.click(container.querySelector<HTMLButtonElement>('.bw-catalog-posts button')!);
    expect(navigateMock).toHaveBeenCalledWith('/posts/public-post', expect.anything());
    rerender(<BurgerDetailPage viewerId="stranger" />);
    expect(container.innerHTML).not.toContain('/owner-private.jpg');
    expect(screen.queryByText('burgerCatalog.ownPost')).toBeNull();
    await waitFor(() => expect(container.querySelector('.bw-catalog-private-post')).toBeInTheDocument());
  });

  it('keeps unknown profiles locked and fails closed when privacy cannot be loaded', async () => {
    mockData([entry()], []);
    const { unmount, container } = render(<BurgerDetailPage viewerId="viewer" />);
    await screen.findByText('burgerCatalog.privatePost');
    expect(container.querySelector('.bw-catalog-posts button')).toBeNull();
    unmount();
    mockData([entry()], [], true);
    render(<BurgerDetailPage viewerId="viewer" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('burgerCatalog.loadError');
    expect(screen.queryByRole('img', { name: 'Classic' })).not.toBeInTheDocument();
  });

  it('marks private posts in the owner’s collection diary', async () => {
    mockData([entry({ user_id: 'owner', visibility: 'private' })]);
    render(<BurgerCollection userId="owner" viewerId="owner" own />);
    await screen.findByText('Classic');
    fireEvent.click(screen.getByRole('tab', { name: 'Diario' }));
    expect(await screen.findByText('burgerCatalog.privatePost')).toBeInTheDocument();
  });
});
