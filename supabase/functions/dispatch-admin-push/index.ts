import { createClient } from 'npm:@supabase/supabase-js@2.89.0';
import {
  processAdminDeliveries,
  type ClaimedAdminDelivery,
} from '../_shared/processAdminDeliveries.ts';

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
    console.error('Could not finalize notification campaigns', finalizeError);
  }

  return Response.json({ claimed, sent, skipped, failed });
});
