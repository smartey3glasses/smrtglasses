const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-device-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isUsableMac(mac: string): boolean {
  if (!/^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/i.test(mac)) return false;
  const normalized = mac.toUpperCase();
  if (normalized === "FF:FF:FF:FF:FF:FF" || normalized.startsWith("00:00:5E:")) return false;
  // Locally administered/randomized BSSIDs are generally not stable lookup identifiers.
  const firstOctet = Number.parseInt(normalized.slice(0, 2), 16);
  return (firstOctet & 0x02) === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const expectedToken = Deno.env.get("LOCATION_API_TOKEN") ?? "";
  const suppliedToken = req.headers.get("x-device-token") ?? "";
  if (!expectedToken || !suppliedToken || !safeEqual(expectedToken, suppliedToken)) {
    return json(401, { error: "Invalid device token" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: "Supabase server secrets are not configured" });
  }

  let input: { device_id?: string; wifiAccessPoints?: Array<Record<string, unknown>> };
  try {
    input = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const deviceId = input.device_id ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceId)) {
    return json(400, { error: "Invalid device_id" });
  }

  const accessPoints = (input.wifiAccessPoints ?? [])
    .filter((ap) => typeof ap.macAddress === "string" && isUsableMac(ap.macAddress))
    .map((ap) => ({
      macAddress: String(ap.macAddress).toLowerCase(),
      signalStrength: Number(ap.signalStrength),
      ...(Number.isFinite(Number(ap.channel)) ? { channel: Number(ap.channel) } : {}),
      age: 0,
    }))
    .filter((ap) => Number.isFinite(ap.signalStrength) && ap.signalStrength <= -10 && ap.signalStrength >= -128)
    .slice(0, 20);

  if (accessPoints.length < 2) {
    return json(422, {
      error: "At least two usable stationary Wi-Fi access points are required",
      usable_access_points: accessPoints.length,
    });
  }

  // beaconDB is a free, experimental, community-maintained Wi-Fi geolocation database.
  // Disable IP fallback so we do not mistake an ISP-level estimate for Wi-Fi positioning.
  const geoResponse = await fetch("https://api.beacondb.net/v1/geolocate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "SmartGlassesCapstone/1.0 (Wi-Fi geolocation; contact: project-maintainer)",
    },
    body: JSON.stringify({
      considerIp: false,
      wifiAccessPoints: accessPoints,
    }),
  });

  const geoResult = await geoResponse.json().catch(() => ({}));
  if (!geoResponse.ok || !geoResult.location) {
    return json(geoResponse.status === 404 ? 422 : 502, {
      error: "beaconDB could not determine a location from these Wi-Fi access points",
      provider_status: geoResponse.status,
      details: geoResult,
      usable_access_points: accessPoints.length,
    });
  }

  const latitude = Number(geoResult.location.lat);
  const longitude = Number(geoResult.location.lng);
  const accuracy = Number(geoResult.accuracy);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 ||
      !Number.isFinite(accuracy) || accuracy <= 0) {
    return json(502, { error: "beaconDB returned invalid coordinates or accuracy" });
  }

  const insertResponse = await fetch(`${supabaseUrl}/rest/v1/locations`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      device_id: deviceId,
      latitude,
      longitude,
      source: "wifi",
      accuracy_m: accuracy,
    }),
  });

  const insertBody = await insertResponse.text();
  if (!insertResponse.ok) {
    return json(502, { error: "Could not save Wi-Fi location to Supabase", details: insertBody });
  }

  return json(200, {
    ok: true,
    source: "wifi",
    latitude,
    longitude,
    accuracy_m: accuracy,
    access_points_used: accessPoints.length,
    provider: "beaconDB",
  });
});
