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
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: { permission: 'default' },
    });
    pushMocks.getCurrentPushSubscription.mockResolvedValue(null);
    pushMocks.subscribeToPushNotifications.mockResolvedValue({ endpoint: 'endpoint' });
    pushMocks.unsubscribeFromPushNotifications.mockResolvedValue(undefined);
    supabaseMock.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
      upsert: async () => ({ data: null, error: null }),
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

  it('persists per-event preferences', async () => {
    const user = userEvent.setup();
    render(<PushNotificationSettings userId="user-1" />);

    const toggles = await screen.findAllByRole('checkbox');
    await user.click(toggles[0]);

    await waitFor(() => {
      expect(supabaseMock.from).toHaveBeenCalledWith('notification_preferences');
    });
  });
});
