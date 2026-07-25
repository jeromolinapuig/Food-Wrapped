create table if not exists public.entry_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  current_step smallint not null default 1
    check (current_step between 1 and 5),
  datetime_input text not null default '',
  datetime_manually_edited boolean not null default false,
  burger_origin text
    check (burger_origin is null or burger_origin in ('restaurant', 'homemade')),
  restaurant_id text,
  restaurant_name text,
  restaurant_approved_name text,
  burger_id text,
  burger_name text,
  meat_type text not null default 'beef'
    check (meat_type in ('beef', 'chicken', 'vegan', 'other')),
  homemade_ingredients text not null default '',
  rating_input text not null default '',
  price_input text not null default '',
  currency text not null default 'EUR',
  additional_notes text not null default '',
  photo_url text,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.entry_drafts enable row level security;

create policy "Users can read their entry draft"
  on public.entry_drafts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their entry draft"
  on public.entry_drafts
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their entry draft"
  on public.entry_drafts
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their entry draft"
  on public.entry_drafts
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete
  on table public.entry_drafts
  to authenticated;

comment on table public.entry_drafts is
  'Stores one recoverable, unpublished burger entry draft per user.';
