create extension if not exists pgcrypto with schema extensions;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  hashed_password text not null,
  full_name text,
  is_admin boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.athletes (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  sport text not null,
  date_of_birth date not null,
  gender text not null,
  external_id text unique not null,
  created_at timestamptz not null default now()
);

create index if not exists athletes_created_at_idx
  on public.athletes (created_at desc);
create index if not exists athletes_external_id_idx
  on public.athletes (external_id);

create table if not exists public.vald_tenants (
  id uuid primary key default gen_random_uuid(),
  tenant_id text unique not null,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vald_athletes (
  id uuid primary key default gen_random_uuid(),
  vald_id text unique not null,
  name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vald_athletes_lower_name_idx
  on public.vald_athletes (lower(name));

create table if not exists public.vald_tests (
  id uuid primary key default gen_random_uuid(),
  vald_test_id text unique not null,
  athlete_vald_id text not null references public.vald_athletes(vald_id),
  device text not null check (device in ('dynamo', 'forcedecks')),
  test_type text,
  test_date timestamptz,
  raw_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vald_tests_athlete_device_idx
  on public.vald_tests (athlete_vald_id, device);
create index if not exists vald_tests_device_date_idx
  on public.vald_tests (device, test_date desc);
create index if not exists vald_tests_athlete_date_idx
  on public.vald_tests (athlete_vald_id, test_date desc);

create table if not exists public.vald_metrics (
  id uuid primary key default gen_random_uuid(),
  test_vald_id text not null references public.vald_tests(vald_test_id) on delete cascade,
  metric_name text not null,
  metric_value numeric,
  unit text,
  created_at timestamptz not null default now()
);

create index if not exists vald_metrics_test_idx
  on public.vald_metrics (test_vald_id);

create table if not exists public.vald_sync_state (
  device_name text primary key,
  last_synced_at timestamptz not null default '2020-01-01T00:00:00Z',
  updated_at timestamptz not null default now()
);

insert into public.vald_sync_state (device_name)
values ('dynamo'), ('forcedecks')
on conflict (device_name) do nothing;

alter table public.users enable row level security;
alter table public.athletes enable row level security;
alter table public.vald_tenants enable row level security;
alter table public.vald_athletes enable row level security;
alter table public.vald_tests enable row level security;
alter table public.vald_metrics enable row level security;
alter table public.vald_sync_state enable row level security;

revoke all on table public.users from anon, authenticated;
revoke all on table public.athletes from anon, authenticated;
revoke all on table public.vald_tenants from anon, authenticated;
revoke all on table public.vald_athletes from anon, authenticated;
revoke all on table public.vald_tests from anon, authenticated;
revoke all on table public.vald_metrics from anon, authenticated;
revoke all on table public.vald_sync_state from anon, authenticated;

grant all on table public.users to service_role;
grant all on table public.athletes to service_role;
grant all on table public.vald_tenants to service_role;
grant all on table public.vald_athletes to service_role;
grant all on table public.vald_tests to service_role;
grant all on table public.vald_metrics to service_role;
grant all on table public.vald_sync_state to service_role;
