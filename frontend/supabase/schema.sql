create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'family_member' check (role in ('visually_impaired_user', 'family_member', 'caregiver', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references profiles (id) on delete cascade,
  device_name text not null,
  device_status text not null default 'offline' check (device_status in ('online', 'offline')),
  battery_level numeric,
  gps_status text not null default 'searching' check (gps_status in ('online', 'offline', 'searching')),
  bluetooth_status text not null default 'offline' check (bluetooth_status in ('online', 'offline', 'searching')),
  wifi_status text not null default 'offline' check (wifi_status in ('online', 'offline', 'searching')),
  last_seen timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists device_access (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references devices (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (device_id, user_id)
);

create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references devices (id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  speed numeric,
  accuracy numeric,
  timestamp timestamptz not null default now()
);

create table if not exists obstacle_events (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references devices (id) on delete cascade,
  direction text not null check (direction in ('left', 'center', 'right', 'multiple')),
  distance_cm numeric not null,
  severity text not null check (severity in ('warning', 'danger')),
  voice_command text not null,
  latitude double precision,
  longitude double precision,
  timestamp timestamptz not null default now()
);

create index if not exists locations_device_id_timestamp_idx on locations (device_id, timestamp desc);
create index if not exists obstacle_events_device_id_timestamp_idx on obstacle_events (device_id, timestamp desc);

alter table profiles enable row level security;
alter table devices enable row level security;
alter table device_access enable row level security;
alter table locations enable row level security;
alter table obstacle_events enable row level security;

create or replace function has_device_access(target_device_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from devices
    where devices.id = target_device_id
    and devices.owner_user_id = auth.uid()
  )
  or exists (
    select 1 from device_access
    where device_access.device_id = target_device_id
    and device_access.user_id = auth.uid()
  );
$$;

drop policy if exists "read own profile" on profiles;
create policy "read own profile"
on profiles for select
using (id = auth.uid());

drop policy if exists "update own profile" on profiles;
create policy "update own profile"
on profiles for update
using (id = auth.uid());

drop policy if exists "insert own profile" on profiles;
create policy "insert own profile"
on profiles for insert
with check (id = auth.uid());

drop policy if exists "read accessible devices" on devices;
create policy "read accessible devices"
on devices for select
using (has_device_access(id));

drop policy if exists "owner updates device" on devices;
create policy "owner updates device"
on devices for update
using (owner_user_id = auth.uid());

drop policy if exists "owner inserts device" on devices;
create policy "owner inserts device"
on devices for insert
with check (owner_user_id = auth.uid());

drop policy if exists "read own access grants" on device_access;
create policy "read own access grants"
on device_access for select
using (user_id = auth.uid() or device_id in (select id from devices where owner_user_id = auth.uid()));

drop policy if exists "owner manages access grants" on device_access;
create policy "owner manages access grants"
on device_access for insert
with check (device_id in (select id from devices where owner_user_id = auth.uid()));

drop policy if exists "owner deletes access grants" on device_access;
create policy "owner deletes access grants"
on device_access for delete
using (device_id in (select id from devices where owner_user_id = auth.uid()));

drop policy if exists "read accessible locations" on locations;
create policy "read accessible locations"
on locations for select
using (has_device_access(device_id));

drop policy if exists "owner inserts locations" on locations;
create policy "owner inserts locations"
on locations for insert
with check (device_id in (select id from devices where owner_user_id = auth.uid()));

drop policy if exists "read accessible obstacle events" on obstacle_events;
create policy "read accessible obstacle events"
on obstacle_events for select
using (has_device_access(device_id));

drop policy if exists "owner inserts obstacle events" on obstacle_events;
create policy "owner inserts obstacle events"
on obstacle_events for insert
with check (device_id in (select id from devices where owner_user_id = auth.uid()));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(coalesce(new.email, 'user'), '@', 1)),
    coalesce(new.email, ''),
    case when new.raw_user_meta_data ->> 'role' in ('family_member', 'caregiver', 'visually_impaired_user')
      then new.raw_user_meta_data ->> 'role' else 'family_member' end
  )
  on conflict (id) do update set
    name = excluded.name,
    email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

drop policy if exists "insert own profile" on public.profiles;
drop policy if exists "insert own profile" on profiles;
create policy "insert own profile" on public.profiles for insert with check (id = auth.uid());
drop policy if exists "update own profile" on public.profiles;
drop policy if exists "update own profile" on profiles;
create policy "update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
