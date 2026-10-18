# Smart Eyeglasses | Caregiver Dashboard

A live caregiver Progressive Web App for the Smart Eyeglasses capstone.

## Stack

- Frontend: HTML, CSS, vanilla JavaScript
- PWA: Web App Manifest and Service Worker
- Hosting: Vercel
- Backend: Supabase
- Database: PostgreSQL through Supabase
- Authentication: Supabase Auth
- Realtime: Supabase Realtime
- Hardware: ESP32 DevKit V1, three VL53L0X sensors, NEO-6M GPS, audio output
- Map: Leaflet and OpenStreetMap

## Data path

```text
Smart Glasses
     ↓
ESP32
     ↓ Wi-Fi / HTTPS
Supabase RPC
     ↓
PostgreSQL
 ├── locations
 └── obstacle_events
     ↓
Supabase Realtime
     ↓
Caregiver PWA
```

## Supabase setup

Run `supabase.sql` in the Supabase SQL Editor.

The schema contains:

- `profiles`
- `devices`
- `device_access`
- `locations`
- `obstacle_events`

The SQL also configures:

- Row Level Security
- authentication profile creation
- hardware device token verification
- telemetry ingestion
- Realtime
- family access management

For an existing database, review the migration before execution and confirm that the legacy columns being removed are no longer required.

## Authentication

The caregiver dashboard uses Supabase Auth for sign-in. Public account creation is not exposed in the web app.

Use Supabase Auth to create or provision caregiver and family accounts, then grant device access through the Family Access page.

Password recovery is built into the sign-in screen. Configure the Supabase Auth Site URL and Redirect URLs to the deployed Vercel origin so the reset link can return to the dashboard and allow the caregiver to choose a new password.

## Register a device

Create a row in `public.devices`:

- `owner_user_id`: visually impaired user's profile ID
- `device_name`: physical device name
- `status`: `offline`

Generate a hardware token:

```sql
SELECT encode(gen_random_bytes(24), 'hex') AS device_token;
```

Store only its SHA-256 hash:

```sql
UPDATE public.devices
SET device_token_hash = encode(
  extensions.digest('PASTE_DEVICE_TOKEN_HERE', 'sha256'),
  'hex'
)
WHERE id = 'YOUR-DEVICE-UUID';
```

The plaintext token is stored only in the ESP32 local configuration.

## Family access

The device owner can add a registered caregiver or family member from the Family Access page.

The account must already exist in Supabase Auth.

## Frontend configuration

Set the real project values in `config.js`:

```js
window.SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
window.SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY';
```

Only the anon/publishable key belongs in the browser.

## Live dashboard

After caregiver authentication, the dashboard reads only authorized devices through RLS.

The dashboard loads:

- latest device location
- recent location history
- obstacle events
- family access
- device status

Supabase Realtime updates the dashboard when new locations, obstacle events, or device status changes arrive.

The application uses live Supabase data only and does not include an automatic sample-data fallback.

## ESP32 telemetry

The hardware sends:

```text
POST https://YOUR_PROJECT.supabase.co/rest/v1/rpc/ingest_telemetry
```

with the Supabase anon/publishable key in the `apikey` header and the registered device token in the request body.

The RPC validates the device token, records the location, records obstacle events, and updates the device status.

The physical implementation must provide real readings from the VL53L0X sensors and NEO-6M GPS. The included firmware integration file does not generate simulated coordinates or simulated obstacle events.

## Vercel deployment

Deploy the repository as a static site.

- Framework Preset: Other
- Build Command: none
- Output Directory: none

The Vercel frontend communicates directly with Supabase.

## PWA

The project includes:

- `manifest.webmanifest`
- PWA icons
- `service-worker.js`
- Smart Eyeglasses branding
- install prompt support
- offline app-shell caching

Live telemetry still requires an internet connection to reach Supabase.

## Production checklist

1. Create caregiver accounts in Supabase Auth.
2. Confirm the corresponding `profiles` rows exist.
3. Register the physical Smart Glasses device.
4. Generate and register its device token hash.
5. Configure `config.js`.
6. Configure the ESP32 with its Wi-Fi, Supabase, device UUID, and device token values.
7. Implement the actual VL53L0X and NEO-6M reads in the hardware integration functions.
8. Test one location submission.
9. Test one obstacle event.
10. Confirm the caregiver dashboard receives both through Realtime.
11. Confirm Family Access works for the intended accounts.
12. Deploy the frontend to Vercel.

No Laravel, PHP, Node, Express, or separate VPS backend is required for this architecture.
