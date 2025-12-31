-- 강남지부 위스키 아지트 예약 시스템 (승인형 선착순 + 예외 중복 허용)
-- 실행: Supabase SQL Editor에서 순서대로 실행하세요.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- 1) Enums
do $$ begin
  create type user_role as enum ('USER','ADMIN','SUPER_ADMIN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_status as enum ('PENDING','APPROVED','BLOCKED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reservation_status as enum ('REQUESTED','APPROVED','REJECTED','CANCELLED','NO_SHOW');
exception when duplicate_object then null; end $$;

do $$ begin
  create type penalty_source as enum ('AUTO','ADMIN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type penalty_type as enum ('NO_SHOW','LATE_CANCEL','MANUAL','ADJUSTMENT','OTHER');
exception when duplicate_object then null; end $$;

do $$ begin
  create type outbox_channel as enum ('PUSH','EMAIL');
exception when duplicate_object then null; end $$;

do $$ begin
  create type outbox_status as enum ('PENDING','SENT','FAILED');
exception when duplicate_object then null; end $$;

-- 2) Core tables

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  provider text not null,                        -- 'kakao'
  provider_account_id text not null,             -- Kakao user id
  email text null,
  nickname text null,
  phone text null,

  role user_role not null default 'USER',
  status user_status not null default 'PENDING',

  suspended_until timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(provider, provider_account_id)
);

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Asia/Seoul',
  description text null,
  created_at timestamptz not null default now()
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  name text not null,
  capacity int null,
  min_duration_minutes int not null default 60,
  buffer_minutes int not null default 0,         -- 청소/정리 버퍼
  created_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,

  start_time timestamptz not null,
  end_time timestamptz not null,

  status reservation_status not null default 'REQUESTED',

  -- 예외 중복 허용 승인 플래그 (관리자 전용)
  override_conflict boolean not null default false,
  decision_reason text null,

  user_note text null,
  admin_note text null,

  requested_at timestamptz not null default now(),
  approved_at timestamptz null,
  decided_at timestamptz null,
  decided_by uuid null references public.users(id), -- 관리자

  created_at timestamptz not null default now()
);

-- time range generated column (겹침 판단)
alter table public.reservations
  add column if not exists time_range tstzrange
  generated always as (tstzrange(start_time, end_time, '[)')) stored;

-- 겹침 금지 제약: APPROVED 이면서 override_conflict=false 인 예약끼리만 겹치면 안 됨
-- (예외 승인 override_conflict=true 는 제약 적용에서 제외됨)
do $$ begin
  alter table public.reservations
  add constraint reservations_no_overlap
  exclude using gist (
    resource_id with =,
    time_range with &&
  )
  where (status = 'APPROVED' and override_conflict = false);
exception when duplicate_object then null; end $$;

create table if not exists public.penalty_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  reservation_id uuid null references public.reservations(id) on delete set null,

  source penalty_source not null,
  type penalty_type not null,
  points int not null,                       -- 음수 허용(조정)
  reason text not null,

  created_by uuid null references public.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz null
);

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references public.users(id) on delete set null,
  channel outbox_channel not null,
  template text not null,
  payload jsonb not null,
  status outbox_status not null default 'PENDING',
  error text null,
  created_at timestamptz not null default now(),
  sent_at timestamptz null
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  unique(user_id)
);

create table if not exists public.admin_action_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.users(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  action text not null,
  detail jsonb null,
  created_at timestamptz not null default now()
);

-- 3) Helpful indexes
create index if not exists idx_users_status on public.users(status);
create index if not exists idx_users_role on public.users(role);
create index if not exists idx_reservations_status on public.reservations(status);
create index if not exists idx_reservations_resource_time on public.reservations(resource_id, start_time, end_time);
create index if not exists idx_outbox_status on public.notification_outbox(status, created_at);

-- 4) Seed initial venue/resource (1개 아지트)
insert into public.venues (name, description)
select '강남지부 위스키 아지트', '강남지부 위스키 모임용 아지트 예약'
where not exists (select 1 from public.venues where name='강남지부 위스키 아지트');

insert into public.resources (venue_id, name, capacity, min_duration_minutes, buffer_minutes)
select v.id, '아지트', 10, 60, 0
from public.venues v
where v.name='강남지부 위스키 아지트'
and not exists (select 1 from public.resources r where r.name='아지트' and r.venue_id=v.id);

