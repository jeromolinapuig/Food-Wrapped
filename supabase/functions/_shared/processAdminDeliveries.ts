import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.89.0';
import { getWebPushStatusCode, sendAdminPush } from './adminPush.ts';

export type ClaimedAdminDelivery = {
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

export type AdminDeliveryResult = {
  sent: number;
  skipped: number;
  failed: number;
};

export const processAdminDeliveries = async (
  supabase: SupabaseClient,
  deliveries: ClaimedAdminDelivery[]
): Promise<AdminDeliveryResult> => {
  const result: AdminDeliveryResult = { sent: 0, skipped: 0, failed: 0 };

  for (let index = 0; index < deliveries.length; index += 25) {
    await Promise.all(deliveries.slice(index, index + 25).map(async (delivery) => {
      if (!delivery.push_enabled) {
        result.skipped += 1;
        await supabase
          .from('admin_notification_deliveries')
          .update({
            status: 'skipped',
            error_message: 'Administrative announcements disabled',
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
        result.sent += 1;
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
          result.skipped += 1;
          await supabase.from('push_subscriptions').delete().eq('id', delivery.subscription_id);
          return;
        }

        result.failed += 1;
        console.error('Admin push delivery failed', {
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
    }));
  }

  return result;
};
