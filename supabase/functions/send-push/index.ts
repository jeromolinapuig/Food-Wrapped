import { createClient } from 'npm:@supabase/supabase-js@2.89.0';
import webpush from 'npm:web-push@3.6.7';

type NotificationType = 'like' | 'comment' | 'follow' | 'group_invite';

type NotificationRow = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: NotificationType;
  entry_id: string | null;
  group_id: string | null;
  invitation_id: string | null;
  push_sent_at: string | null;
};

type WebhookPayload = {
  type: 'INSERT';
  table: 'notifications';
  record: NotificationRow;
};

type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type NotificationPreferences = {
  push_enabled: boolean;
  likes_enabled: boolean;
  comments_enabled: boolean;
  follows_enabled: boolean;
  group_invites_enabled: boolean;
};

const DEFAULT_PREFERENCES: NotificationPreferences = {
  push_enabled: true,
  likes_enabled: true,
  comments_enabled: true,
  follows_enabled: true,
  group_invites_enabled: true,
};

const SUPPORTED_LANGUAGES = new Set(['en', 'es', 'th', 'fr', 'it', 'de', 'ja']);

const messages: Record<string, Record<NotificationType, (actor: string, group: string) => string>> = {
  en: {
    like: (actor) => `${actor} liked your post.`,
    comment: (actor) => `${actor} commented on your post.`,
    follow: (actor) => `@${actor} followed you.`,
    group_invite: (actor, group) => `@${actor} invited you to join ${group}.`,
  },
  es: {
    like: (actor) => `A ${actor} le ha gustado tu post.`,
    comment: (actor) => `${actor} ha comentado tu post.`,
    follow: (actor) => `@${actor} te ha seguido.`,
    group_invite: (actor, group) => `@${actor} te ha invitado al grupo ${group}.`,
  },
  th: {
    like: (actor) => `${actor} ถูกใจโพสต์ของคุณ`,
    comment: (actor) => `${actor} แสดงความคิดเห็นในโพสต์ของคุณ`,
    follow: (actor) => `@${actor} ติดตามคุณ`,
    group_invite: (actor, group) => `@${actor} เชิญคุณเข้าร่วม ${group}`,
  },
  fr: {
    like: (actor) => `${actor} a aimé votre publication.`,
    comment: (actor) => `${actor} a commenté votre publication.`,
    follow: (actor) => `@${actor} vous suit.`,
    group_invite: (actor, group) => `@${actor} vous a invité à rejoindre ${group}.`,
  },
  it: {
    like: (actor) => `${actor} ha messo Mi piace al tuo post.`,
    comment: (actor) => `${actor} ha commentato il tuo post.`,
    follow: (actor) => `@${actor} ha iniziato a seguirti.`,
    group_invite: (actor, group) => `@${actor} ti ha invitato a unirti a ${group}.`,
  },
  de: {
    like: (actor) => `${actor} gefällt dein Beitrag.`,
    comment: (actor) => `${actor} hat deinen Beitrag kommentiert.`,
    follow: (actor) => `@${actor} folgt dir jetzt.`,
    group_invite: (actor, group) => `@${actor} hat dich zu ${group} eingeladen.`,
  },
  ja: {
    like: (actor) => `${actor}さんがあなたの投稿に「いいね」しました。`,
    comment: (actor) => `${actor}さんがあなたの投稿にコメントしました。`,
    follow: (actor) => `@${actor}さんがあなたをフォローしました。`,
    group_invite: (actor, group) => `@${actor}さんが${group}に招待しました。`,
  },
};

const preferenceForType: Record<NotificationType, keyof NotificationPreferences> = {
  like: 'likes_enabled',
  comment: 'comments_enabled',
  follow: 'follows_enabled',
  group_invite: 'group_invites_enabled',
};

const getNotificationUrl = (notification: NotificationRow) => {
  if ((notification.type === 'like' || notification.type === 'comment') && notification.entry_id) {
    return `/posts/${notification.entry_id}`;
  }
  if (notification.type === 'follow' && notification.actor_id) {
    return `/users/${notification.actor_id}`;
  }
  return '/groups';
};

const getStatusCode = (error: unknown) => {
  if (!error || typeof error !== 'object') return null;
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === 'number' ? statusCode : null;
};

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const webhookSecret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (!webhookSecret || request.headers.get('x-webhook-secret') !== webhookSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT');

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    console.error('Missing required push notification secrets.');
    return new Response('Server configuration error', { status: 500 });
  }

  let payload: WebhookPayload;
  try {
    payload = await request.json() as WebhookPayload;
  } catch {
    return new Response('Invalid JSON payload', { status: 400 });
  }

  if (payload.type !== 'INSERT' || payload.table !== 'notifications' || !payload.record?.id) {
    return new Response('Unsupported webhook payload', { status: 400 });
  }

  const notification = payload.record;
  if (!preferenceForType[notification.type]) {
    return new Response('Unsupported notification type', { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: currentNotification, error: notificationError } = await supabase
    .from('notifications')
    .select('push_sent_at')
    .eq('id', notification.id)
    .maybeSingle();

  if (notificationError) {
    console.error('Could not verify notification state', notificationError);
    return new Response('Database error', { status: 500 });
  }

  if (currentNotification?.push_sent_at) {
    return Response.json({ sent: 0, skipped: 'already_processed' });
  }

  const [{ data: preferences }, { data: subscriptions, error: subscriptionsError }] = await Promise.all([
    supabase
      .from('notification_preferences')
      .select('push_enabled, likes_enabled, comments_enabled, follows_enabled, group_invites_enabled')
      .eq('user_id', notification.user_id)
      .maybeSingle(),
    supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', notification.user_id),
  ]);

  if (subscriptionsError) {
    console.error('Could not load push subscriptions', subscriptionsError);
    return new Response('Database error', { status: 500 });
  }

  const resolvedPreferences = (preferences ?? DEFAULT_PREFERENCES) as NotificationPreferences;
  const typePreference = preferenceForType[notification.type];
  const shouldSend = resolvedPreferences.push_enabled && resolvedPreferences[typePreference];
  const subscriptionRows = (subscriptions ?? []) as PushSubscriptionRow[];

  if (!shouldSend || subscriptionRows.length === 0) {
    await supabase
      .from('notifications')
      .update({ push_sent_at: new Date().toISOString() })
      .eq('id', notification.id);
    return Response.json({ sent: 0, skipped: shouldSend ? 'no_subscriptions' : 'preference_disabled' });
  }

  const [{ data: recipientProfile }, { data: actorProfile }, groupResponse] = await Promise.all([
    supabase
      .from('profiles')
      .select('preferred_language')
      .eq('id', notification.user_id)
      .maybeSingle(),
    notification.actor_id
      ? supabase
          .from('profiles')
          .select('username, display_name')
          .eq('id', notification.actor_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    notification.group_id
      ? supabase
          .from('groups')
          .select('name')
          .eq('id', notification.group_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const requestedLanguage = recipientProfile?.preferred_language ?? 'en';
  const language = SUPPORTED_LANGUAGES.has(requestedLanguage) ? requestedLanguage : 'en';
  const actor = actorProfile?.username ?? actorProfile?.display_name ?? (language === 'es' ? 'Alguien' : 'Someone');
  const group = groupResponse.data?.name ?? (language === 'es' ? 'tu grupo' : 'your group');
  const body = messages[language][notification.type](actor, group);

  const pushPayload = JSON.stringify({
    title: 'Burger Wrapped',
    body,
    icon: '/logo.png',
    badge: '/logo.png',
    tag: `burger-wrapped-${notification.id}`,
    data: {
      url: getNotificationUrl(notification),
      notificationId: notification.id,
    },
  });

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  let sent = 0;
  let transientFailures = 0;
  await Promise.all(subscriptionRows.map(async (subscription) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        pushPayload,
        { TTL: 3600, urgency: 'normal' }
      );
      sent += 1;
    } catch (error) {
      const statusCode = getStatusCode(error);
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
        return;
      }
      transientFailures += 1;
      console.error('Push delivery failed', { statusCode, error });
    }
  }));

  if (transientFailures > 0 && sent === 0) {
    return Response.json({ sent, failed: transientFailures }, { status: 502 });
  }

  const { error: markSentError } = await supabase
    .from('notifications')
    .update({ push_sent_at: new Date().toISOString() })
    .eq('id', notification.id);

  if (markSentError) {
    console.error('Could not mark notification as processed', markSentError);
  }

  return Response.json({ sent, failed: transientFailures });
});
