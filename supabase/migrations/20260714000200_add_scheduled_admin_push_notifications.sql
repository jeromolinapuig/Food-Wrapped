alter table public.push_subscriptions
  add column if not exists timezone text not null default 'UTC';

create table if not exists public.admin_notification_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 80),
  body text not null check (char_length(trim(body)) between 1 and 240),
  target_url text not null default '/' check (target_url ~ '^/[^/]*' and char_length(target_url) <= 500),
  scheduled_for_local timestamp without time zone not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz
);

create index if not exists admin_notification_campaigns_status_schedule_idx
  on public.admin_notification_campaigns (status, scheduled_for_local);

alter table public.admin_notification_campaigns enable row level security;

create table if not exists public.admin_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.admin_notification_campaigns(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'sent', 'failed', 'skipped')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, subscription_id)
);

create index if not exists admin_notification_deliveries_due_idx
  on public.admin_notification_deliveries (scheduled_for)
  where status in ('queued', 'failed', 'processing');

alter table public.admin_notification_deliveries enable row level security;

revoke all on public.admin_notification_campaigns from anon, authenticated;
revoke all on public.admin_notification_deliveries from anon, authenticated;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_admin is true
  );
$$;

revoke all on function public.current_user_is_admin() from public;
grant execute on function public.current_user_is_admin() to authenticated;

create policy "Admins can read notification campaigns"
  on public.admin_notification_campaigns
  for select
  to authenticated
  using ((select public.current_user_is_admin()));

create policy "Admins can read notification deliveries"
  on public.admin_notification_deliveries
  for select
  to authenticated
  using ((select public.current_user_is_admin()));

grant select on public.admin_notification_campaigns to authenticated;
grant select on public.admin_notification_deliveries to authenticated;

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
    and campaign.scheduled_for_local at time zone subscription.timezone > now();
end;
$$;

revoke all on function public.queue_admin_notification_deliveries(uuid) from public;

create or replace function public.validate_admin_notification_campaign(
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
  if not public.current_user_is_admin() then
    raise exception 'Administrator access required';
  end if;

  if char_length(trim(coalesce(p_title, ''))) not between 1 and 80 then
    raise exception 'Title must contain between 1 and 80 characters';
  end if;

  if char_length(trim(coalesce(p_body, ''))) not between 1 and 240 then
    raise exception 'Message must contain between 1 and 240 characters';
  end if;

  if coalesce(p_target_url, '') !~ '^/[^/]*' then
    raise exception 'Target URL must be a relative application path';
  end if;

  if char_length(p_target_url) > 500 then
    raise exception 'Target URL cannot contain more than 500 characters';
  end if;

  if p_scheduled_for_local is null then
    raise exception 'A local delivery date and time is required';
  end if;

  if exists (
    select 1
    from public.push_subscriptions as subscription
    where p_scheduled_for_local at time zone subscription.timezone <= now()
  ) then
    raise exception 'The selected local time has already passed in at least one registered timezone';
  end if;

  if not exists (select 1 from public.push_subscriptions)
    and p_scheduled_for_local at time zone 'UTC' <= now() then
    raise exception 'The selected local time must be in the future';
  end if;
end;
$$;

revoke all on function public.validate_admin_notification_campaign(text, text, text, timestamp without time zone) from public;

create or replace function public.admin_create_notification_campaign(
  p_title text,
  p_body text,
  p_target_url text,
  p_scheduled_for_local timestamp without time zone
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  campaign_id uuid;
begin
  perform public.validate_admin_notification_campaign(
    p_title,
    p_body,
    p_target_url,
    p_scheduled_for_local
  );

  insert into public.admin_notification_campaigns (
    title,
    body,
    target_url,
    scheduled_for_local,
    created_by
  )
  values (
    trim(p_title),
    trim(p_body),
    p_target_url,
    p_scheduled_for_local,
    auth.uid()
  )
  returning id into campaign_id;

  perform public.queue_admin_notification_deliveries(campaign_id);
  return campaign_id;
end;
$$;

revoke all on function public.admin_create_notification_campaign(text, text, text, timestamp without time zone) from public;
grant execute on function public.admin_create_notification_campaign(text, text, text, timestamp without time zone) to authenticated;

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
  ) then
    raise exception 'Only scheduled campaigns can be edited';
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
    and status = 'scheduled';

  if not found then
    raise exception 'Only scheduled campaigns can be cancelled';
  end if;

  delete from public.admin_notification_deliveries
  where campaign_id = p_campaign_id;
end;
$$;

revoke all on function public.admin_cancel_notification_campaign(uuid) from public;
grant execute on function public.admin_cancel_notification_campaign(uuid) to authenticated;

create or replace function public.admin_list_notification_campaigns()
returns table (
  id uuid,
  title text,
  body text,
  target_url text,
  scheduled_for_local timestamp without time zone,
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
    campaign.status,
    campaign.created_at,
    count(delivery.id) filter (where delivery.status in ('queued', 'processing')),
    count(delivery.id) filter (where delivery.status = 'sent'),
    count(delivery.id) filter (where delivery.status = 'failed'),
    count(delivery.id) filter (where delivery.status = 'skipped'),
    campaign.status = 'scheduled'
      and not coalesce(bool_or(
        delivery.scheduled_for <= now()
        or delivery.status not in ('queued', 'failed')
      ), false)
  from public.admin_notification_campaigns as campaign
  left join public.admin_notification_deliveries as delivery
    on delivery.campaign_id = campaign.id
  group by campaign.id
  order by campaign.scheduled_for_local desc;
end;
$$;

revoke all on function public.admin_list_notification_campaigns() from public;
grant execute on function public.admin_list_notification_campaigns() to authenticated;

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

  delete from public.admin_notification_deliveries
  where subscription_id = new.id
    and status in ('queued', 'failed');

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

drop trigger if exists queue_admin_campaigns_for_push_subscription on public.push_subscriptions;
create trigger queue_admin_campaigns_for_push_subscription
  after insert or update of timezone on public.push_subscriptions
  for each row execute function public.queue_new_subscription_for_admin_campaigns();

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
        delivery.status in ('queued', 'failed')
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

revoke all on function public.claim_due_admin_notification_deliveries(integer) from public;
grant execute on function public.claim_due_admin_notification_deliveries(integer) to service_role;

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
    and (campaign.scheduled_for_local at time zone 'UTC') + interval '12 hours' <= now()
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

drop function if exists public.register_push_subscription(text, text, text, text);

create or replace function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text,
  p_timezone text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
  resolved_timezone text := coalesce(nullif(trim(p_timezone), ''), 'UTC');
begin
  if requesting_user_id is null then
    raise exception 'Authentication required';
  end if;

  if nullif(trim(p_endpoint), '') is null
    or nullif(trim(p_p256dh), '') is null
    or nullif(trim(p_auth), '') is null then
    raise exception 'Invalid push subscription';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = resolved_timezone
  ) then
    resolved_timezone := 'UTC';
  end if;

  insert into public.push_subscriptions (
    user_id,
    endpoint,
    p256dh,
    auth,
    user_agent,
    timezone,
    updated_at
  )
  values (
    requesting_user_id,
    p_endpoint,
    p_p256dh,
    p_auth,
    p_user_agent,
    resolved_timezone,
    now()
  )
  on conflict (endpoint)
  do update set
    user_id = excluded.user_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent,
    timezone = excluded.timezone,
    updated_at = now();
end;
$$;

revoke all on function public.register_push_subscription(text, text, text, text, text) from public;
grant execute on function public.register_push_subscription(text, text, text, text, text) to authenticated;

create or replace function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.register_push_subscription(
    p_endpoint,
    p_p256dh,
    p_auth,
    p_user_agent,
    'UTC'
  );
$$;

revoke all on function public.register_push_subscription(text, text, text, text) from public;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;
