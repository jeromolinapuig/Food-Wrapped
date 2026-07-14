create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid,
  type text not null check (type in ('like', 'comment', 'follow', 'group_invite')),
  source_id text not null,
  entry_id text,
  group_id text,
  invitation_id text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  push_sent_at timestamptz,
  unique (user_id, type, source_id)
);

create index if not exists notifications_user_created_at_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_pending_push_idx
  on public.notifications (created_at)
  where push_sent_at is null;

alter table public.notifications enable row level security;

create policy "Users can read their notifications"
  on public.notifications
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can mark their notifications as read"
  on public.notifications
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their notifications"
  on public.notifications
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'notifications'
    ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  push_enabled boolean not null default true,
  likes_enabled boolean not null default true,
  comments_enabled boolean not null default true,
  follows_enabled boolean not null default true,
  group_invites_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

create policy "Users can read their notification preferences"
  on public.notification_preferences
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their notification preferences"
  on public.notification_preferences
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their notification preferences"
  on public.notification_preferences
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create or replace function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
begin
  if requesting_user_id is null then
    raise exception 'Authentication required';
  end if;

  if nullif(trim(p_endpoint), '') is null
    or nullif(trim(p_p256dh), '') is null
    or nullif(trim(p_auth), '') is null then
    raise exception 'Invalid push subscription';
  end if;

  insert into public.push_subscriptions (
    user_id,
    endpoint,
    p256dh,
    auth,
    user_agent,
    updated_at
  )
  values (
    requesting_user_id,
    p_endpoint,
    p_p256dh,
    p_auth,
    p_user_agent,
    now()
  )
  on conflict (endpoint)
  do update set
    user_id = excluded.user_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent,
    updated_at = now();
end;
$$;

create or replace function public.unregister_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions
  where endpoint = p_endpoint
    and user_id = auth.uid();
$$;

revoke all on function public.register_push_subscription(text, text, text, text) from public;
revoke all on function public.unregister_push_subscription(text) from public;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.unregister_push_subscription(text) to authenticated;

create or replace function public.create_like_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient_id uuid;
begin
  select entry.user_id into recipient_id
  from public.entries as entry
  where entry.id = new.entry_id;

  if recipient_id is not null and recipient_id <> new.user_id then
    insert into public.notifications (
      user_id, actor_id, type, source_id, entry_id, created_at
    )
    values (
      recipient_id,
      new.user_id,
      'like',
      concat(new.entry_id::text, ':', new.user_id::text),
      new.entry_id::text,
      coalesce(new.created_at, now())
    )
    on conflict (user_id, type, source_id) do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.create_comment_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient_id uuid;
begin
  select entry.user_id into recipient_id
  from public.entries as entry
  where entry.id = new.entry_id;

  if recipient_id is not null and recipient_id <> new.user_id then
    insert into public.notifications (
      user_id, actor_id, type, source_id, entry_id, created_at
    )
    values (
      recipient_id,
      new.user_id,
      'comment',
      md5(row_to_json(new)::text),
      new.entry_id::text,
      coalesce(new.created_at, now())
    )
    on conflict (user_id, type, source_id) do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.create_follow_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.following_id <> new.follower_id then
    insert into public.notifications (
      user_id, actor_id, type, source_id, created_at
    )
    values (
      new.following_id,
      new.follower_id,
      'follow',
      md5(row_to_json(new)::text),
      coalesce(new.created_at, now())
    )
    on conflict (user_id, type, source_id) do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.create_group_invite_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.invitee_id <> new.inviter_id then
    insert into public.notifications (
      user_id, actor_id, type, source_id, group_id, invitation_id, created_at
    )
    values (
      new.invitee_id,
      new.inviter_id,
      'group_invite',
      md5(row_to_json(new)::text),
      new.group_id::text,
      (to_jsonb(new) ->> 'id'),
      coalesce(new.created_at, now())
    )
    on conflict (user_id, type, source_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists create_notification_after_entry_like on public.entry_likes;
create trigger create_notification_after_entry_like
  after insert on public.entry_likes
  for each row execute function public.create_like_notification();

drop trigger if exists create_notification_after_entry_comment on public.entry_comments;
create trigger create_notification_after_entry_comment
  after insert on public.entry_comments
  for each row execute function public.create_comment_notification();

drop trigger if exists create_notification_after_follow on public.follows;
create trigger create_notification_after_follow
  after insert on public.follows
  for each row execute function public.create_follow_notification();

drop trigger if exists create_notification_after_group_invite on public.group_invitations;
create trigger create_notification_after_group_invite
  after insert on public.group_invitations
  for each row execute function public.create_group_invite_notification();

-- Backfill the in-app inbox before the webhook is configured. These rows are
-- intentionally created by the migration so users keep their existing history.
insert into public.notifications (user_id, actor_id, type, source_id, entry_id, created_at)
select
  entry.user_id,
  entry_like.user_id,
  'like',
  concat(entry_like.entry_id::text, ':', entry_like.user_id::text),
  entry_like.entry_id::text,
  coalesce(entry_like.created_at, now())
from public.entry_likes as entry_like
join public.entries as entry on entry.id = entry_like.entry_id
where entry.user_id <> entry_like.user_id
on conflict (user_id, type, source_id) do nothing;

insert into public.notifications (user_id, actor_id, type, source_id, entry_id, created_at)
select
  entry.user_id,
  entry_comment.user_id,
  'comment',
  md5(row_to_json(entry_comment)::text),
  entry_comment.entry_id::text,
  coalesce(entry_comment.created_at, now())
from public.entry_comments as entry_comment
join public.entries as entry on entry.id = entry_comment.entry_id
where entry.user_id <> entry_comment.user_id
on conflict (user_id, type, source_id) do nothing;

insert into public.notifications (user_id, actor_id, type, source_id, created_at)
select
  follow.following_id,
  follow.follower_id,
  'follow',
  md5(row_to_json(follow)::text),
  coalesce(follow.created_at, now())
from public.follows as follow
where follow.following_id <> follow.follower_id
on conflict (user_id, type, source_id) do nothing;

insert into public.notifications (
  user_id, actor_id, type, source_id, group_id, invitation_id, created_at
)
select
  invitation.invitee_id,
  invitation.inviter_id,
  'group_invite',
  md5(row_to_json(invitation)::text),
  invitation.group_id::text,
  (to_jsonb(invitation) ->> 'id'),
  coalesce(invitation.created_at, now())
from public.group_invitations as invitation
where invitation.invitee_id <> invitation.inviter_id
on conflict (user_id, type, source_id) do nothing;
