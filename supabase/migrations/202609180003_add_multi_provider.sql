-- 森月居：多供应商模型配置

alter table public.settings
  add column if not exists provider text not null default 'gateway';

create table if not exists public.provider_credentials (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  encrypted_key text not null,
  key_iv text not null,
  key_tag text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_credentials_owner_provider_unique
    unique (owner_id, provider)
);

alter table public.provider_credentials enable row level security;

drop policy if exists provider_credentials_select_own on public.provider_credentials;
create policy provider_credentials_select_own
  on public.provider_credentials for select
  to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists provider_credentials_insert_own on public.provider_credentials;
create policy provider_credentials_insert_own
  on public.provider_credentials for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists provider_credentials_update_own on public.provider_credentials;
create policy provider_credentials_update_own
  on public.provider_credentials for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists provider_credentials_delete_own on public.provider_credentials;
create policy provider_credentials_delete_own
  on public.provider_credentials for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on table public.provider_credentials from anon;
grant select, insert, update, delete on table public.provider_credentials to authenticated;
