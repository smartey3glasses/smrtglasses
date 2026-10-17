-- SMART EYEGLASSES SUPABASE SCHEMA
-- Final minimal schema aligned with the Smart Eyeglasses class diagram.
-- No battery, GPS-status, Wi-Fi-status, Bluetooth-status, last_seen, or access_role fields.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'family_member'
    CHECK (role IN ('visually_impaired_user','family_member','caregiver','admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id)
    REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.devices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  device_name text NOT NULL,
  status text NOT NULL DEFAULT 'offline'
    CHECK (status IN ('online','offline')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT devices_pkey PRIMARY KEY (id),
  CONSTRAINT devices_owner_user_id_fkey FOREIGN KEY (owner_user_id)
    REFERENCES public.profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.device_access (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT device_access_pkey PRIMARY KEY (id),
  CONSTRAINT device_access_device_id_fkey FOREIGN KEY (device_id)
    REFERENCES public.devices(id) ON DELETE CASCADE,
  CONSTRAINT device_access_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT device_access_unique UNIQUE (device_id, user_id)
);

CREATE TABLE public.locations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT locations_pkey PRIMARY KEY (id),
  CONSTRAINT locations_device_id_fkey FOREIGN KEY (device_id)
    REFERENCES public.devices(id) ON DELETE CASCADE
);

CREATE TABLE public.obstacle_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL,
  direction text NOT NULL
    CHECK (direction IN ('left','center','right','multiple')),
  distance_cm numeric NOT NULL,
  severity text NOT NULL
    CHECK (severity IN ('warning','danger')),
  voice_command text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  location_id uuid,
  CONSTRAINT obstacle_events_pkey PRIMARY KEY (id),
  CONSTRAINT obstacle_events_device_id_fkey FOREIGN KEY (device_id)
    REFERENCES public.devices(id) ON DELETE CASCADE,
  CONSTRAINT obstacle_events_location_id_fkey FOREIGN KEY (location_id)
    REFERENCES public.locations(id) ON DELETE SET NULL
);

CREATE INDEX idx_device_access_user
  ON public.device_access(user_id);
CREATE INDEX idx_device_access_device
  ON public.device_access(device_id);
CREATE INDEX idx_locations_device_timestamp
  ON public.locations(device_id, timestamp DESC);
CREATE INDEX idx_obstacle_events_device_timestamp
  ON public.obstacle_events(device_id, timestamp DESC);

-- Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obstacle_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "device_access_select_own"
  ON public.device_access FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "devices_select_authorized"
  ON public.devices FOR SELECT TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.device_access da
      WHERE da.device_id = devices.id
        AND da.user_id = auth.uid()
    )
  );

CREATE POLICY "locations_select_authorized"
  ON public.locations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.devices d
      WHERE d.id = locations.device_id
        AND (
          d.owner_user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.device_access da
            WHERE da.device_id = d.id
              AND da.user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "obstacle_events_select_authorized"
  ON public.obstacle_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.devices d
      WHERE d.id = obstacle_events.device_id
        AND (
          d.owner_user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.device_access da
            WHERE da.device_id = d.id
              AND da.user_id = auth.uid()
          )
        )
    )
  );

-- For production telemetry, send ESP32 data through a protected API/Edge Function.
-- Never expose a Supabase service-role key in the browser or on the device.

-- Realtime tables used by the dashboard.
ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.obstacle_events;
