create table if not exists vald_tenants (
  id uuid primary key default gen_random_uuid(),
  tenant_id text unique not null,
  name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists vald_athletes (
  id uuid primary key default gen_random_uuid(),
  vald_id text unique not null,
  name text,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists vald_athletes_lower_name_idx on vald_athletes (lower(name));

create table if not exists vald_tests (
  id uuid primary key default gen_random_uuid(),
  vald_test_id text unique not null,
  athlete_vald_id text not null references vald_athletes(vald_id),
  device text not null check (device in ('dynamo','forcedecks')),
  test_type text,
  test_date timestamptz,
  raw_data jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists vald_tests_athlete_device_idx on vald_tests (athlete_vald_id, device);

create table if not exists vald_metrics (
  id uuid primary key default gen_random_uuid(),
  test_vald_id text not null references vald_tests(vald_test_id) on delete cascade,
  metric_name text not null,
  metric_value numeric,
  unit text,
  created_at timestamptz default now()
);
create index if not exists vald_metrics_test_idx on vald_metrics (test_vald_id);

create table if not exists vald_sync_state (
  device_name text primary key,
  last_synced_at timestamptz not null default '2020-01-01T00:00:00Z',
  updated_at timestamptz default now()
);

insert into vald_sync_state (device_name)
values ('dynamo'), ('forcedecks')
on conflict (device_name) do nothing;
