create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  hashed_password text not null,
  full_name text,
  is_admin boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists athletes (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  sport text not null,
  date_of_birth date not null,
  gender text not null,
  external_id text unique not null,
  created_at timestamptz not null default now()
);

create index if not exists athletes_created_at_idx on athletes (created_at desc);
create index if not exists athletes_external_id_idx on athletes (external_id);
