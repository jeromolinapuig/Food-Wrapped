import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, rpcMock, upsertMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  upsertMock: vi.fn(),
}));

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
  },
}));

const subscription = {
  endpoint: 'https://push.example/subscription',
  toJSON: () => ({
    endpoint: 'https://push.example/subscription',
    keys: { p256dh: 'p256dh', auth: 'auth' },
  }),
  unsubscribe: vi.fn(),
} as unknown as PushSubscription;

const prepareBrowser = (subscribe: ReturnType<typeof vi.fn>) => {
  const registration = {
    pushManager: {
      getSubscription: vi.fn(),
      subscribe,
    },
  } as unknown as ServiceWorkerRegistration;

  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve(registration) },
  });
  Object.defineProperty(window, 'PushManager', { configurable: true, value: class PushManager {} });
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: { permission: 'default', requestPermission: vi.fn() },
  });
};

describe('pushNotifications Safari-compatible subscription flow', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'AQIDBA');
    rpcMock.mockResolvedValue({ error: null });
    upsertMock.mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ upsert: upsertMock });
  });

  it('starts PushManager.subscribe without requesting permission separately', async () => {
    const subscribe = vi.fn().mockResolvedValue(subscription);
    prepareBrowser(subscribe);
    const { subscribeToPushNotifications } = await import('./pushNotifications');

    await subscribeToPushNotifications('user-1');

    expect(Notification.requestPermission).not.toHaveBeenCalled();
    expect(subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: new Uint8Array([1, 2, 3, 4]),
    });
    expect(rpcMock).toHaveBeenCalledWith(
      'register_push_subscription',
      expect.objectContaining({ p_endpoint: subscription.endpoint })
    );
  });

  it('maps WebKit permission rejections to a permission error', async () => {
    prepareBrowser(vi.fn().mockRejectedValue(new DOMException('Not allowed', 'NotAllowedError')));
    const { subscribeToPushNotifications } = await import('./pushNotifications');

    await expect(subscribeToPushNotifications('user-1')).rejects.toMatchObject({
      code: 'permission_denied',
    });
  });

  it('explains the minimum iOS version when an installed app has no Push API', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X)',
    });
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: new Promise<ServiceWorkerRegistration>(() => undefined) },
    });
    Object.defineProperty(window, 'Notification', { configurable: true, value: { permission: 'default' } });
    Reflect.deleteProperty(window, 'PushManager');
    const { getPushEnvironment } = await import('./pushNotifications');

    expect(getPushEnvironment()).toBe('ios_requires_update');
  });
});
