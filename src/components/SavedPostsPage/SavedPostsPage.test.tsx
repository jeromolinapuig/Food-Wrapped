import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SavedPostsPage } from './SavedPostsPage';

type MockSupabase = {
  from: ReturnType<typeof vi.fn>;
};

type FeedTabsProps = {
  currentUserId: string;
  entryIdsFilter: string[];
  hideHeader: boolean;
  onOpenEntry: (entryId: string) => void;
};

const { supabaseMock, navigateMock, feedTabsSpy } = vi.hoisted(() => ({
  supabaseMock: {
    from: vi.fn(),
  } satisfies MockSupabase,
  navigateMock: vi.fn(),
  feedTabsSpy: vi.fn<(props: FeedTabsProps) => void>(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../lib/supabaseClient', () => ({
  supabase: supabaseMock,
}));

vi.mock('../FeedTabs/FeedTabs', () => ({
  FeedTabs: (props: FeedTabsProps) => {
    feedTabsSpy(props);
    return <button type="button" onClick={() => props.onOpenEntry('entry-1')}>open-saved-entry</button>;
  },
}));

vi.mock('../common/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../common/PageHeader', () => ({
  PageHeader: ({ title, leading }: { title: ReactNode; leading: ReactNode }) => (
    <div>
      {leading}
      <h1>{title}</h1>
    </div>
  ),
}));

vi.mock('../common/BackButton', () => ({
  BackButton: ({ onClick, ariaLabel }: { onClick: () => void; ariaLabel: string }) => (
    <button type="button" onClick={onClick} aria-label={ariaLabel}>back</button>
  ),
}));

const setupSupabase = () => {
  supabaseMock.from.mockImplementation((table: string) => {
    if (table === 'entry_bookmarks') {
      return {
        select: () => ({
          eq: async () => ({
            data: [{ entry_id: 'entry-1' }, { entry_id: 'entry-2' }, { entry_id: 'entry-1' }],
            error: null,
          }),
        }),
      };
    }
    return {
      select: () => ({
        eq: async () => ({ data: [], error: null }),
      }),
    };
  });
};

describe('SavedPostsPage functional flows', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    feedTabsSpy.mockReset();
    supabaseMock.from.mockReset();
    setupSupabase();
  });

  it('loads saved ids and opens post from saved list', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<SavedPostsPage session={{ user: { id: 'user-1' } } as never} onBack={onBack} />);

    await user.click(await screen.findByRole('button', { name: 'open-saved-entry' }));
    expect(navigateMock).toHaveBeenCalledWith('/posts/entry-1', { state: { returnTo: '/saved' } });

    const latestProps = feedTabsSpy.mock.calls.at(-1)?.[0];
    expect(latestProps).toMatchObject({
      currentUserId: 'user-1',
      entryIdsFilter: ['entry-1', 'entry-2'],
      hideHeader: true,
    });

    await user.click(screen.getByRole('button', { name: 'common.close' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows login helper when session is missing', async () => {
    render(<SavedPostsPage session={null} onBack={() => {}} />);
    expect(await screen.findByText('saved.loginHelper')).toBeInTheDocument();
  });
});
