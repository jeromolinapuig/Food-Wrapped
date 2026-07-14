import { createClient } from 'npm:@supabase/supabase-js@2.89.0';
import { getWebPushStatusCode, sendAdminPush } from '../_shared/adminPush.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: unknown, status = 200) => Response.json(body, {
  status,
  headers: corsHeaders,
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('authorization');
  const accessToken = authorization?.replace(/^Bearer\s+/i, '');

  if (!supabaseUrl || !serviceRoleKey || !accessToken) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  const userId = authData.user?.id;

  if (authError || !userId) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle();

  if (!profile?.is_admin) {
    return jsonResponse({ error: 'Administrator access required' }, 403);
  }

  let payload: { endpoint?: unknown; title?: unknown; body?: unknown; targetUrl?: unknown };
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload' }, 400);
  }

  const endpoint = typeof payload.endpoint === 'string' ? payload.endpoint.trim() : '';
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const body = typeof payload.body === 'string' ? payload.body.trim() : '';
  const targetUrl = typeof payload.targetUrl === 'string' ? payload.targetUrl.trim() : '';
  const isValidTargetUrl = targetUrl === '/' || /^\/[^/]/.test(targetUrl);

  if (!endpoint || !title || title.length > 80 || !body || body.length > 240 || targetUrl.length > 500 || !isValidTargetUrl) {
    return jsonResponse({ error: 'Invalid notification preview' }, 400);
  }

  const { data: subscription, error: subscriptionError } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)
    .eq('endpoint', endpoint)
    .maybeSingle();

  if (subscriptionError || !subscription) {
    return jsonResponse({ error: 'This device is not registered for push notifications' }, 404);
  }

  try {
    await sendAdminPush(subscription, {
      title,
      body,
      targetUrl,
      tag: `burger-wrapped-preview-${crypto.randomUUID()}`,
    });
  } catch (error) {
    const statusCode = getWebPushStatusCode(error);
    if (statusCode === 404 || statusCode === 410) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
      return jsonResponse({ error: 'The push subscription for this device has expired' }, 410);
    }
    console.error('Admin push preview failed', { statusCode, error });
    return jsonResponse({ error: 'Could not send the notification preview' }, 502);
  }

  return jsonResponse({ sent: true });
});
