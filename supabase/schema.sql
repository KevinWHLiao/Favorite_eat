-- 在 Supabase → SQL Editor 貼上執行一次即可

create table if not exists public.rooms (
  code text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.rooms enable row level security;

drop policy if exists "rooms_select_anon" on public.rooms;
drop policy if exists "rooms_insert_anon" on public.rooms;
drop policy if exists "rooms_update_anon" on public.rooms;

create policy "rooms_select_anon"
  on public.rooms for select to anon, authenticated
  using (true);

create policy "rooms_insert_anon"
  on public.rooms for insert to anon, authenticated
  with check (true);

create policy "rooms_update_anon"
  on public.rooms for update to anon, authenticated
  using (true)
  with check (true);

-- 讓雙方即時看到對方更新
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;
end $$;
