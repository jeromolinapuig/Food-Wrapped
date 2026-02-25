import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FeedHeader } from './FeedHeader';

describe('FeedHeader', () => {
  it('cambia entre tabs global/following', () => {
    const onTabChange = vi.fn();
    const onAuthNoticeChange = vi.fn();
    render(
      <FeedHeader
        hideHeader={false}
        isUserFeed={false}
        isCustomList={false}
        activeTab="global"
        onTabChange={onTabChange}
        isReadOnly={false}
        authNotice={null}
        onAuthNoticeChange={onAuthNoticeChange}
        effectiveMonthFilter="all"
        onMonthFilterChange={() => {}}
        monthOptions={[{ value: 'all', label: 'All' }]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Following' }));
    fireEvent.click(screen.getByRole('button', { name: 'Global' }));
    expect(onTabChange).toHaveBeenCalledWith('following');
    expect(onTabChange).toHaveBeenCalledWith('global');
  });

  it('muestra filtro de mes en feed de usuario', () => {
    const onMonthFilterChange = vi.fn();
    render(
      <FeedHeader
        hideHeader={false}
        isUserFeed
        isCustomList={false}
        activeTab="global"
        onTabChange={() => {}}
        isReadOnly={false}
        authNotice={null}
        onAuthNoticeChange={() => {}}
        effectiveMonthFilter="2026-02"
        onMonthFilterChange={onMonthFilterChange}
        monthOptions={[
          { value: 'all', label: 'All' },
          { value: '2026-02', label: 'Febrero' },
        ]}
      />
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'all' } });
    expect(onMonthFilterChange).toHaveBeenCalledWith('all');
  });
});
