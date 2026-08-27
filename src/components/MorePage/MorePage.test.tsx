import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MorePage } from './MorePage';

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {
    from: vi.fn(),
  },
}));

vi.mock('@mui/icons-material', () => ({
  BookmarksOutlined: () => null,
  CalendarMonthOutlined: () => null,
  ChevronRight: () => null,
  EmojiEventsOutlined: () => null,
  GroupsOutlined: () => null,
  PlaylistAddOutlined: () => null,
  WorkspacePremiumOutlined: () => null,
}));

vi.mock('../../lib/supabaseClient', () => ({
  supabase: supabaseMock,
}));

vi.mock('../../utils/useRevalidateOnFocus', () => ({
  useRevalidateOnFocus: () => {},
}));

vi.mock('../common/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../common/PageHeader', () => ({
  PageHeader: ({ title }: { title: ReactNode }) => <h1>{title}</h1>,
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

const session = { user: { id: 'user-1' } };

function renderMore(inviteCount = 0) {
  supabaseMock.from.mockReturnValue({
    select: () => ({
      eq: async () => ({ count: inviteCount, error: null }),
    }),
  });

  return render(
    <MemoryRouter initialEntries={['/more']}>
      <MorePage session={session as never} />
      <LocationProbe />
    </MemoryRouter>
  );
}

describe('MorePage', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
  });

  it('renders the personal and social categories with every main access', () => {
    renderMore();

    expect(screen.getByRole('heading', { name: 'more.personalSection' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'more.socialSection' })).toBeInTheDocument();
    [
      'more.calendarTitle',
      'more.topBurgersTitle',
      'more.wishlistTitle',
      'more.savedTitle',
      'more.groupsTitle',
      'more.rankingTitle',
    ].forEach((name) => {
      expect(screen.getByRole('link', { name: new RegExp(name) })).toBeInTheDocument();
    });

    const links = screen.getAllByRole('link');
    expect(links[4]).toHaveTextContent('more.rankingTitle');
    expect(links[5]).toHaveTextContent('more.groupsTitle');
  });

  it.each([
    ['more.calendarTitle', '/burger-calendar'],
    ['more.topBurgersTitle', '/my-top-burgers'],
    ['more.wishlistTitle', '/burger-wishlist'],
    ['more.savedTitle', '/saved'],
    ['more.groupsTitle', '/groups'],
    ['more.rankingTitle', '/ranking'],
  ])('navigates from %s to %s', async (name, path) => {
    const user = userEvent.setup();
    renderMore();

    await user.click(screen.getByRole('link', { name: new RegExp(name) }));

    expect(screen.getByTestId('location')).toHaveTextContent(path);
  });

  it('shows pending group invitations on the Groups card', async () => {
    renderMore(3);

    expect(await screen.findByLabelText('more.pendingInvitations')).toHaveTextContent('3');
  });

  it('does not render a New badge on the tools', () => {
    renderMore();

    expect(screen.queryByText('more.newBadge')).not.toBeInTheDocument();
  });
});
