import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostPage } from './PostPage';

type FeedTabsProps = {
  currentUserId: string | null;
  isReadOnly: boolean;
  entryIdsFilter: string[];
  hideHeader: boolean;
  commentMode: string;
};

const { feedTabsSpy, scrollToSpy } = vi.hoisted(() => ({
  feedTabsSpy: vi.fn<(props: FeedTabsProps) => void>(),
  scrollToSpy: vi.fn(),
}));

vi.mock('../FeedTabs/FeedTabs', () => ({
  FeedTabs: (props: FeedTabsProps) => {
    feedTabsSpy(props);
    return <div>feed-tabs-post</div>;
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

describe('PostPage functional flows', () => {
  const mainScrollSpy = vi.fn();

  beforeEach(() => {
    Object.defineProperty(Element.prototype, 'scrollTo', {
      configurable: true,
      value: mainScrollSpy,
    });
    Object.defineProperty(window, 'scrollTo', {
      configurable: true,
      value: scrollToSpy,
    });
    mainScrollSpy.mockClear();
    scrollToSpy.mockClear();
  });

  it('renders single-entry feed with full comment mode and handles back', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(
      <PostPage
        session={{ user: { id: 'user-1' } } as never}
        entryId="entry-77"
        onBack={onBack}
      />
    );

    expect(screen.getByText('feed-tabs-post')).toBeInTheDocument();
    const latestCall = feedTabsSpy.mock.calls.at(-1)?.[0];
    expect(latestCall).toMatchObject({
      currentUserId: 'user-1',
      isReadOnly: false,
      entryIdsFilter: ['entry-77'],
      hideHeader: true,
      commentMode: 'full',
    });

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(scrollToSpy).toHaveBeenCalled();
  });

  it('sets read-only mode when there is no session', () => {
    render(<PostPage session={null} entryId="entry-99" onBack={() => {}} />);
    const latestCall = feedTabsSpy.mock.calls.at(-1)?.[0];
    expect(latestCall).toMatchObject({
      currentUserId: null,
      isReadOnly: true,
    });
  });
});
