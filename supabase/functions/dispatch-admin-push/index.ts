import { createClient } from 'npm:@supabase/supabase-js@2.89.0';
import { getWebPushStatusCode, sendAdminPush } from '../_shared/adminPush.ts';

type ClaimedDelivery = {
  delivery_id: string;
  subscription_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  title: string;
  body: string;
  target_url: string;
  campaign_id: string;
  push_enabled: boolean;
  attempt_count: number;
};

const processInChunks = async <T>(items: T[], size: number, callback: (item: T) => Promise<void>) => {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(callback));
  }
};

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const schedulerSecret = Deno.env.get('PUSH_SCHEDULER_SECRET');
  if (!schedulerSecret || request.headers.get('x-scheduler-secret') !== schedulerSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response('Server configuration error', { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let claimed = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (let batch = 0; batch < 5; batch += 1) {
    const { data, error } = await supabase.rpc('claim_due_admin_notification_deliveries', {
      p_limit: 500,
    });

    if (error) {
      console.error('Could not claim scheduled push deliveries', error);
      return new Response('Database error', { status: 500 });
    }

    const deliveries = (data ?? []) as ClaimedDelivery[];
    claimed += deliveries.length;

    await processInChunks(deliveries, 25, async (delivery) => {
      if (!delivery.push_enabled) {
        skipped += 1;
        await supabase
          .from('admin_notification_deliveries')
          .update({
            status: 'skipped',
            error_message: 'Global push preference disabled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', delivery.delivery_id);
        return;
      }

      try {
        await sendAdminPush(delivery, {
          title: delivery.title,
          body: delivery.body,
          targetUrl: delivery.target_url,
          tag: `burger-wrapped-campaign-${delivery.campaign_id}`,
        });
        sent += 1;
        await supabase
          .from('admin_notification_deliveries')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', delivery.delivery_id);
      } catch (sendError) {
        const statusCode = getWebPushStatusCode(sendError);
        if (statusCode === 404 || statusCode === 410) {
          skipped += 1;
          await supabase.from('push_subscriptions').delete().eq('id', delivery.subscription_id);
          return;
        }

        failed += 1;
        console.error('Scheduled admin push failed', {
          deliveryId: delivery.delivery_id,
          statusCode,
          error: sendError,
        });
        await supabase
          .from('admin_notification_deliveries')
          .update({
            status: 'failed',
            error_message: sendError instanceof Error ? sendError.message.slice(0, 500) : 'Push delivery failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', delivery.delivery_id);
      }
    });

    if (deliveries.length < 500) {
      break;
    }
  }

  const { error: finalizeError } = await supabase.rpc('finalize_admin_notification_campaigns');
  if (finalizeError) {
    console.error('Could not finalize notification campaigns', finalizeError);
  }

  return Response.json({ claimed, sent, skipped, failed });
});
