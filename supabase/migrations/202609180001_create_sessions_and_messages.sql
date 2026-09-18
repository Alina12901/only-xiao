-- 森月居：第一版会话与消息持久化
-- 执行位置：Supabase SQL Editor，或由 Supabase CLI 执行本迁移。

create extension if not exists pgcrypto;

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '新的会话'
    check (char_length(btrim(title)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sessions_id_owner_unique unique (id, owner_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  owner_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null
    check (char_length(btrim(content)) between 1 and 20000),
  created_at timestamptz not null default now(),
  constraint messages_session_owner_fkey
    foreign key (session_id, owner_id)
    references public.sessions(id, owner_id)
    on delete cascade
);

create index if not exists sessions_owner_updated_idx
  on public.sessions (owner_id, updated_at desc);

create index if not exists messages_owner_session_created_idx
  on public.messages (owner_id, session_id, created_at asc, id asc);

alter table public.sessions enable row level security;
alter table public.messages enable row level security;

drop policy if exists sessions_select_own on public.sessions;
create policy sessions_select_own
  on public.sessions for select
  to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists sessions_insert_own on public.sessions;
create policy sessions_insert_own
  on public.sessions for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists sessions_update_own on public.sessions;
create policy sessions_update_own
  on public.sessions for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists sessions_delete_own on public.sessions;
create policy sessions_delete_own
  on public.sessions for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists messages_select_own on public.messages;
create policy messages_select_own
  on public.messages for select
  to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists messages_insert_own on public.messages;
create policy messages_insert_own
  on public.messages for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

revoke all on table public.sessions from anon;
revoke all on table public.messages from anon;
grant select, insert, update, delete on table public.sessions to authenticated;
grant select, insert on table public.messages to authenticated;
