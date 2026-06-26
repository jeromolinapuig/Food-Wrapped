import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedPage } from './FeedPage';

type MockSession = {
  user: {
    id: string;
  };
};

const { navigateMock, userProfileState } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  userProfileState: {
    open: false,
    userId: null as string | null,
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../common/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../common/PageHeader', () => ({
  PageHeader: ({ title }: { title: ReactNode }) => <h1>{title}</h1>,
}));

vi.mock('../common/BackButton', () => ({
  BackButton: ({ onClick, ariaLabel }: { onClick: () => void; ariaLabel: string }) => (
    <button type="button" onClick={onClick} aria-label={ariaLabel}>back</button>
  ),
}));

vi.mock('../FeedTabs/FeedTabs', () => ({
  FeedTabs: ({
    onOpenEntry,
    onOpenProfile,
  }: {
    onOpenEntry?: (entryId: string) => void;
    onOpenProfile?: (userId: string) => void;
  }) => (
    <div>
      <span>feed-tabs</span>
      {onOpenEntry ? <button type="button" onClick={() => onOpenEntry('entry-1')}>open-entry</button> : null}
      {onOpenProfile ? <button type="button" onClick={() => onOpenProfile('target-1')}>open-profile</button> : null}
    </div>
  ),
}));

vi.mock('../UserProfileModal/UserProfileModal', () => ({
  UserProfileModal: ({ open, userId }: { open: boolean; userId: string | null }) => {
    userProfileState.open = open;
    userProfileState.userId = userId;
    return open ? <div>{`profile-modal-${userId}`}</div> : null;
  },
}));

const renderFeedPage = (session: MockSession | null, onRequireLogin = vi.fn()) =>
  render(
    <FeedPage
      session={session as never}
      theme="light"
      onToggleTheme={() => {}}
      onNavigate={() => {}}
      onRequireLogin={onRequireLogin}
    />
  );

describe('FeedPage functional flows', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    userProfileState.open = false;
    userProfileState.userId = null;
  });

  it('navigates to post details from feed entries', async () => {
    const user = userEvent.setup();
    const session: MockSession = { user: { id: 'user-1' } };
    renderFeedPage(session);

    await user.click(screen.getByRole('button', { name: 'open-entry' }));
    expect(navigateMock).toHaveBeenCalledWith('/posts/entry-1', { state: { returnTo: '/feed' } });
  });

  it('opens profile modal from feed entries', async () => {
    const user = userEvent.setup();
    const session: MockSession = { user: { id: 'user-1' } };
    renderFeedPage(session);

    await user.click(screen.getByRole('button', { name: 'open-profile' }));
    expect(userProfileState.open).toBe(true);
    expect(userProfileState.userId).toBe('target-1');
  });
});
