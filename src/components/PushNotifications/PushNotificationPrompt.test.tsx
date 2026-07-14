import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PushNotificationPrompt } from './PushNotificationPrompt';

const { pushMocks } = vi.hoisted(() => ({
  pushMocks: {
    subscribeToPushNotifications: vi.fn(),
    syncCurrentPushSubscription: vi.fn(),
  },
}));

vi.mock('../../lib/pushNotifications', () => ({
  PushNotificationError: class PushNotificationError extends Error {},
  VAPID_PUBLIC_KEY: 'public-key',
  getPushEnvironment: () => 'ready',
  ...pushMocks,
}));

vi.mock('@mui/icons-material', () => ({
  IosShare: () => null,
  NotificationsActive: () => null,
}));

describe('PushNotificationPrompt', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: { permission: 'default' },
    });
    pushMocks.subscribeToPushNotifications.mockResolvedValue({ endpoint: 'endpoint' });
    pushMocks.syncCurrentPushSubscription.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('requests the native permission flow only after the user activates it', async () => {
    render(<PushNotificationPrompt userId="user-1" enabled />);

    expect(pushMocks.subscribeToPushNotifications).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1800);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'notifications.push.activate' }));
      await Promise.resolve();
    });

    expect(pushMocks.subscribeToPushNotifications).toHaveBeenCalledWith('user-1');
    expect(window.localStorage.getItem('bw-push-prompt-dismissed:user-1')).toBe('1');
  });
});
