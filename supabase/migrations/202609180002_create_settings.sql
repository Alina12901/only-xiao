-- 森月居：用户设置表
-- 每个登录用户最多一行设置。

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  system_prompt text not null
    check (char_length(btrim(system_prompt)) between 1 and 20000),
  model_name text not null
    check (char_length(btrim(model_name)) between 1 and 200),
  max_reply_tokens integer not null default 256
    check (max_reply_tokens between 1 and 512),
  temperature numeric(3, 2) not null default 1.00
    check (temperature between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

drop policy if exists settings_select_own on public.settings;
create policy settings_select_own
  on public.settings for select
  to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists settings_insert_own on public.settings;
create policy settings_insert_own
  on public.settings for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists settings_update_own on public.settings;
create policy settings_update_own
  on public.settings for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

revoke all on table public.settings from anon;
grant select, insert, update on table public.settings to authenticated;
