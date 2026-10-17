-- SMART EYEGLASSES SUPABASE SCHEMA
-- Run this in Supabase SQL Editor.
-- Uses the entities already reflected in the thesis: Profiles, Devices,
-- Device_Access, Locations, and Obstacle_Events.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'caregiver' check (role in ('caregiver','family_member','user','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  device_code text unique not null,
  device_name text not null default 'Smart Eyeglasses',
  owner_id uuid references public.profiles(id) on delete set null,
  status text not null default 'offline' check (status in ('online','offline','maintenance')),
  battery_percent integer check (battery_percent between 0 and 100),
  last_seen timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.device_access (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  access_role text not null default 'viewer' check (access_role in ('viewer','caregiver','admin')),
  created_at timestamptz not null default now(),
  unique(device_id, profile_id)
);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  created_at timestamptz not null default now()
);

create table if not exists public.obstacle_events (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  direction text not null check (direction in ('Left','Center','Right')),
  distance double precision not null,
  severity text not null check (severity in ('Low','Medium','High')),
  voice_command text,
  created_at timestamptz not null default now()
);

create index if not exists idx_locations_device_time on public.locations(device_id, created_at desc);
create index if not exists idx_events_device_time on public.obstacle_events(device_id, created_at desc);
create index if not exists idx_access_profile on public.device_access(profile_id);

alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.device_access enable row level security;
alter table public.locations enable row level security;
alter table public.obstacle_events enable row level security;

-- Profiles: a signed-in user can read/update their own profile.
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid());

-- Device access: users can see access rows assigned to them.
create policy "access_select_own" on public.device_access for select to authenticated using (profile_id = auth.uid());

-- Devices/telemetry: allow signed-in users to read devices they own or can access.
create policy "devices_select_authorized" on public.devices for select to authenticated using (
  owner_id = auth.uid() or exists (
    select 1 from public.device_access da
    where da.device_id = devices.id and da.profile_id = auth.uid()
  )
);

create policy "locations_select_authorized" on public.locations for select to authenticated using (
  exists (select 1 from public.devices d where d.id = locations.device_id and (
    d.owner_id = auth.uid() or exists (select 1 from public.device_access da where da.device_id = d.id and da.profile_id = auth.uid())
  ))
);

create policy "events_select_authorized" on public.obstacle_events for select to authenticated using (
  exists (select 1 from public.devices d where d.id = obstacle_events.device_id and (
    d.owner_id = auth.uid() or exists (select 1 from public.device_access da where da.device_id = d.id and da.profile_id = auth.uid())
  ))
);

-- IMPORTANT:
-- The ESP32 should NOT be given a service-role key. For production, send
-- telemetry through a protected Edge Function or another authenticated API.
-- Do not expose the service-role key in HTML/JavaScript.

-- Enable realtime for the dashboard tables if not already enabled.
alter publication supabase_realtime add table public.locations;
alter publication supabase_realtime add table public.obstacle_events;
