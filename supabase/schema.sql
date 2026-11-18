create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  parent_id uuid references public.locations(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  category text not null default 'Other' check (char_length(trim(category)) between 1 and 80),
  description text not null default '',
  characteristics text not null default '',
  tags text[] not null default '{}',
  location_id uuid not null references public.locations(id) on delete restrict,
  storage_detail text not null default '',
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.locations, public.items to authenticated;

create index if not exists locations_user_parent_idx on public.locations(user_id, parent_id);
create unique index if not exists locations_user_parent_name_unique
  on public.locations(user_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
create index if not exists items_user_created_idx on public.items(user_id, created_at desc);
create index if not exists items_user_location_idx on public.items(user_id, location_id);

create or replace function public.user_owns_location(location_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.locations
    where id = location_uuid and user_id = auth.uid()
  );
$$;

revoke all on function public.user_owns_location(uuid) from public;
grant execute on function public.user_owns_location(uuid) to authenticated;

alter table public.locations enable row level security;
alter table public.items enable row level security;

create policy "Users manage their locations"
  on public.locations for all to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (parent_id is null or public.user_owns_location(parent_id))
  );

create policy "Users manage their items"
  on public.items for all to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and public.user_owns_location(location_id)
    and (image_path is null or image_path like (auth.uid()::text || '/%'))
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-photos', 'item-photos', false, 6291456, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = 6291456,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create policy "Users upload their own item photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'item-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users read their own item photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'item-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users delete their own item photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'item-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

insert into public.locations (user_id, name)
select auth_user.id, default_location.name
from auth.users auth_user
cross join (values ('Home'), ('Bedroom'), ('Kitchen'), ('Living room'), ('Hall'), ('Office')) as default_location(name)
on conflict do nothing;

create or replace function public.create_default_locations_for_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.locations (user_id, name)
  values
    (new.id, 'Home'),
    (new.id, 'Bedroom'),
    (new.id, 'Kitchen'),
    (new.id, 'Living room'),
    (new.id, 'Hall'),
    (new.id, 'Office');
  return new;
end;
$$;

revoke all on function public.create_default_locations_for_user() from public;

create trigger seed_default_locations_after_auth_signup
  after insert on auth.users
  for each row execute function public.create_default_locations_for_user();
