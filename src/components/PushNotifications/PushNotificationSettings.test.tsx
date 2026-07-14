import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PushNotificationSettings } from './PushNotificationSettings';

const { pushMocks, supabaseMock } = vi.hoisted(() => ({
  pushMocks: {
    getCurrentPushSubscription: vi.fn(),
    subscribeToPushNotifications: vi.fn(),
    unsubscribeFromPushNotifications: vi.fn(),
  },
  supabaseMock: {
    from: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock('../../lib/pushNotifications', () => ({
  PUSH_SUBSCRIPTION_CHANGED_EVENT: 'bw-push-subscription-changed',
  PushNotificationError: class PushNotificationError extends Error {},
  VAPID_PUBLIC_KEY: 'public-key',
  getPushEnvironment: () => 'ready',
  ...pushMocks,
}));

vi.mock('../../lib/supabaseClient', () => ({
  supabase: supabaseMock,
}));

vi.mock('@mui/icons-material', () => ({
  NotificationsActive: () => null,
  NotificationsOff: () => null,
}));

describe('PushNotificationSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: { permission: 'default' },
    });
    pushMocks.getCurrentPushSubscription.mockResolvedValue(null);
    pushMocks.subscribeToPushNotifications.mockResolvedValue({ endpoint: 'endpoint' });
    pushMocks.unsubscribeFromPushNotifications.mockResolvedValue(undefined);
    supabaseMock.upsert.mockResolvedValue({ data: null, error: null });
    supabaseMock.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
      upsert: supabaseMock.upsert,
    }));
  });

  it('activates the current device after an explicit click', async () => {
    const user = userEvent.setup();
    render(<PushNotificationSettings userId="user-1" />);

    const activate = await screen.findByRole('button', { name: 'notifications.push.activateDevice' });
    await user.click(activate);

    expect(pushMocks.subscribeToPushNotifications).toHaveBeenCalledWith('user-1');
    expect(await screen.findByText('notifications.push.activated')).toBeInTheDocument();
  });

  it('persists the admin announcement preference separately', async () => {
    const user = userEvent.setup();
    render(<PushNotificationSettings userId="user-1" />);

    const toggles = await screen.findAllByRole('checkbox');
    expect(toggles).toHaveLength(5);
    await user.click(toggles[4]);

    await waitFor(() => {
      expect(supabaseMock.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ admin_announcements_enabled: false }),
        { onConflict: 'user_id' }
      );
    });
  });
});
