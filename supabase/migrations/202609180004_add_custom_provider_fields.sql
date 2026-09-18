-- 森月居：自定义第三方 API 配置

alter table public.provider_credentials
  add column if not exists provider_type text not null default 'official',
  add column if not exists label text,
  add column if not exists base_url text,
  add column if not exists adapter text;
