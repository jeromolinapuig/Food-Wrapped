import { createClient } from 'npm:@supabase/supabase-js@2.89.0';
import {
  processAdminDeliveries,
  type ClaimedAdminDelivery,
} from '../_shared/processAdminDeliveries.ts';

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

  let payload: { title?: unknown; body?: unknown; targetUrl?: unknown };
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload' }, 400);
  }

  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const body = typeof payload.body === 'string' ? payload.body.trim() : '';
  const targetUrl = typeof payload.targetUrl === 'string' ? payload.targetUrl.trim() : '';
  const isValidTargetUrl = targetUrl === '/' || /^\/[^/]/.test(targetUrl);

  if (!title || title.length > 80 || !body || body.length > 240 || targetUrl.length > 500 || !isValidTargetUrl) {
    return jsonResponse({ error: 'Invalid notification' }, 400);
  }

  const { data: campaignId, error: campaignError } = await supabase.rpc(
    'create_immediate_admin_notification_campaign',
    {
      p_created_by: userId,
      p_title: title,
      p_body: body,
      p_target_url: targetUrl,
    }
  );

  if (campaignError || !campaignId) {
    const forbidden = campaignError?.message.includes('Administrator access required');
    console.error('Could not create immediate notification campaign', campaignError);
    return jsonResponse(
      { error: forbidden ? 'Administrator access required' : 'Could not create notification campaign' },
      forbidden ? 403 : 500
    );
  }

  let claimed = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (let batch = 0; batch < 5; batch += 1) {
    const { data, error } = await supabase.rpc('claim_admin_notification_campaign_deliveries', {
      p_campaign_id: campaignId,
      p_limit: 500,
    });

    if (error) {
      console.error('Could not claim immediate push deliveries', { campaignId, error });
      return jsonResponse({
        campaignId,
        error: 'The campaign was created and will be retried by the scheduler',
      }, 202);
    }

    const deliveries = (data ?? []) as ClaimedAdminDelivery[];
    claimed += deliveries.length;
    const batchResult = await processAdminDeliveries(supabase, deliveries);
    sent += batchResult.sent;
    skipped += batchResult.skipped;
    failed += batchResult.failed;

    if (deliveries.length < 500) {
      break;
    }
  }

  const { error: finalizeError } = await supabase.rpc('finalize_admin_notification_campaigns');
  if (finalizeError) {
    console.error('Could not finalize immediate notification campaign', { campaignId, finalizeError });
  }

  return jsonResponse({ campaignId, claimed, sent, skipped, failed });
});
