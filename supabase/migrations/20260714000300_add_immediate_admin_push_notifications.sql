alter table public.admin_notification_campaigns
  add column if not exists delivery_mode text not null default 'scheduled'
  check (delivery_mode in ('scheduled', 'immediate'));

create or replace function public.queue_admin_notification_deliveries(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.admin_notification_deliveries
  where campaign_id = p_campaign_id;

  insert into public.admin_notification_deliveries (
    campaign_id,
    subscription_id,
    scheduled_for
  )
  select
    campaign.id,
    subscription.id,
    campaign.scheduled_for_local at time zone subscription.timezone
  from public.admin_notification_campaigns as campaign
  cross join public.push_subscriptions as subscription
  where campaign.id = p_campaign_id
    and campaign.status = 'scheduled'
    and campaign.delivery_mode = 'scheduled'
    and campaign.scheduled_for_local at time zone subscription.timezone > now();
end;
$$;

revoke all on function public.queue_admin_notification_deliveries(uuid) from public;

create or replace function public.admin_update_notification_campaign(
  p_campaign_id uuid,
  p_title text,
  p_body text,
  p_target_url text,
  p_scheduled_for_local timestamp without time zone
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.validate_admin_notification_campaign(
    p_title,
    p_body,
    p_target_url,
    p_scheduled_for_local
  );

  if not exists (
    select 1
    from public.admin_notification_campaigns
    where id = p_campaign_id
      and status = 'scheduled'
      and delivery_mode = 'scheduled'
  ) then
    raise exception 'Only future scheduled campaigns can be edited';
  end if;

  if exists (
    select 1
    from public.admin_notification_deliveries
    where campaign_id = p_campaign_id
      and (scheduled_for <= now() or status not in ('queued', 'failed'))
  ) then
    raise exception 'This campaign has already started and can no longer be edited';
  end if;

  update public.admin_notification_campaigns
  set title = trim(p_title),
      body = trim(p_body),
      target_url = p_target_url,
      scheduled_for_local = p_scheduled_for_local,
      updated_at = now()
  where id = p_campaign_id;

  perform public.queue_admin_notification_deliveries(p_campaign_id);
end;
$$;

revoke all on function public.admin_update_notification_campaign(uuid, text, text, text, timestamp without time zone) from public;
grant execute on function public.admin_update_notification_campaign(uuid, text, text, text, timestamp without time zone) to authenticated;

create or replace function public.admin_cancel_notification_campaign(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Administrator access required';
  end if;

  if exists (
    select 1
    from public.admin_notification_deliveries
    where campaign_id = p_campaign_id
      and status in ('processing', 'sent')
  ) then
    raise exception 'This campaign has already started and can no longer be cancelled';
  end if;

  update public.admin_notification_campaigns
  set status = 'cancelled',
      cancelled_at = now(),
      updated_at = now()
  where id = p_campaign_id
    and status = 'scheduled'
    and delivery_mode = 'scheduled';

  if not found then
    raise exception 'Only future scheduled campaigns can be cancelled';
  end if;

  delete from public.admin_notification_deliveries
  where campaign_id = p_campaign_id;
end;
$$;

revoke all on function public.admin_cancel_notification_campaign(uuid) from public;
grant execute on function public.admin_cancel_notification_campaign(uuid) to authenticated;

create or replace function public.queue_new_subscription_for_admin_campaigns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.timezone is not distinct from new.timezone then
    return new;
  end if;

  delete from public.admin_notification_deliveries as delivery
  using public.admin_notification_campaigns as campaign
  where delivery.campaign_id = campaign.id
    and delivery.subscription_id = new.id
    and delivery.status in ('queued', 'failed')
    and campaign.delivery_mode = 'scheduled';

  insert into public.admin_notification_deliveries (
    campaign_id,
    subscription_id,
    scheduled_for
  )
  select
    campaign.id,
    new.id,
    campaign.scheduled_for_local at time zone new.timezone
  from public.admin_notification_campaigns as campaign
  where campaign.status = 'scheduled'
    and campaign.delivery_mode = 'scheduled'
    and campaign.scheduled_for_local at time zone new.timezone > now()
  on conflict (campaign_id, subscription_id)
  do update set scheduled_for = excluded.scheduled_for,
                status = 'queued',
                attempt_count = 0,
                last_attempt_at = null,
                error_message = null,
                updated_at = now()
  where admin_notification_deliveries.status in ('queued', 'failed');

  return new;
end;
$$;

create or replace function public.create_immediate_admin_notification_campaign(
  p_created_by uuid,
  p_title text,
  p_body text,
  p_target_url text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_campaign_id uuid;
begin
  if not exists (
    select 1
    from public.profiles
    where id = p_created_by
      and is_admin is true
  ) then
    raise exception 'Administrator access required';
  end if;

  if char_length(trim(coalesce(p_title, ''))) not between 1 and 80 then
    raise exception 'Title must contain between 1 and 80 characters';
  end if;

  if char_length(trim(coalesce(p_body, ''))) not between 1 and 240 then
    raise exception 'Message must contain between 1 and 240 characters';
  end if;

  if coalesce(p_target_url, '') !~ '^/[^/]*'
    or char_length(p_target_url) > 500 then
    raise exception 'Target URL must be a relative application path';
  end if;

  insert into public.admin_notification_campaigns (
    title,
    body,
    target_url,
    scheduled_for_local,
    delivery_mode,
    created_by
  )
  values (
    trim(p_title),
    trim(p_body),
    p_target_url,
    now() at time zone 'UTC',
    'immediate',
    p_created_by
  )
  returning id into created_campaign_id;

  insert into public.admin_notification_deliveries (
    campaign_id,
    subscription_id,
    scheduled_for
  )
  select
    created_campaign_id,
    subscription.id,
    now()
  from public.push_subscriptions as subscription;

  return created_campaign_id;
end;
$$;

revoke all on function public.create_immediate_admin_notification_campaign(uuid, text, text, text) from public;
grant execute on function public.create_immediate_admin_notification_campaign(uuid, text, text, text) to service_role;

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
    coalesce(preferences.push_enabled, true),
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

create or replace function public.finalize_admin_notification_campaigns()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.admin_notification_campaigns as campaign
  set status = 'completed',
      updated_at = now()
  where campaign.status = 'scheduled'
    and (
      campaign.delivery_mode = 'immediate'
      or (campaign.scheduled_for_local at time zone 'UTC') + interval '12 hours' <= now()
    )
    and not exists (
      select 1
      from public.admin_notification_deliveries as delivery
      where delivery.campaign_id = campaign.id
        and (
          delivery.status in ('queued', 'processing')
          or (delivery.status = 'failed' and delivery.attempt_count < 3)
        )
    );
$$;

revoke all on function public.finalize_admin_notification_campaigns() from public;
grant execute on function public.finalize_admin_notification_campaigns() to service_role;

drop function public.admin_list_notification_campaigns();

create function public.admin_list_notification_campaigns()
returns table (
  id uuid,
  title text,
  body text,
  target_url text,
  scheduled_for_local timestamp without time zone,
  delivery_mode text,
  status text,
  created_at timestamptz,
  queued_count bigint,
  sent_count bigint,
  failed_count bigint,
  skipped_count bigint,
  can_edit boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Administrator access required';
  end if;

  return query
  select
    campaign.id,
    campaign.title,
    campaign.body,
    campaign.target_url,
    campaign.scheduled_for_local,
    campaign.delivery_mode,
    campaign.status,
    campaign.created_at,
    count(delivery.id) filter (where delivery.status in ('queued', 'processing')),
    count(delivery.id) filter (where delivery.status = 'sent'),
    count(delivery.id) filter (where delivery.status = 'failed'),
    count(delivery.id) filter (where delivery.status = 'skipped'),
    campaign.delivery_mode = 'scheduled'
      and campaign.status = 'scheduled'
      and not coalesce(bool_or(
        delivery.scheduled_for <= now()
        or delivery.status not in ('queued', 'failed')
      ), false)
  from public.admin_notification_campaigns as campaign
  left join public.admin_notification_deliveries as delivery
    on delivery.campaign_id = campaign.id
  group by campaign.id
  order by campaign.created_at desc;
end;
$$;

revoke all on function public.admin_list_notification_campaigns() from public;
grant execute on function public.admin_list_notification_campaigns() to authenticated;
