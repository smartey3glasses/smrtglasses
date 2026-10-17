# Smart Eyeglasses Monitoring System

A student-built HTML/CSS/JavaScript dashboard for the Smart Eyeglasses capstone. It is intentionally framework-light and can be opened as a normal web project. Supabase is used as the database/authentication/realtime backend when configured.

## 1. Stack
- Frontend: HTML5, CSS3, vanilla JavaScript
- Backend/data: Supabase
- Database: PostgreSQL through Supabase
- Authentication: Supabase Auth
- Realtime: Supabase Realtime
- Map: Leaflet + OpenStreetMap tiles
- Hardware data source: ESP32 + 3× VL53L0X + NEO-6M + VV4 audio

## 2. Setup
1. Create a Supabase project.
2. Open `supabase.sql` and run it in the Supabase SQL Editor.
3. In Supabase Authentication, enable Email/Password.
4. Create a test caregiver account.
5. Open `config.js` and replace `SUPABASE_URL` and `SUPABASE_ANON_KEY` with your project's public URL and anon/publishable key.
6. Serve the folder through a local web server. VS Code Live Server is enough.

Do not put a Supabase service-role key in `config.js` or any frontend file.

## 3. What the dashboard does
- Caregiver sign-in
- Overview of device, latest location, and obstacle events
- Live obstacle monitoring using three sensor directions: left, center, right
- Voice guidance status
- GPS map and location history
- Search/filterable obstacle-event table
- Device registry/status card
- Caregiver/family access page
- Supabase realtime updates for newly inserted locations and obstacle events
- Demo mode when Supabase is not configured
- Installable PWA with the Smart Eyeglasses logo
- Demo telemetry mapped to Legazpi City, Albay

## 4. Expected telemetry flow
ESP32 -> authenticated API/Edge Function -> Supabase -> Web Dashboard

The dashboard is not intended to directly expose privileged database credentials to the ESP32. For a real deployment, use a protected ingestion endpoint or Edge Function.

## 5. Thesis alignment
The UI follows the current thesis architecture: Profiles, Devices, Device_Access, Locations, and Obstacle_Events. The system scope remains limited to obstacle detection, voice guidance, GPS location tracking, and caregiver/family monitoring. It does not add facial recognition, object identification, indoor navigation, traffic-light recognition, or image processing.
