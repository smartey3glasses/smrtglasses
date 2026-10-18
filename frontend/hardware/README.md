# Smart Eyeglasses Hardware Integration

## Data path

ESP32 + VL53L0X + NEO-6M → Wi-Fi / HTTPS → Supabase RPC → PostgreSQL → Supabase Realtime → Vercel caregiver dashboard

## Device registration

Create one row in `public.devices` with the visually impaired user's profile as `owner_user_id`.

Generate a device token:

```sql
SELECT encode(gen_random_bytes(24), 'hex') AS device_token;
```

Store only the SHA-256 hash in Supabase:

```sql
UPDATE public.devices
SET device_token_hash = encode(
  extensions.digest('PASTE_DEVICE_TOKEN_HERE', 'sha256'),
  'hex'
)
WHERE id = 'YOUR-DEVICE-UUID';
```

The plaintext token belongs only in the ESP32 local configuration.

## ESP32 configuration

Set these values in `esp32_supabase_sender.ino`:

- Wi-Fi SSID
- Wi-Fi password
- Supabase project URL
- Supabase anon/publishable key
- Device token
- Device UUID

The firmware sends telemetry to:

```text
POST https://YOUR_PROJECT.supabase.co/rest/v1/rpc/ingest_telemetry
```

## Hardware integration

`readGps()` must return the latitude and longitude from the NEO-6M.

`readObstacles()` must read the three VL53L0X sensors and populate:

- `direction`
- `distanceCm`
- `severity`
- `voiceCommand`

The final GPIO and I2C configuration belongs in the firmware after the physical wiring is confirmed.

## Telemetry

Every successful request creates a location record. When an obstacle is detected, the same request creates the corresponding obstacle event and links it to that location.

The caregiver dashboard receives new records through Supabase Realtime.

## Connectivity

The firmware currently sends data only when Wi-Fi is connected and GPS data is available. A production hardware build should add local buffering and retry handling if the glasses must continue recording while temporarily offline.

## Libraries

- WiFi
- HTTPClient
- WiFiClientSecure
- ArduinoJson

Additional libraries required by the final physical implementation depend on the selected VL53L0X and NEO-6M libraries.
