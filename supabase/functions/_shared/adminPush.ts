import webpush from 'npm:web-push@3.6.7';

export type WebPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

const getRequiredPushConfiguration = () => {
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const subject = Deno.env.get('VAPID_SUBJECT');

  if (!publicKey || !privateKey || !subject) {
    throw new Error('Missing required push notification secrets.');
  }

  return { publicKey, privateKey, subject };
};

export const getWebPushStatusCode = (error: unknown) => {
  if (!error || typeof error !== 'object') return null;
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === 'number' ? statusCode : null;
};

export const sendAdminPush = async (
  subscription: WebPushSubscription,
  notification: {
    title: string;
    body: string;
    targetUrl: string;
    tag: string;
  }
) => {
  const configuration = getRequiredPushConfiguration();
  webpush.setVapidDetails(configuration.subject, configuration.publicKey, configuration.privateKey);

  await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    },
    JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: '/logo.png',
      badge: '/logo.png',
      tag: notification.tag,
      data: { url: notification.targetUrl },
    }),
    { TTL: 3600, urgency: 'normal' }
  );
};
