import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DashboardPlaceholder, FeedPlaceholder, GroupsPlaceholder, ProfilePlaceholder } from './LockedPlaceholders';

describe('LockedPlaceholders', () => {
  it('renderiza placeholders de dashboard y feed', () => {
    render(
      <div>
        <DashboardPlaceholder />
        <FeedPlaceholder />
      </div>
    );
    expect(screen.getByText('dashboard.posts')).toBeInTheDocument();
    expect(screen.getByText('feedTabs.following')).toBeInTheDocument();
  });

  it('renderiza placeholders de grupos y perfil', () => {
    render(
      <div>
        <GroupsPlaceholder />
        <ProfilePlaceholder />
      </div>
    );
    expect(screen.getAllByText('common.groups').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.bw-locked-list-item').length).toBeGreaterThan(0);
  });
});
