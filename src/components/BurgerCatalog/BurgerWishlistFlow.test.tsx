import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BurgerDetailPage, BurgerCollection, BurgerExplore } from './BurgerCatalog';
import { BurgerWishlistPage } from '../BurgerWishlistPage/BurgerWishlistPage';

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));
vi.mock('../../lib/supabaseClient', () => ({ supabase: { from: fromMock } }));

type Row = Record<string, unknown>;
type Response = { data: Row[]; error: null | { message: string } };
type Request = { table: string; columns: string; operation: 'select' | 'upsert' | 'delete'; filters: Row; values?: Row; options?: Row; range?: [number, number] };
const success = (data: Row[] = []): Response => ({ data, error: null });
const failure = (): Response => ({ data: [], error: { message: 'Offline' } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const post = (changes: Row = {}): Row => ({
  id: 'public-post', user_id: 'author', burger_id: 'burger', restaurant_id: 'restaurant',
  rating: 4, currency: 'JPY', photo_url: '/public.jpg', datetime: '2026-10-01T12:00:00Z',
  visibility: 'public', is_burger: true, burger_origin: 'restaurant', deleted_at: null,
  restaurant: { name: 'Burger Bar' }, burger: { name: 'Classic' }, ...changes,
});
const pending = (changes: Row = {}): Row => ({
  id: 'wanted', user_id: 'viewer', restaurant_id: 'restaurant', burger_id: 'burger',
  source_entry_id: 'public-post', status: 'want_to_try', rating: null, currency: 'JPY',
  photo_url: '/public.jpg', created_at: '2026-10-01T12:00:00Z',
  restaurants: { name: 'Burger Bar' }, burgers: { name: 'Classic', meat_type: 'beef' }, ...changes,
});
let posts: Row[], wishlist: Row[], profiles: Row[], requests: Request[];
let override: ((request: Request) => Response | Promise<Response> | undefined) | undefined;

beforeEach(() => {
  posts = [post()]; wishlist = []; profiles = [{ id: 'author', is_private: false }]; requests = []; override = undefined;
  fromMock.mockImplementation((table: string) => {
    const request: Request = { table, columns: '', operation: 'select', filters: {} };
    let range = [0, 499];
    const query = {
      select: (columns: string) => { request.columns = columns; return query; },
      eq: (key: string, value: unknown) => { request.filters[key] = value; return query; },
      is: (key: string, value: unknown) => { request.filters[key] = value; return query; },
      not: () => query,
      in: (key: string, value: unknown[]) => { request.filters[key] = value; return query; },
      order: () => query,
      range: (from: number, to: number) => { range = [from, to]; request.range = [from, to]; return query; },
      upsert: (values: Row, options: Row) => { request.operation = 'upsert'; request.values = values; request.options = options; return query; },
      delete: () => { request.operation = 'delete'; return query; },
      match: (values: Row) => { Object.assign(request.filters, values); return query; },
      then: (resolve: (value: Response) => unknown, reject?: (error: unknown) => unknown) => {
        requests.push(request);
        const replacement = override?.(request);
        if (replacement) return Promise.resolve(replacement).then(resolve, reject);
        const matches = (row: Row) => Object.entries(request.filters).every(([key, value]) => Array.isArray(value) ? value.includes(row[key]) : row[key] === value);
        if (request.operation === 'upsert' && table === 'burger_wishlist') {
          const values = request.values!;
          const existing = wishlist.find(row => ['user_id', 'restaurant_id', 'burger_id'].every(key => row[key] === values[key]));
          if (existing) Object.assign(existing, values);
          else wishlist.push(pending(values));
        }
        if (request.operation === 'delete' && table === 'burger_wishlist') wishlist = wishlist.filter(row => !matches(row));
        let data = (table === 'entries' ? posts : table === 'burger_wishlist' ? wishlist : table === 'profiles' ? profiles : []).filter(matches).slice(range[0], range[1] + 1);
        if (table === 'entries' && !request.columns.includes('photo_url')) data = data.map(row => {
          const metadata = { ...row }; delete metadata.photo_url; return metadata;
        });
        return Promise.resolve(success(data)).then(resolve, reject);
      },
    };
    return query;
  });
});

const writes = () => requests.filter(request => request.operation !== 'select');
const statusQuery = (request: Request) => request.table === 'burger_wishlist' && request.operation === 'select' && request.columns.includes('status');
const detail = (viewerId: string | null = 'viewer') => <MemoryRouter initialEntries={['/burgers/restaurant/burger']}>
  <Routes><Route path="/burgers/:restaurantId/:burgerId" element={<BurgerDetailPage viewerId={viewerId} />} />
    <Route path="/login" element={<p>Login screen</p>} />
    <Route path="/burger-wishlist" element={<p>Wishlist screen</p>} />
    <Route path="/search" element={<p>Search screen</p>} /></Routes>
</MemoryRouter>;
async function saveButton() { return screen.findByRole('button', { name: 'burgerWishlist.wantToTry' }); }
async function readyButton() {
  const button = await saveButton();
  await waitFor(() => expect(button).toBeEnabled());
  return button;
}

describe('Burger detail loading and cover selection', () => {
  function expectOnlyLoader() {
    const main = screen.getByRole('main');
    expect(main.children).toHaveLength(1);
    expect(within(main).getByRole('status', { name: 'common.loading' })).toBeInTheDocument();
    expect(within(main).queryByRole('link')).toBeNull();
    expect(within(main).queryByRole('img')).toBeNull();
  }

  it('shows only the loader while the burger entries are pending', async () => {
    const load = deferred<Response>();
    override = request => request.table === 'entries' && request.columns.includes('datetime') ? load.promise : undefined;
    render(detail());
    expectOnlyLoader();
    await act(async () => load.resolve(success(posts)));
    await readyButton();
    expect(screen.getByRole('link', { name: 'burgerWishlist.viewList' })).toBeInTheDocument();
  });

  it('waits for likes before displaying the definitive cover, instead of briefly showing the newest photo', async () => {
    const likes = deferred<Response>();
    posts = [post({ id: 'newest', photo_url: '/newest.jpg' }),
      post({ id: 'popular', photo_url: '/popular.jpg', datetime: '2026-09-01T12:00:00Z' })];
    override = request => request.table === 'entry_likes' ? likes.promise : undefined;
    const { container } = render(detail());
    await waitFor(() => expect(requests.some(request => request.table === 'entry_likes')).toBe(true));
    expectOnlyLoader();
    expect(requests.some(statusQuery)).toBe(false);
    await act(async () => likes.resolve(success([{ entry_id: 'popular', user_id: 'fan' }])));
    await readyButton();
    expect(container.querySelector('.bw-catalog-summary img')).toHaveAttribute('src', '/popular.jpg');
    expect(container.querySelector('.bw-catalog-featured img')).toHaveAttribute('src', '/popular.jpg');
  });

  it.each(['response error', 'rejected request'])('recovers from a likes %s without getting stuck or showing a provisional cover', async kind => {
    override = request => request.table === 'entry_likes'
      ? kind === 'response error' ? failure() : Promise.reject(new Error('Offline')) : undefined;
    const { container } = render(detail());
    expect(await screen.findByRole('alert')).toHaveTextContent('burgerCatalog.loadError');
    expect(container.querySelector('.bw-catalog-summary')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    override = undefined;
    const load = deferred<Response>();
    override = request => request.table === 'entry_likes' ? load.promise : undefined;
    fireEvent.click(screen.getByRole('button', { name: 'burgerCatalog.retry' }));
    expectOnlyLoader();
    await waitFor(() => expect(requests.filter(request => request.table === 'entry_likes')).toHaveLength(2));
    expectOnlyLoader();
    await act(async () => load.resolve(success()));
    await readyButton();
    expect(container.querySelector('.bw-catalog-summary img')).toHaveAttribute('src', '/public.jpg');
  });

  it.each(['viewer', 'route'])('ignores late likes after changing %s', async kind => {
    const old = deferred<Response>();
    let first = true;
    override = request => {
      if (first && request.table === 'entry_likes') { first = false; return old.promise; }
    };
    posts = [post({ id: 'newest', photo_url: '/newest.jpg' }),
      post({ id: 'popular', photo_url: '/popular.jpg', datetime: '2026-09-01T12:00:00Z' })];
    function Switch() {
      const navigate = useNavigate(); const [viewer, setViewer] = useState('viewer');
      return <><button onClick={() => kind === 'route' ? navigate('/burgers/restaurant/second') : setViewer('other')}>Switch context</button>
        <BurgerDetailPage viewerId={viewer} /></>;
    }
    const { container } = render(<MemoryRouter initialEntries={['/burgers/restaurant/burger']}><Routes>
      <Route path="/burgers/:restaurantId/:burgerId" element={<Switch />} />
    </Routes></MemoryRouter>);
    await waitFor(() => expect(first).toBe(false));
    expectOnlyLoader();
    if (kind === 'route') posts = [post({ burger_id: 'second', photo_url: '/second.jpg' })];
    fireEvent.click(screen.getByRole('button', { name: 'Switch context' }));
    expectOnlyLoader();
    await readyButton();
    const expected = kind === 'route' ? '/second.jpg' : '/newest.jpg';
    expect(container.querySelector('.bw-catalog-summary img')).toHaveAttribute('src', expected);
    await act(async () => old.resolve(success([{ entry_id: 'popular', user_id: 'fan' }])));
    expect(container.querySelector('.bw-catalog-summary img')).toHaveAttribute('src', expected);
  });
});

describe('Consistent burger covers and exact rating distribution', () => {
  function mockLikes(rows: Row[]) {
    override = request => request.table === 'entry_likes'
      ? success(rows.filter(row => (request.filters.entry_id as string[]).includes(row.entry_id as string))
        .slice(request.range?.[0] ?? 0, (request.range?.[1] ?? 499) + 1)) : undefined;
  }

  it('uses the most-liked public photo in search, details and a new wishlist save', async () => {
    posts = [post({ id: 'newest', photo_url: '/newest.jpg' }),
      post({ id: 'popular', photo_url: '/popular.jpg', datetime: '2026-09-01T12:00:00Z' }),
      post({ id: 'no-photo', photo_url: null }),
      post({ id: 'private', visibility: 'private', photo_url: '/private.jpg' })];
    mockLikes([{ entry_id: 'popular', user_id: 'fan' },
      ...['no-photo', 'private'].flatMap(entry_id => ['fan1', 'fan2'].map(user_id => ({ entry_id, user_id }))) ]);
    const { container } = render(<MemoryRouter initialEntries={['/search']}><Routes>
      <Route path="/search" element={<BurgerExplore viewerId="viewer" />} />
      <Route path="/burgers/:restaurantId/:burgerId" element={<BurgerDetailPage viewerId="viewer" />} />
    </Routes></MemoryRouter>);
    const tile = await screen.findByRole('button', { name: /Classic/ });
    expect(within(tile).getByRole('img')).toHaveAttribute('src', '/popular.jpg');
    fireEvent.click(tile);
    fireEvent.click(await readyButton());
    await screen.findByRole('button', { name: 'burgerWishlist.inWishlist' });
    expect(container.querySelector('.bw-catalog-summary img')).toHaveAttribute('src', '/popular.jpg');
    expect(container.querySelector('.bw-catalog-featured img')).toHaveAttribute('src', '/popular.jpg');
    expect(writes()[0].values).toMatchObject({ source_entry_id: 'popular', photo_url: '/popular.jpg' });
  });

  it.each(['explore', 'collection', 'detail'])('breaks equal-like ties by date and then post ID in %s', async view => {
    posts = [post({ id: 'older', photo_url: '/older.jpg', datetime: '2026-09-01T12:00:00Z' }),
      post({ id: 'a', photo_url: '/a.jpg' }), post({ id: 'b', photo_url: '/b.jpg' })];
    mockLikes(posts.map(row => ({ entry_id: row.id, user_id: 'fan' })));
    const { container } = render(view === 'detail' ? detail() : <MemoryRouter>{view === 'collection'
      ? <BurgerCollection userId="author" viewerId="viewer" /> : <BurgerExplore viewerId="viewer" />}</MemoryRouter>);
    await screen.findAllByText('Classic');
    expect(container.querySelector(view === 'detail' ? '.bw-catalog-summary img' : '.bw-catalog-tile img')).toHaveAttribute('src', '/b.jpg');
  });

  it.each(['explore', 'collection'])('waits for likes and retries their failures in %s without displaying a provisional cover', async view => {
    const likes = deferred<Response>();
    override = request => request.table === 'entry_likes' ? likes.promise : undefined;
    const { container } = render(<MemoryRouter>{view === 'collection'
      ? <BurgerCollection userId="author" viewerId="viewer" /> : <BurgerExplore viewerId="viewer" />}</MemoryRouter>);
    await waitFor(() => expect(requests.some(request => request.table === 'entry_likes')).toBe(true));
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(container.querySelector('.bw-catalog-tile')).toBeNull();
    await act(async () => likes.resolve(failure()));
    await screen.findByRole('alert');
    override = undefined;
    fireEvent.click(screen.getByRole('button', { name: 'burgerCatalog.retry' }));
    await screen.findByText('Classic');
    expect(container.querySelector('.bw-catalog-tile img')).toHaveAttribute('src', '/public.jpg');
  });

  it('counts all pages of likes before selecting a catalogue cover', async () => {
    posts = [post({ id: 'first', photo_url: '/first.jpg' }),
      post({ id: 'second', photo_url: '/second.jpg', datetime: '2026-09-01T12:00:00Z' })];
    mockLikes(['first', 'second'].flatMap(entry_id => Array.from({ length: entry_id === 'first' ? 500 : 501 },
      (_, index) => ({ entry_id, user_id: `fan-${index}` }))));
    const { container } = render(<MemoryRouter><BurgerExplore /></MemoryRouter>);
    await screen.findByText('Classic');
    expect(container.querySelector('.bw-catalog-tile img')).toHaveAttribute('src', '/second.jpg');
    expect(requests.filter(request => request.table === 'entry_likes').map(request => request.range))
      .toEqual([[0, 499], [500, 999], [1000, 1499]]);
  });

  it.each([
    { notes: [4, 4, 4, 5, 5, 5], average: '4.5', counts: { '4': 3, '4.5': 0, '5': 3 } },
    { notes: [4, 4, 4, 4.5, 4.5, 4.5], average: '4.3', counts: { '4': 3, '4.5': 3, '5': 0 } },
    { notes: [0.5, 4.25, 5], average: '3.3', counts: { '0.5': 1, '4.25': 1, '4.5': 0, '5': 1 } },
  ])('shows exact ratings $notes in the chart alongside their real average', async ({ notes, average, counts }) => {
    posts = notes.map((rating, index) => post({ id: `rated-${index}`, rating }));
    posts.push(post({ id: 'unrated', rating: null }), post({ id: 'locked', visibility: 'private', rating: 1 }));
    const { container } = render(detail());
    await readyButton();
    expect(container.querySelector('.bw-catalog-summary .bw-catalog-rating')).toHaveTextContent(average);
    const distribution = screen.getByRole('list', { name: 'burgerCatalog.distribution' });
    const rows = within(distribution).getAllByRole('listitem');
    for (const [value, count] of Object.entries(counts)) {
      const label = within(distribution).getByText(Number(value).toLocaleString() + '★');
      expect(label.parentElement?.querySelector('span')).toHaveTextContent(String(count));
    }
    expect(rows.reduce((sum, row) => sum + Number(row.querySelector('span')?.textContent), 0)).toBe(notes.length);
  });
});

describe('Burger detail wishlist', () => {
  it('saves once using an accessible post, preserves currency and photos, and reloads the confirmed state without creating posts', async () => {
    posts.unshift(post({ id: 'blocked', user_id: 'secret', visibility: 'private', photo_url: '/secret.jpg', currency: 'USD' }));
    profiles.push({ id: 'secret', is_private: true });
    const before = structuredClone(posts);
    const event = vi.fn(); window.addEventListener('bw-burger-wishlist-updated', event);
    const { unmount } = render(detail());
    fireEvent.click(await readyButton());
    await screen.findByRole('button', { name: 'burgerWishlist.inWishlist' });
    expect(writes()).toHaveLength(1);
    expect(writes()[0]).toMatchObject({ table: 'burger_wishlist', values: {
      user_id: 'viewer', restaurant_id: 'restaurant', burger_id: 'burger', source_entry_id: 'public-post',
      currency: 'JPY', photo_url: '/public.jpg', status: 'want_to_try',
    }, options: { onConflict: 'user_id,restaurant_id,burger_id' } });
    expect(requests.filter(request => request.columns === 'id,photo_url').flatMap(request => request.filters.id)).not.toContain('blocked');
    expect(posts).toEqual(before);
    expect(event).toHaveBeenCalledOnce();
    window.removeEventListener('bw-burger-wishlist-updated', event);
    unmount(); render(detail());
    await screen.findByRole('button', { name: 'burgerWishlist.inWishlist' });
    expect(wishlist).toHaveLength(1);
  });

  it('confirms pending removal, supports cancelling with Escape and stays removed after reloading', async () => {
    wishlist = [pending()];
    const { unmount } = render(detail());
    const button = await screen.findByRole('button', { name: 'burgerWishlist.inWishlist' });
    fireEvent.click(button);
    let dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'common.cancel' })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull(); expect(writes()).toHaveLength(0);
    expect(button).toHaveFocus();
    fireEvent.click(button); dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'burgerWishlist.remove' }));
    await waitFor(() => expect(wishlist).toHaveLength(0));
    await readyButton();
    expect(writes()[0]).toMatchObject({ table: 'burger_wishlist', operation: 'delete', filters: {
      user_id: 'viewer', restaurant_id: 'restaurant', burger_id: 'burger', status: 'want_to_try',
    } });
    unmount(); render(detail()); await readyButton();
  });

  it.each(['wishlist', 'own post'])('shows tried state from %s and cannot save or mark tried', async kind => {
    if (kind === 'wishlist') wishlist = [pending({ status: 'tried', rating: 4.5 })];
    else {
      posts.push(post({ id: 'own', user_id: 'viewer', visibility: 'private' }));
      profiles.push({ id: 'viewer', is_private: true });
    }
    render(detail());
    await screen.findByText(kind === 'wishlist' ? 'burgerWishlist.triedBadge' : 'burgerWishlist.ownPost');
    expect(screen.queryByRole('button', { name: 'burgerWishlist.wantToTry' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'burgerWishlist.triedAction' })).toBeNull();
    expect(writes()).toHaveLength(0);
  });

  it.each(['wishlist', 'own posts'])('disables saving until %s state finishes and recovers from load failure', async kind => {
    const load = deferred<Response>();
    override = request => (kind === 'wishlist' ? statusQuery(request) : request.table === 'entries' && request.columns === 'restaurant_id, burger_id, rating') ? load.promise : undefined;
    render(detail());
    await screen.findByText('burgerWishlist.privateList');
    expect(screen.getByRole('button', { name: 'common.loading' })).toBeDisabled();
    expect(writes()).toHaveLength(0);
    await act(async () => load.resolve(failure()));
    expect(await screen.findByRole('alert')).toHaveTextContent('burgerWishlist.statusError');
    expect(await saveButton()).toBeDisabled();
    override = undefined;
    fireEvent.click(screen.getByRole('button', { name: 'burgerCatalog.retry' }));
    fireEvent.click(await readyButton());
    await screen.findByRole('button', { name: 'burgerWishlist.inWishlist' });
  });

  it('keeps the confirmed state after a failed save and allows a successful retry', async () => {
    override = request => request.operation === 'upsert' ? failure() : undefined;
    render(detail()); fireEvent.click(await readyButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('burgerWishlist.saveError');
    expect(await readyButton()).toBeEnabled(); expect(wishlist).toHaveLength(0);
    override = undefined; fireEvent.click(screen.getByRole('button', { name: 'burgerCatalog.retry' }));
    await screen.findByRole('button', { name: 'burgerWishlist.inWishlist' });
    expect(wishlist).toHaveLength(1);
  });

  it('keeps a pending burger after failed removal', async () => {
    wishlist = [pending()]; override = request => request.operation === 'delete' ? failure() : undefined;
    render(detail()); fireEvent.click(await screen.findByRole('button', { name: 'burgerWishlist.inWishlist' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'burgerWishlist.remove' }));
    await screen.findByRole('alert'); expect(wishlist).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'burgerWishlist.inWishlist' })).toBeEnabled();
  });

  it('offers login to a guest without loading private state or writing', async () => {
    render(detail(null));
    fireEvent.click(await screen.findByRole('link', { name: 'burgerWishlist.loginToSave' }));
    expect(screen.getByText('Login screen')).toBeInTheDocument();
    expect(requests.some(request => request.table === 'burger_wishlist')).toBe(false);
    expect(writes()).toHaveLength(0);
  });

  it('does not offer saving when all posts are blocked', async () => {
    posts = [post({ visibility: 'private' })]; render(detail());
    await screen.findByText('burgerCatalog.privatePost');
    expect(screen.queryByText('burgerWishlist.privateList')).toBeNull(); expect(writes()).toHaveLength(0);
  });

  it('prevents duplicate writes during a slow save, including two interactions in one render', async () => {
    const save = deferred<Response>(); override = request => request.operation === 'upsert' ? save.promise : undefined;
    render(detail()); const button = await readyButton();
    act(() => { button.click(); button.click(); });
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(screen.getByRole('button', { name: 'burgerWishlist.saving' })).toBeDisabled();
    await act(async () => save.resolve(success()));
    expect(await screen.findByRole('button', { name: 'burgerWishlist.inWishlist' })).toBeEnabled();
    expect(writes()).toHaveLength(1);
  });

  it('discards a late status response when the viewer changes', async () => {
    const old = deferred<Response>();
    override = request => statusQuery(request) && request.filters.user_id === 'viewer' ? old.promise : undefined;
    const { rerender } = render(detail()); await screen.findByText('burgerWishlist.privateList');
    rerender(detail('other')); await readyButton();
    await act(async () => old.resolve(success([pending()])));
    expect(screen.queryByRole('button', { name: 'burgerWishlist.inWishlist' })).toBeNull();
    fireEvent.click(await readyButton());
    await screen.findByRole('button', { name: 'burgerWishlist.inWishlist' });
    expect(writes()[0].values?.user_id).toBe('other');
  });

  it('discards a late save result on a different burger route', async () => {
    posts.push(post({ id: 'second-post', burger_id: 'second', burger: { name: 'Second' } }));
    const save = deferred<Response>(); override = request => request.operation === 'upsert' ? save.promise : undefined;
    function Switch() {
      const navigate = useNavigate();
      return <><button onClick={() => navigate('/burgers/restaurant/second')}>Switch burger</button><BurgerDetailPage viewerId="viewer" /></>;
    }
    render(<MemoryRouter initialEntries={['/burgers/restaurant/burger']}><Routes>
      <Route path="/burgers/:restaurantId/:burgerId" element={<Switch />} />
    </Routes></MemoryRouter>);
    fireEvent.click(await readyButton());
    fireEvent.click(screen.getByRole('button', { name: 'Switch burger' }));
    expect(screen.queryByText('Classic')).toBeNull();
    await readyButton(); await act(async () => save.resolve(success()));
    expect(screen.queryByRole('button', { name: 'burgerWishlist.inWishlist' })).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Second' })).toBeInTheDocument();
  });

  it('refreshes detail state after the existing wishlist update event', async () => {
    render(detail()); await readyButton();
    wishlist = [pending()];
    act(() => { window.dispatchEvent(new CustomEvent('bw-burger-wishlist-updated')); });
    await screen.findByRole('button', { name: 'burgerWishlist.inWishlist' });
    wishlist = [];
    act(() => { window.dispatchEvent(new CustomEvent('bw-burger-wishlist-updated')); });
    await readyButton(); expect(writes()).toHaveLength(0);
  });

  it('does not let a status read started before an update overwrite the refreshed wishlist', async () => {
    const old = deferred<Response>();
    override = request => statusQuery(request) ? old.promise : undefined;
    render(detail()); await screen.findByText('burgerWishlist.privateList');
    wishlist = [pending()]; override = undefined;
    act(() => { window.dispatchEvent(new CustomEvent('bw-burger-wishlist-updated')); });
    await screen.findByRole('button', { name: 'burgerWishlist.inWishlist' });
    await act(async () => old.resolve(success()));
    expect(screen.getByRole('button', { name: 'burgerWishlist.inWishlist' })).toBeEnabled();
    expect(writes()).toHaveLength(0);
  });

  it.each(['viewer', 'route'])('discards late catalogue data after changing %s', async kind => {
    const old = deferred<Response>();
    let first = true;
    override = request => {
      if (first && request.table === 'entries' && request.columns.includes('datetime')) { first = false; return old.promise; }
    };
    posts = [post({ burger: { name: 'Fresh' } })];
    if (kind === 'route') posts[0].burger_id = 'second';
    function Switch() {
      const navigate = useNavigate(); const [viewer, setViewer] = useState('owner');
      return <><button onClick={() => kind === 'route' ? navigate('/burgers/restaurant/second') : setViewer('other')}>Switch context</button>
        <BurgerDetailPage viewerId={viewer} /></>;
    }
    const { container } = render(<MemoryRouter initialEntries={['/burgers/restaurant/burger']}><Routes>
      <Route path="/burgers/:restaurantId/:burgerId" element={<Switch />} />
    </Routes></MemoryRouter>);
    await waitFor(() => expect(first).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Switch context' }));
    await screen.findByRole('heading', { level: 2, name: 'Fresh' });
    await act(async () => old.resolve(success([post({ id: 'old-secret', user_id: 'owner', visibility: 'private', photo_url: '/old-secret.jpg' })])));
    expect(container.innerHTML).not.toMatch(/old-secret|Classic/);
    expect(requests.filter(request => request.columns === 'id,photo_url').flatMap(request => request.filters.id)).not.toContain('old-secret');
  });
});

describe('Wishlist navigation and catalogue recovery', () => {
  it('opens wishlist → detail → wishlist, keeps photos and actions, and supports direct-detail navigation', async () => {
    wishlist = [pending()];
    const session = { user: { id: 'viewer' } } as Session;
    render(<MemoryRouter initialEntries={['/burger-wishlist']}><Routes>
      <Route path="/burger-wishlist" element={<BurgerWishlistPage session={session} onBack={vi.fn()} />} />
      <Route path="/burgers/:restaurantId/:burgerId" element={<BurgerDetailPage viewerId="viewer" />} />
    </Routes></MemoryRouter>);
    const link = await screen.findByRole('link', { name: 'burgerWishlist.viewBurger' });
    expect(screen.getByRole('button', { name: 'common.viewPhoto' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'burgerWishlist.triedAction' })).toBeInTheDocument();
    fireEvent.click(link); await screen.findByRole('button', { name: 'burgerWishlist.inWishlist' });
    fireEvent.click(screen.getByRole('button', { name: 'burgerCatalog.back' }));
    expect(await screen.findByRole('link', { name: 'burgerWishlist.viewBurger' })).toHaveAttribute('href', '/burgers/restaurant/burger');
  });

  it('offers a wishlist link and safe back fallback from a direct detail URL', async () => {
    const { unmount } = render(detail()); await readyButton();
    expect(screen.getByRole('link', { name: 'burgerWishlist.viewList' })).toHaveAttribute('href', '/burger-wishlist');
    fireEvent.click(screen.getByRole('button', { name: 'burgerCatalog.back' }));
    expect(screen.getByText('Search screen')).toBeInTheDocument();
    unmount(); render(detail()); await readyButton();
    fireEvent.click(screen.getByRole('link', { name: 'burgerWishlist.viewList' }));
    expect(screen.getByText('Wishlist screen')).toBeInTheDocument();
  });

  it.each(['explore', 'collection', 'detail'])('recovers %s after repeated failures without reloading the app', async view => {
    override = request => request.table === 'entries' && request.columns.includes('datetime') ? failure() : undefined;
    render(view === 'detail' ? detail() : <MemoryRouter>{view === 'collection'
      ? <BurgerCollection userId="author" viewerId="viewer" /> : <BurgerExplore />}</MemoryRouter>);
    await screen.findByRole('alert');
    if (view === 'explore') {
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Classic' } });
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'best' } });
    }
    if (view === 'collection') fireEvent.click(screen.getByRole('tab', { name: 'Top' }));
    fireEvent.click(screen.getByRole('button', { name: 'burgerCatalog.retry' }));
    await screen.findByRole('alert');
    const load = deferred<Response>();
    override = request => request.table === 'entries' && request.columns.includes('datetime') ? load.promise : undefined;
    const before = requests.length;
    const retry = screen.getByRole('button', { name: 'burgerCatalog.retry' });
    act(() => { retry.click(); retry.click(); });
    await screen.findByText(view === 'detail' ? 'common.loading' : 'Cargando...');
    expect(screen.queryByRole('button', { name: 'burgerCatalog.retry' })).toBeNull();
    expect(requests.slice(before).filter(request => request.columns.includes('datetime'))).toHaveLength(1);
    await act(async () => load.resolve(success(posts)));
    await screen.findAllByText('Classic');
    if (view === 'explore') {
      expect(screen.getByRole('searchbox')).toHaveValue('Classic'); expect(screen.getByRole('combobox')).toHaveValue('best');
    }
    if (view === 'collection') expect(screen.getByRole('tab', { name: 'Top' })).toHaveAttribute('aria-selected', 'true');
  });

  it('still blocks private photos when recovering from a privacy load error', async () => {
    posts = [post({ user_id: 'secret', photo_url: '/secret.jpg' })]; profiles = [{ id: 'secret', is_private: true }];
    override = request => request.table === 'profiles' ? failure() : undefined;
    const { container } = render(detail()); await screen.findByRole('alert');
    override = undefined; fireEvent.click(screen.getByRole('button', { name: 'burgerCatalog.retry' }));
    await screen.findByText('burgerCatalog.privatePost');
    expect(container.innerHTML).not.toContain('/secret.jpg');
    expect(requests.some(request => request.columns === 'id,photo_url')).toBe(false);
    expect(writes()).toHaveLength(0);
  });
});
