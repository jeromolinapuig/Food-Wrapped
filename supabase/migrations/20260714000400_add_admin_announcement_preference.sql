alter table public.notification_preferences
  add column if not exists admin_announcements_enabled boolean not null default true;

comment on column public.notification_preferences.admin_announcements_enabled is
  'Controls Web Push campaigns created by administrators.';

create or replace function public.claim_due_admin_notification_deliveries(p_limit integer default 100)
returns table (
  delivery_id uuid,
  subscription_id uuid,
  endpoint text,
  p256dh text,
  auth text,
  title text,
  body text,
  target_url text,
  campaign_id uuid,
  push_enabled boolean,
  attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select delivery.id
    from public.admin_notification_deliveries as delivery
    join public.admin_notification_campaigns as campaign
      on campaign.id = delivery.campaign_id
    where campaign.status = 'scheduled'
      and delivery.scheduled_for <= now()
      and delivery.attempt_count < 3
      and (
        delivery.status = 'queued'
        or (
          delivery.status = 'failed'
          and delivery.last_attempt_at < now() - interval '1 minute'
        )
        or (
          delivery.status = 'processing'
          and delivery.last_attempt_at < now() - interval '10 minutes'
        )
      )
    order by delivery.scheduled_for
    for update of delivery skip locked
    limit greatest(1, least(coalesce(p_limit, 100), 500))
  ), claimed as (
    update public.admin_notification_deliveries as delivery
    set status = 'processing',
        attempt_count = delivery.attempt_count + 1,
        last_attempt_at = now(),
        updated_at = now()
    from due
    where delivery.id = due.id
    returning delivery.*
  )
  select
    claimed.id,
    subscription.id,
    subscription.endpoint,
    subscription.p256dh,
    subscription.auth,
    campaign.title,
    campaign.body,
    campaign.target_url,
    campaign.id,
    coalesce(preferences.push_enabled, true)
      and coalesce(preferences.admin_announcements_enabled, true),
    claimed.attempt_count
  from claimed
  join public.push_subscriptions as subscription
    on subscription.id = claimed.subscription_id
  join public.admin_notification_campaigns as campaign
    on campaign.id = claimed.campaign_id
  left join public.notification_preferences as preferences
    on preferences.user_id = subscription.user_id;
end;
$$;

revoke all on function public.claim_due_admin_notification_deliveries(integer) from public;
grant execute on function public.claim_due_admin_notification_deliveries(integer) to service_role;

create or replace function public.claim_admin_notification_campaign_deliveries(
  p_campaign_id uuid,
  p_limit integer default 100
)
returns table (
  delivery_id uuid,
  subscription_id uuid,
  endpoint text,
  p256dh text,
  auth text,
  title text,
  body text,
  target_url text,
  campaign_id uuid,
  push_enabled boolean,
  attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select delivery.id
    from public.admin_notification_deliveries as delivery
    join public.admin_notification_campaigns as campaign
      on campaign.id = delivery.campaign_id
    where campaign.id = p_campaign_id
      and campaign.status = 'scheduled'
      and delivery.scheduled_for <= now()
      and delivery.attempt_count < 3
      and (
        delivery.status = 'queued'
        or (
          delivery.status = 'failed'
          and delivery.last_attempt_at < now() - interval '1 minute'
        )
        or (
          delivery.status = 'processing'
          and delivery.last_attempt_at < now() - interval '10 minutes'
        )
      )
    order by delivery.scheduled_for
    for update of delivery skip locked
    limit greatest(1, least(coalesce(p_limit, 100), 500))
  ), claimed as (
    update public.admin_notification_deliveries as delivery
    set status = 'processing',
        attempt_count = delivery.attempt_count + 1,
        last_attempt_at = now(),
        updated_at = now()
    from due
    where delivery.id = due.id
    returning delivery.*
  )
  select
    claimed.id,
    subscription.id,
    subscription.endpoint,
    subscription.p256dh,
    subscription.auth,
    campaign.title,
    campaign.body,
    campaign.target_url,
    campaign.id,
    coalesce(preferences.push_enabled, true)
      and coalesce(preferences.admin_announcements_enabled, true),
    claimed.attempt_count
  from claimed
  join public.push_subscriptions as subscription
    on subscription.id = claimed.subscription_id
  join public.admin_notification_campaigns as campaign
    on campaign.id = claimed.campaign_id
  left join public.notification_preferences as preferences
    on preferences.user_id = subscription.user_id;
end;
$$;

revoke all on function public.claim_admin_notification_campaign_deliveries(uuid, integer) from public;
grant execute on function public.claim_admin_notification_campaign_deliveries(uuid, integer) to service_role;
