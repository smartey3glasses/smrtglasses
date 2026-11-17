# Proposed System Features – Smart Eyeglasses

This outline is based on the supplied Smart Eyeglasses caregiver web-app source code and the stated capstone components. Keep the distinction between features already represented in the web application and hardware functions that still require real sensor/firmware validation.

## Features of the Proposed System

The Smart Eyeglasses system is composed of a wearable device and a caregiver web application. The wearable device is intended to detect nearby obstacles, provide audio guidance, and obtain the user's location. The caregiver web application provides authorized family members or caregivers with access to device status, location information, and recorded obstacle detections.

### 1. User Authentication and Account Recovery
Allows authorized caregivers to sign in to the web application using their registered email and password. It also provides a password-recovery process through an email reset link.

### 2. Caregiver Dashboard
Presents a summary of the connected Smart Eyeglasses, latest device activity, current location availability, and recent obstacle detections. It serves as the main page for accessing the system's monitoring functions.

### 3. Obstacle Detection and Distance Information
Uses the VL53L0X time-of-flight sensors connected to the ESP32 to identify nearby obstacles and obtain distance measurements. Detection records may include the reported direction, measured distance, severity, and associated voice guidance. The actual sensor detection logic must be implemented and tested in the device firmware.

### 4. Audio or Voice Guidance
Provides spoken guidance to help the wearer become aware of detected obstacles while moving. The guidance is intended to be delivered through the connected audio output/bone-conduction headset. The exact commands and triggering conditions should match the final firmware implementation.

### 5. GPS Location Monitoring
Uses the NEO-6M GPS module to obtain the wearable device's geographic coordinates. The caregiver application displays the latest available location on an interactive map and presents the corresponding coordinates and update time.

### 6. Obstacle Alert Records and History
Stores obstacle detection records in the database and displays them in the Alerts section. Each record may show its timestamp, reported direction, distance, severity, and voice command. Caregivers can search the records and filter them by severity.

### 7. Detection Statistics
Displays the number of recorded obstacle-event rows for the current local day and the all-time total for the selected device. Counts are retrieved using exact database counts rather than the number of records currently loaded into the browser. The history table is limited to the latest 100 records in this version.

### 8. Device Status and Connection Monitoring
Displays whether the Smart Eyeglasses are online or offline based on the latest device heartbeat or telemetry timestamp, along with the most recent update and device information.

### 9. Family Access Management
Allows the device owner or authorized account to grant or revoke viewing access for registered family members or caregivers. Shared users can access the permitted device information according to the database access policies.

### 10. Live Data Synchronization
Uses Supabase Realtime to update the caregiver dashboard when new obstacle-event records, location records, or device-status changes are received.

### 11. Application Preferences
Provides light and dark appearance modes and English/Filipino interface labels for the caregiver-facing application.

### 12. Installable Web Application
Supports installation as a Progressive Web App (PWA) on compatible devices. The application shell can be cached for quicker access, while live location and alert data still require an internet connection.

## Important implementation note

In the supplied `hardware/esp32_supabase_sender.ino`, `readGps()` and `readObstacles()` are placeholder functions that currently return `false`. Therefore, the code package does not yet demonstrate live NEO-6M GPS readings or VL53L0X obstacle readings from the physical hardware. Before describing these hardware features as fully operational in the final paper, implement the sensor-reading functions and verify the complete device-to-database-to-dashboard flow. Also define whether a “detection” means each database event record or one continuous obstacle encounter; the current dashboard counts stored event records, not unique obstacle encounters.
