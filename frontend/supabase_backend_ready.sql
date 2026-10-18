
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS device_token_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS devices_device_token_hash_unique
  ON public.devices(device_token_hash)
  WHERE device_token_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ingest_telemetry(
  p_device_token text,
  p_device_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_timestamp timestamptz DEFAULT now(),
  p_obstacles jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_location public.locations%ROWTYPE;
  v_obstacle jsonb;
  v_event_id uuid;
  v_hash text;
  v_count integer := 0;
BEGIN
  IF p_device_token IS NULL OR length(trim(p_device_token)) < 16 THEN
    RAISE EXCEPTION 'Invalid device token';
  END IF;

  IF p_latitude IS NULL OR p_latitude < -90 OR p_latitude > 90 THEN
    RAISE EXCEPTION 'Invalid latitude';
  END IF;

  IF p_longitude IS NULL OR p_longitude < -180 OR p_longitude > 180 THEN
    RAISE EXCEPTION 'Invalid longitude';
  END IF;

  IF jsonb_typeof(COALESCE(p_obstacles, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'obstacles must be a JSON array';
  END IF;

  IF jsonb_array_length(COALESCE(p_obstacles, '[]'::jsonb)) > 20 THEN
    RAISE EXCEPTION 'Too many obstacle events';
  END IF;

  v_hash := encode(extensions.digest(p_device_token, 'sha256'), 'hex');
  IF NOT EXISTS (
    SELECT 1
    FROM public.devices
    WHERE id = p_device_id
      AND device_token_hash = v_hash
  ) THEN
    RAISE EXCEPTION 'Unauthorized device';
  END IF;

  INSERT INTO public.locations (device_id, latitude, longitude, timestamp)
  VALUES (p_device_id, p_latitude, p_longitude, COALESCE(p_timestamp, now()))
  RETURNING * INTO v_location;

  FOR v_obstacle IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_obstacles, '[]'::jsonb))
  LOOP
    IF lower(COALESCE(v_obstacle->>'direction', '')) NOT IN ('left','center','right','multiple') THEN
      RAISE EXCEPTION 'Invalid obstacle direction';
    END IF;

    IF lower(COALESCE(v_obstacle->>'severity', '')) NOT IN ('warning','danger') THEN
      RAISE EXCEPTION 'Invalid obstacle severity';
    END IF;

    IF COALESCE((v_obstacle->>'distance_cm')::numeric, -1) < 0 THEN
      RAISE EXCEPTION 'Invalid obstacle distance';
    END IF;

    INSERT INTO public.obstacle_events (
      device_id,
      direction,
      distance_cm,
      severity,
      voice_command,
      timestamp,
      location_id
    )
    VALUES (
      p_device_id,
      lower(v_obstacle->>'direction'),
      (v_obstacle->>'distance_cm')::numeric,
      lower(v_obstacle->>'severity'),
      COALESCE(v_obstacle->>'voice_command', 'Obstacle detected.'),
      COALESCE((v_obstacle->>'timestamp')::timestamptz, v_location.timestamp),
      v_location.id
    )
    RETURNING id INTO v_event_id;

    v_count := v_count + 1;
  END LOOP;

  UPDATE public.devices
  SET status = 'online'
  WHERE id = p_device_id;

  RETURN jsonb_build_object(
    'ok', true,
    'device_id', p_device_id,
    'location_id', v_location.id,
    'obstacle_events_created', v_count,
    'received_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_telemetry(text, uuid, double precision, double precision, timestamptz, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ingest_telemetry(text, uuid, double precision, double precision, timestamptz, jsonb) TO anon, authenticated;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.obstacle_events;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
CREATE INDEX IF NOT EXISTS idx_locations_device_timestamp
  ON public.locations(device_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_obstacle_events_device_timestamp
  ON public.obstacle_events(device_id, timestamp DESC);

CREATE OR REPLACE FUNCTION public.list_device_access(p_device_id uuid)
RETURNS TABLE(user_id uuid, name text, email text, role text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.devices
    WHERE id = p_device_id
      AND (
        owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.device_access
          WHERE device_id = p_device_id
            AND user_id = auth.uid()
        )
      )
  ) THEN
    RAISE EXCEPTION 'Unauthorized device access';
  END IF;

  RETURN QUERY
  SELECT p.id, p.name, p.email, p.role, da.created_at
  FROM public.device_access da
  JOIN public.profiles p ON p.id = da.user_id
  WHERE da.device_id = p_device_id
  ORDER BY da.created_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_device_access(p_device_id uuid, p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.devices
    WHERE id = p_device_id AND owner_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the device owner can grant access';
  END IF;

  SELECT id INTO v_user_id
  FROM public.profiles
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No registered account was found for that email';
  END IF;

  INSERT INTO public.device_access (device_id, user_id)
  VALUES (p_device_id, v_user_id)
  ON CONFLICT (device_id, user_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'user_id', v_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_device_access(p_device_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.devices
    WHERE id = p_device_id AND owner_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the device owner can remove access';
  END IF;

  DELETE FROM public.device_access
  WHERE device_id = p_device_id
    AND user_id = p_user_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.list_device_access(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_device_access(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_device_access(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.list_device_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_device_access(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_device_access(uuid, uuid) TO authenticated;
