-- Song Structure — run once in the Supabase SQL editor
-- (Dashboard → SQL Editor → New query → paste → Run)

-- ── songs ────────────────────────────────────────────────────────────
create table if not exists public.songs (
  owner      uuid        not null references auth.users(id) on delete cascade,
  id         text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (owner, id)
);

alter table public.songs enable row level security;

drop policy if exists "songs are private" on public.songs;
create policy "songs are private" on public.songs
  for all to authenticated
  using (auth.uid() = owner)
  with check (auth.uid() = owner);

-- ── media bucket (mp3, chord diagrams, video) ────────────────────────
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

-- files live at  <user id>/<media id>, so the first path segment is the owner
drop policy if exists "media read own"   on storage.objects;
drop policy if exists "media write own"  on storage.objects;
drop policy if exists "media update own" on storage.objects;
drop policy if exists "media delete own" on storage.objects;

create policy "media read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "media write own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "media update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "media delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
