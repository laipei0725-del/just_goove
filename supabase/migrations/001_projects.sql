create table if not exists public.dance_projects (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '未命名練習',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists dance_projects_user_updated_idx on public.dance_projects(user_id, updated_at desc);
alter table public.dance_projects enable row level security;
grant select, insert, update, delete on public.dance_projects to authenticated;

drop policy if exists "dance_projects_select_own" on public.dance_projects;
create policy "dance_projects_select_own" on public.dance_projects for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "dance_projects_insert_own" on public.dance_projects;
create policy "dance_projects_insert_own" on public.dance_projects for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "dance_projects_update_own" on public.dance_projects;
create policy "dance_projects_update_own" on public.dance_projects for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "dance_projects_delete_own" on public.dance_projects;
create policy "dance_projects_delete_own" on public.dance_projects for delete to authenticated using ((select auth.uid()) = user_id);

-- Private media storage. Files must use the path <user_id>/<project_id>/<file>.
insert into storage.buckets (id, name, public)
values ('user-videos', 'user-videos', false)
on conflict (id) do update set public = false;

drop policy if exists "user_videos_select_own" on storage.objects;
create policy "user_videos_select_own" on storage.objects
for select to authenticated
using (bucket_id = 'user-videos' and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists "user_videos_insert_own" on storage.objects;
create policy "user_videos_insert_own" on storage.objects
for insert to authenticated
with check (bucket_id = 'user-videos' and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists "user_videos_update_own" on storage.objects;
create policy "user_videos_update_own" on storage.objects
for update to authenticated
using (bucket_id = 'user-videos' and (storage.foldername(name))[1] = (select auth.uid()::text))
with check (bucket_id = 'user-videos' and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists "user_videos_delete_own" on storage.objects;
create policy "user_videos_delete_own" on storage.objects
for delete to authenticated
using (bucket_id = 'user-videos' and (storage.foldername(name))[1] = (select auth.uid()::text));
