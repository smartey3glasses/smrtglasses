#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
const char* SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY";
const char* DEVICE_TOKEN = "YOUR_DEVICE_TOKEN";
const char* DEVICE_ID = "YOUR_DEVICE_UUID";

struct ObstacleReading {
  bool detected;
  const char* direction;
  double distanceCm;
  const char* severity;
  const char* voiceCommand;
};

bool readGps(double& latitude, double& longitude) {
  return false;
}

bool readObstacles(ObstacleReading& reading) {
  return false;
}

bool sendTelemetry(double latitude, double longitude, const ObstacleReading& reading) {
  if (WiFi.status() != WL_CONNECTED) return false;

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  String endpoint = String(SUPABASE_URL) + "/rest/v1/rpc/ingest_telemetry";

  if (!http.begin(client, endpoint)) return false;

  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<1024> doc;
  doc["p_device_token"] = DEVICE_TOKEN;
  doc["p_device_id"] = DEVICE_ID;
  doc["p_latitude"] = latitude;
  doc["p_longitude"] = longitude;
  JsonArray obstacles = doc["p_obstacles"].to<JsonArray>();

  if (reading.detected) {
    JsonObject obstacle = obstacles.add<JsonObject>();
    obstacle["direction"] = reading.direction;
    obstacle["distance_cm"] = reading.distanceCm;
    obstacle["severity"] = reading.severity;
    obstacle["voice_command"] = reading.voiceCommand;
  }

  String body;
  serializeJson(doc, body);

  const int status = http.POST(body);
  const bool success = status >= 200 && status < 300;
  http.end();
  return success;
}

void connectWifi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
}

void setup() {
  Serial.begin(115200);
  connectWifi();
}

void loop() {
  double latitude = 0;
  double longitude = 0;
  ObstacleReading reading{false, nullptr, 0, nullptr, nullptr};

  if (readGps(latitude, longitude)) {
    readObstacles(reading);
    sendTelemetry(latitude, longitude, reading);
  }

  delay(1000);
}
