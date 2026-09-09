create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '未命名練習',
  source jsonb not null,
  cover_uri text,
  duration_ms integer,
  pinned boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_updated_idx on public.projects(user_id, pinned desc, updated_at desc);
alter table public.projects enable row level security;

drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own" on public.projects for select using (auth.uid() = user_id);
drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own" on public.projects for insert with check (auth.uid() = user_id);
drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own" on public.projects for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own" on public.projects for delete using (auth.uid() = user_id);

-- Create a private bucket in the dashboard named user-videos, then add:
-- storage.foldername(name)[1] = auth.uid() to select/insert/delete policies.
