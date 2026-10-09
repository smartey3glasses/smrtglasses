# Smart Glasses Monitoring System

React + Vite dashboard with Supabase authentication/profile storage and a clearly labelled local telemetry simulator for development before the glasses hardware is connected.

## Run locally

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and enter your Supabase project URL and **anon/publishable** key.
4. Run `npm run dev`.

## Supabase setup (required for account creation and login)

1. Open your Supabase project, then **SQL Editor**.
2. Run the complete `supabase/schema.sql` file. It creates the data tables, row-level security policies, and an Auth trigger that creates a matching profile when a user registers. The trigger is important when email confirmation is enabled.
3. In **Authentication → URL Configuration**, set the Site URL to your deployed app URL and add local/deployed URLs to Redirect URLs.
4. In **Authentication → Providers → Email**, choose whether email confirmation is required. If it is enabled, users must click the confirmation link before password login will work. If disabled, newly registered users can sign in immediately.
5. Test with a new email address. If an account was already created before the profile trigger was added, sign in once after running the schema; the app attempts to backfill that user's profile.

Never put a Supabase `service_role` key in a frontend `.env` file. Only use the anon/publishable key in this client app; database access is restricted by RLS.

## Before hardware is ready

The obstacle events, GPS path, battery and connection indicators are **simulated demo data** generated in `src/lib/mockData.js`. They are not readings from real sensors and must not be used for navigation or safety decisions. Authentication, user profiles and the device lookup use Supabase. The dashboard falls back to simulated telemetry until a real device ingestion path is implemented.

## Connecting hardware later

Keep the dashboard components consuming the same event/status/location shapes used by `src/lib/mockData.js`, then replace the mock source with data from your device bridge (for example, an authenticated API or Supabase Edge Function). Insert real readings into `locations` and `obstacle_events` and update `devices`; never expose a service-role key on the glasses or in the browser. Confirm authorization policies and validate device ownership before enabling real location data.

## Build

`npm run build` creates the production bundle in `dist/`.
