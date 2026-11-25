const $ = id => document.getElementById(id);

const APP_REDIRECT_URL = 'https://smrtglasses.vercel.app/';
let supabaseClient = null;
let deferredInstallPrompt = null;
let liveChannel = null;
let recoveryMode = /(?:^|[#&?])type=recovery(?:&|$)/.test(window.location.hash + window.location.search);
let statusRefreshTimer = null;
let liveDeviceId = null;
let claimAttemptedUserId = null;
let isLoadingData = false;
let loadFailed = false;
let alertSearchTimer = null;

const state = {
  events: [],
  locations: [],
  device: null,
  latestLocation: null,
  map: null,
  miniMap: null,
  access: [],
  eventCountTotal: null,
  eventCountToday: null
};

let currentTheme = localStorage.getItem('ses-theme') || 'light';

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));
}

function recordTime(row) {
  return row?.timestamp || row?.created_at || null;
}

function localDayBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function isToday(value) {
  if (!value) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toDateString() === new Date().toDateString();
}

async function loadEventCounts(deviceId) {
  const { start, end } = localDayBounds();
  const [totalResult, todayResult] = await Promise.all([
    supabaseClient.from('obstacle_events').select('id', { count: 'exact', head: true }).eq('device_id', deviceId),
    supabaseClient.from('obstacle_events').select('id', { count: 'exact', head: true })
      .eq('device_id', deviceId).gte('timestamp', start).lt('timestamp', end)
  ]);

  state.eventCountTotal = totalResult.error ? null : totalResult.count;
  state.eventCountToday = todayResult.error ? null : todayResult.count;

  if (totalResult.error || todayResult.error) {
    console.warn('[DASHBOARD] Exact obstacle-event counts could not be loaded:', totalResult.error?.message || todayResult.error?.message);
  }
}

function fmtAgo(iso) {
  if (!iso) return 'No update';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso)) / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function fmtDate(iso) {
  if (!iso) return 'No update';
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(window._toast);
  window._toast = setTimeout(() => $('toast').classList.remove('show'), 2600);
}

function showApp() {
  $('loginView').classList.add('hidden');
  $('appView').classList.remove('hidden');
  go('overview');
}

function showLogin() {
  $('appView').classList.add('hidden');
  $('loginView').classList.remove('hidden');
}

function go(section) {
  document.querySelectorAll('.nav-item').forEach(button => {
    button.classList.toggle('active', button.dataset.section === section);
  });
  document.querySelectorAll('.page-section').forEach(page => {
    page.classList.toggle('active-section', page.id === section);
  });
  const activeNav = [...document.querySelectorAll('.nav-item')]
    .find(button => button.dataset.section === section);
  $('pageTitle').textContent = activeNav
    ? activeNav.textContent.trim()
    : 'Dashboard';
  if (section === 'overview') setTimeout(() => initMap(false), 80);
  if (section === 'location') setTimeout(() => initMap(true), 80);
}

function severityClass(value) {
  return String(value || '').toLowerCase();
}

function uiDirection(value) {
  const direction = String(value || 'center').toLowerCase();
  return direction === 'center'
    ? 'Center'
    : direction === 'left'
      ? 'Left'
      : direction === 'right'
        ? 'Right'
        : 'Multiple';
}

function uiSeverity(value) {
  const severity = String(value || 'medium').toLowerCase();
  if (['high', 'danger', 'critical'].includes(severity)) return 'High';
  if (['low', 'safe'].includes(severity)) return 'Low';
  return 'Medium';
}

function uiDistanceMeters(row) {
  if (row?.distance_cm == null || !Number.isFinite(Number(row.distance_cm))) return null;
  return Number(row.distance_cm) / 100;
}

function latestDeviceUpdate() {
  const candidates = [
    state.device?.last_seen_at,
    state.device?.updated_at,
    recordTime(state.events[0]),
    recordTime(state.latestLocation)
  ].filter(Boolean);

  if (!candidates.length) return null;

  const latest = candidates
    .map(value => ({ value, time: new Date(value).getTime() }))
    .filter(item => Number.isFinite(item.time))
    .sort((a, b) => b.time - a.time)[0];

  return latest?.value || null;
}

function effectiveStatus() {
  const lastSignal = latestDeviceUpdate();
  if (lastSignal) {
    const age = Date.now() - new Date(lastSignal).getTime();
    return Number.isFinite(age) && age <= 120000 ? 'online' : 'offline';
  }

  const storedStatus = String(state.device?.status || state.device?.device_status || '').toLowerCase();
  return ['online', 'connected', 'active'].includes(storedStatus) ? 'online' : 'offline';
}

function currentDeviceName() {
  return state.device?.device_name || 'Smart Glasses';
}

function dirGlyph(direction) {
  const on = key => (direction === key || direction === 'Multiple' ? ' class="on"' : '');
  return `<svg class="dir" viewBox="0 0 40 40" aria-hidden="true"><path${on('Left')} d="M0.6 23.7A22 22 0 0 1 11.8 13.6"/><path${on('Center')} d="M13.9 12.9A22 22 0 0 1 26.1 12.9"/><path${on('Right')} d="M28.3 13.6A22 22 0 0 1 39.4 23.7"/><circle cx="20" cy="34" r="2.5"/></svg>`;
}

function renderRecent() {
  const list = state.events.slice(0, 5);
  $('recentEvents').innerHTML = list.map(event => {
    const direction = uiDirection(event.direction);
    const severity = uiSeverity(event.severity);
    const distance = uiDistanceMeters(event);
    return `<div class="event-item">${dirGlyph(direction)}<div><b>${esc(direction === 'Center' ? 'Obstacle ahead' : `Obstacle on the ${direction.toLowerCase()}`)}</b><span>${distance == null ? 'Distance unavailable' : `${distance.toFixed(1)} m`} · ${esc(fmtAgo(recordTime(event)))}</span></div><small class="severity ${severityClass(severity)}">${severity === 'High' ? 'More urgent' : severity === 'Low' ? 'Less urgent' : 'Moderate'}</small></div>`;
  }).join('') || '<div class="empty">No alerts recorded.</div>';
}

function renderStats() {
  const location = state.latestLocation;
  const updated = recordTime(location);
  const deviceUpdated = latestDeviceUpdate();
  const status = effectiveStatus();

  const todayCount = state.eventCountToday == null ? '—' : state.eventCountToday;
  const totalCount = state.eventCountTotal == null ? '—' : state.eventCountTotal;
  $('todayEvents').textContent = todayCount;
  if ($('alertsTodayCount')) $('alertsTodayCount').textContent = todayCount;
  $('alertsTotal').textContent = totalCount;
  $('eventTrend').textContent = state.events[0] ? `Latest detection ${fmtAgo(recordTime(state.events[0]))}` : 'No detections recorded';
  $('latestAlertText').textContent = state.events[0] ? fmtAgo(recordTime(state.events[0])) : 'None';
  $('miniLocationTime').textContent = fmtAgo(updated);
  $('locationAvailability').textContent = location ? 'Available' : 'Waiting';
  $('locationMeta').textContent = location ? `Updated ${fmtAgo(updated)}` : 'No telemetry received';
  document.documentElement.dataset.device = status;
  $('deviceStatus').textContent = status;
  $('deviceStatusMeta').textContent = deviceUpdated ? `Last telemetry ${fmtAgo(deviceUpdated)}` : 'No device telemetry received';
  $('relativeStatus').textContent = deviceUpdated ? `${status} · telemetry ${fmtAgo(deviceUpdated)}` : `${status} · waiting for telemetry`;
  $('locationTime').textContent = fmtDate(updated);
  $('locationUpdated').textContent = fmtAgo(updated);
  $('locationDevice').textContent = currentDeviceName();
  $('accessDeviceName').textContent = currentDeviceName();
  $('relativeName').textContent = currentDeviceName();
  $('connectionLabel').textContent = 'Live data';
  $('connectionSub').textContent = 'Supabase connected';

  if (location) {
    $('locationSummary').textContent = 'The glasses recently reported a position.';
    $('detailLat').textContent = `${Number(location.latitude).toFixed(5)}°`;
    $('detailLng').textContent = `${Number(location.longitude).toFixed(5)}°`;
  } else {
    $('locationSummary').textContent = 'Waiting for the glasses to report a position.';
    $('detailLat').textContent = 'No location';
    $('detailLng').textContent = 'No location';
  }
}

const ALERT_PAGE = 20;
const alertView = { items: [], total: 0, loading: false, failed: false, requestId: 0 };

function alertFilters() {
  return {
    query: ($('eventSearch').value || '').trim(),
    severity: $('severityFilter').value,
    days: $('rangeFilter').value
  };
}

function hasActiveFilters() {
  const f = alertFilters();
  return Boolean(f.query) || f.severity !== 'all' || f.days !== 'all';
}

async function loadAlerts({ more = false, keep = false } = {}) {
  if (!supabaseClient || !state.device) {
    alertView.items = [];
    alertView.total = 0;
    renderEvents();
    return;
  }

  const requestId = ++alertView.requestId;
  const f = alertFilters();
  const offset = more ? alertView.items.length : 0;
  const size = more || !keep ? ALERT_PAGE : Math.max(ALERT_PAGE, alertView.items.length);

  alertView.loading = true;
  alertView.failed = false;
  renderEvents();

  let query = supabaseClient
    .from('obstacle_events')
    .select('*', { count: 'exact' })
    .eq('device_id', state.device.id);

  if (f.days !== 'all') {
    query = query.gte('timestamp', new Date(Date.now() - Number(f.days) * 86400000).toISOString());
  }
  if (f.severity === 'High') query = query.or('severity.ilike.high,severity.ilike.danger,severity.ilike.critical');
  if (f.severity === 'Low') query = query.or('severity.ilike.low,severity.ilike.safe');
  if (f.severity === 'Medium') {
    query = query.or('severity.is.null,severity.not.in.(high,danger,critical,low,safe,High,Danger,Critical,Low,Safe)');
  }
  const term = f.query.replace(/[%,()*\\]/g, ' ').trim();
  if (term) query = query.or(`voice_command.ilike.%${term}%,direction.ilike.%${term}%`);

  const { data, error, count } = await query
    .order('timestamp', { ascending: false })
    .range(offset, offset + size - 1);

  if (requestId !== alertView.requestId) return;

  alertView.loading = false;
  if (error) {
    console.error('[DASHBOARD] Alerts could not be loaded:', error.message);
    alertView.failed = true;
    loadFailed = true;
    toast('Alerts could not be loaded. Please try again.');
  } else {
    const rows = data || [];
    const known = new Set(more ? alertView.items.map(item => item.id) : []);
    alertView.items = more ? alertView.items.concat(rows.filter(row => !known.has(row.id))) : rows;
    alertView.total = count ?? alertView.items.length;
  }
  renderEvents();
}

function renderEvents() {
  const rows = alertView.items;
  const filtered = hasActiveFilters();
  let body;

  if (!rows.length) {
    const message = alertView.loading
      ? 'Loading alerts...'
      : alertView.failed
        ? 'Alerts could not be loaded.'
        : filtered
          ? 'No alerts match these filters.'
          : 'No obstacle alerts have been recorded yet.';
    body = `<tr><td colspan="5" class="empty">${esc(message)}</td></tr>`;
  } else {
    body = rows.map(row => {
      const severity = uiSeverity(row.severity);
      const direction = uiDirection(row.direction);
      const distance = uiDistanceMeters(row);
      const label = direction === 'Center' ? 'Obstacle ahead' : `Obstacle on the ${direction.toLowerCase()}`;
      return `<tr>
        <td>${esc(fmtDate(recordTime(row)))}</td>
        <td><span class="alert-cell">${dirGlyph(direction)}<b>${esc(label)}</b></span></td>
        <td>${distance == null ? 'Not available' : `${distance.toFixed(1)} m`}</td>
        <td><span class="severity ${severityClass(severity)}">${esc(severity)}</span></td>
        <td>${esc(row.voice_command || 'Not available')}</td>
      </tr>`;
    }).join('');
  }

  $('eventsTable').innerHTML = `<table class="data-table"><thead><tr><th>When</th><th>Alert</th><th>Distance</th><th>Urgency</th><th>Voice guidance</th></tr></thead><tbody>${body}</tbody></table>`;
  $('alertsShown').textContent = rows.length ? `Showing ${rows.length} of ${alertView.total}` : '';
  $('loadMoreBtn').classList.toggle('hidden', !rows.length || rows.length >= alertView.total);
  $('loadMoreBtn').disabled = alertView.loading;
  $('loadMoreBtn').textContent = alertView.loading ? 'Loading...' : 'Show more';
}

function renderLocations() {
  $('locationHistory').innerHTML = `<table class="data-table"><thead><tr><th>When</th><th>Location</th><th>Source</th><th>Accuracy</th></tr></thead><tbody>${state.locations.slice(0, 10).map(location => {
    const source = location.source ? String(location.source).toUpperCase() : 'GPS';
    const accuracy = Number.isFinite(Number(location.accuracy_m)) && location.accuracy_m !== null
      ? `±${Math.round(Number(location.accuracy_m))} m` : 'Not available';
    return `<tr><td>${esc(fmtDate(recordTime(location)))}</td><td>${Number(location.latitude).toFixed(5)}, ${Number(location.longitude).toFixed(5)}</td><td>${esc(source)}</td><td>${esc(accuracy)}</td></tr>`;
  }).join('') || '<tr><td colspan="4">No location history available.</td></tr>'}</tbody></table>`;
}

function renderDevices() {
  const status = effectiveStatus();
  const updated = latestDeviceUpdate();
  $('deviceCards').innerHTML = `<div class="device-card"><div class="device-top"><div><div class="device-id">${esc(currentDeviceName())}</div><div class="device-type">${updated ? `Last reported ${esc(fmtAgo(updated))}` : 'Waiting for telemetry'}</div></div><div class="device-status"><span class="status-dot"></span>${esc(status)}</div></div><div class="device-specs"><div><span>Location</span><b>${state.latestLocation ? 'Available' : 'Waiting'}</b></div><div><span>Obstacle alerts</span><b>${state.events.length ? 'Available' : 'None yet'}</b></div><div><span>Audio guidance</span><b>Device controlled</b></div><div><span>Update</span><b>${esc(fmtAgo(updated))}</b></div><div><span>Device ID</span><b>${esc(state.device?.id || 'Not assigned')}</b></div></div></div>`;
  $('technicalConnection').textContent = status;
}

function renderAccess() {
  $('accessCount').textContent = state.access.length;
  $('accessTable').innerHTML = `<table class="data-table"><thead><tr><th>Person</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>${state.access.map(access => `<tr><td><b>${esc(access.email || access.name || 'Family member')}</b></td><td>${esc(access.role || 'Family member')}</td><td><span class="severity low">Active</span></td><td><button class="text-btn access-remove" data-user-id="${esc(access.user_id)}">Remove</button></td></tr>`).join('') || '<tr><td colspan="4">No family members have access.</td></tr>'}</tbody></table>`;
  document.querySelectorAll('.access-remove').forEach(button => {
    button.addEventListener('click', () => revokeAccess(button.dataset.userId));
  });
}

function renderMapEmpty(element) {
  element.innerHTML = '<div class="empty">Waiting for the glasses to report a location.</div>';
}

function initMap(main = false) {
  if (!window.L) return;
  const element = $(main ? 'mainMap' : 'miniMap');
  const location = state.latestLocation;

  if (!location) {
    const existing = main ? state.map : state.miniMap;
    if (existing) {
      existing.remove();
      if (main) state.map = null;
      else state.miniMap = null;
    }
    renderMapEmpty(element);
    return;
  }

  const existing = main ? state.map : state.miniMap;
  if (existing) existing.remove();

  const map = L.map(element, { zoomControl: main }).setView([location.latitude, location.longitude], 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  const history = state.locations.slice().reverse().map(item => [Number(item.latitude), Number(item.longitude)]);
  if (history.length > 1) {
    L.polyline(history, { color: '#2679a6', weight: 4, opacity: 1, dashArray: main ? '' : '6 8' }).addTo(map);
  }

  const latest = L.circleMarker([location.latitude, location.longitude], {
    radius: 10,
    color: '#ffffff',
    weight: 3,
    fillColor: '#17785a',
    fillOpacity: 1
  }).addTo(map);

  latest.bindPopup(`<b>${esc(currentDeviceName())}</b><br>${esc(fmtAgo(recordTime(location)))}`).openPopup();

  if (main) {
    state.events.slice(0, 6).forEach(event => {
      const eventLocation = state.locations.find(item => item.id === event.location_id);
      if (!eventLocation) return;
      const severity = uiSeverity(event.severity);
      const distance = uiDistanceMeters(event);
      L.circleMarker([eventLocation.latitude, eventLocation.longitude], {
        radius: 6,
        color: '#ffffff',
        weight: 2,
        fillColor: severity === 'High' ? '#b4492a' : '#946200',
        fillOpacity: 0.95
      }).addTo(map).bindPopup(`<b>Obstacle detected</b><br>${esc(uiDirection(event.direction))} · ${distance.toFixed(1)} m<br><small>${esc(fmtAgo(recordTime(event)))}</small>`);
    });
  }

  if (main) state.map = map;
  else state.miniMap = map;
}

function refreshMaps() {
  if (state.map) {
    state.map.remove();
    state.map = null;
  }
  if (state.miniMap) {
    state.miniMap.remove();
    state.miniMap = null;
  }
  const activeSection = document.querySelector('.page-section.active-section')?.id;
  if (activeSection === 'overview') setTimeout(() => initMap(false), 80);
  if (activeSection === 'location') setTimeout(() => initMap(true), 80);
}

async function loadData(options = {}) {
  if (!supabaseClient || isLoadingData) return;

  const quiet = options.quiet === true;
  const attemptClaim = options.attemptClaim !== false;
  isLoadingData = true;
  loadFailed = false;

  try {
    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError) throw userError;

    const user = userData.user;
    if (!user) {
      showLogin();
      return;
    }

    $('profileName').textContent = user.user_metadata?.name || user.email?.split('@')[0] || 'Caregiver';
    $('profileEmail').textContent = user.email || '';
    $('userName').textContent = user.user_metadata?.name || user.email?.split('@')[0] || 'Caregiver';

    let claimedDeviceId = null;
    let claimSetupError = null;
    if (attemptClaim && claimAttemptedUserId !== user.id) {
      const claimResult = await supabaseClient.rpc('claim_first_unassigned_device');
      if (claimResult.error) {
        claimAttemptedUserId = null;
        claimSetupError = claimResult.error.message;
        console.warn('[DASHBOARD] Automatic device claim is unavailable; continuing with existing account access:', claimResult.error.message);
      } else {
        claimAttemptedUserId = user.id;
        claimedDeviceId = typeof claimResult.data === 'string'
          ? claimResult.data
          : claimResult.data?.id || null;
        if (claimedDeviceId) console.info('[DASHBOARD] Device claim returned:', claimedDeviceId);
      }
    }

    const [ownedDevicesResult, accessRowsResult] = await Promise.all([
      supabaseClient
        .from('devices')
        .select('*')
        .eq('owner_user_id', user.id)
        .order('created_at', { ascending: true }),
      supabaseClient
        .from('device_access')
        .select('device_id')
        .eq('user_id', user.id)
    ]);

    if (ownedDevicesResult.error) {
      throw new Error(`Unable to read your assigned device: ${ownedDevicesResult.error.message}`);
    }

    let accessibleDevices = ownedDevicesResult.data || [];
    const accessibleDeviceIds = [...new Set((accessRowsResult.data || []).map(row => row.device_id).filter(Boolean))];

    if (accessRowsResult.error) {
      console.warn('[DASHBOARD] Family device links could not be listed directly:', accessRowsResult.error.message);
    }

    if (accessibleDeviceIds.length) {
      const { data: sharedDevices, error: sharedDevicesError } = await supabaseClient
        .from('devices')
        .select('*')
        .in('id', accessibleDeviceIds);

      if (sharedDevicesError) {
        console.warn('[DASHBOARD] Shared devices could not be loaded:', sharedDevicesError.message);
      } else {
        const byId = new Map(accessibleDevices.map(item => [item.id, item]));
        (sharedDevices || []).forEach(item => byId.set(item.id, item));
        accessibleDevices = [...byId.values()];
      }
    }

    if (!accessibleDevices.length && claimedDeviceId) {
      const { data: claimedDevice, error: claimedDeviceError } = await supabaseClient
        .from('devices')
        .select('*')
        .eq('id', claimedDeviceId)
        .maybeSingle();

      if (claimedDeviceError) {
        console.warn('[DASHBOARD] Claimed device could not be read:', claimedDeviceError.message);
      } else if (claimedDevice) {
        accessibleDevices = [claimedDevice];
      }
    }

    if (!accessibleDevices.length) {
      const [recentEventResult, recentLocationResult] = await Promise.all([
        supabaseClient
          .from('obstacle_events')
          .select('device_id')
          .order('timestamp', { ascending: false })
          .limit(1),
        supabaseClient
          .from('locations')
          .select('device_id')
          .order('timestamp', { ascending: false })
          .limit(1)
      ]);

      const telemetryDeviceId = recentEventResult.data?.[0]?.device_id || recentLocationResult.data?.[0]?.device_id || null;
      if (telemetryDeviceId) {
        const { data: telemetryDevice, error: telemetryDeviceError } = await supabaseClient
          .from('devices')
          .select('*')
          .eq('id', telemetryDeviceId)
          .maybeSingle();

        if (telemetryDeviceError) {
          console.warn('[DASHBOARD] Device found through readable telemetry, but its record is not readable:', telemetryDeviceError.message);
        } else if (telemetryDevice && telemetryDevice.owner_user_id === user.id) {
          accessibleDevices = [telemetryDevice];
        }
      }
    }

    const device = accessibleDevices[0] || null;

    if (!device) {
      state.device = null;
      state.locations = [];
      state.events = [];
      state.eventCountTotal = 0;
      state.eventCountToday = 0;
      state.latestLocation = null;
      state.access = [];
      if (liveChannel) supabaseClient.removeChannel(liveChannel);
      liveChannel = null;
      liveDeviceId = null;
      if (statusRefreshTimer) clearInterval(statusRefreshTimer);
      statusRefreshTimer = null;
      renderAll();
      if (!quiet) {
        toast(claimSetupError
          ? `Automatic device linking is unavailable: ${claimSetupError}`
          : 'No device is linked to this account yet. Check that the device is assigned to this account or shared with it in Supabase.');
      }
      console.warn('[DASHBOARD] No device is visible to the signed-in account. Check owner_user_id, device_access, and the devices SELECT policy.');
      return;
    }

    state.device = device;

    const [locationsResult, eventsResult, accessResult] = await Promise.all([
      supabaseClient
        .from('locations')
        .select('*')
        .eq('device_id', device.id)
        .order('timestamp', { ascending: false })
        .limit(50),
      supabaseClient
        .from('obstacle_events')
        .select('*')
        .eq('device_id', device.id)
        .order('timestamp', { ascending: false })
        .limit(100),
      supabaseClient.rpc('list_device_access', { p_device_id: device.id })
    ]);

    if (locationsResult.error) {
      console.warn('[DASHBOARD] Location history could not be loaded:', locationsResult.error.message);
    } else {
      state.locations = locationsResult.data || [];
    }

    if (eventsResult.error) {
      loadFailed = true;
      console.error('[DASHBOARD] Obstacle events could not be loaded:', eventsResult.error.message);
      if (!quiet) toast(`Obstacle events could not be loaded: ${eventsResult.error.message}`);
    } else {
      state.events = eventsResult.data || [];
    }

    await loadEventCounts(device.id);
    await loadAlerts({ keep: true });

    state.latestLocation = state.locations[0] || null;
    const locationById = Object.fromEntries(state.locations.map(location => [location.id, location]));
    state.events = state.events.map(event => {
      const location = locationById[event.location_id];
      return location ? { ...event, latitude: location.latitude, longitude: location.longitude } : event;
    });

    if (accessResult.error) {
      console.warn('[DASHBOARD] Family access list could not be loaded:', accessResult.error.message);
      state.access = [];
    } else {
      state.access = accessResult.data || [];
    }

    console.info('[DASHBOARD] Loaded device:', device.id);
    console.info('[DASHBOARD] Loaded obstacle events:', state.events.length);
    console.info('[DASHBOARD] Loaded locations:', state.locations.length);
    console.info('[DASHBOARD] Loaded family access entries:', state.access.length);

    subscribeToDevice(device.id);
    if (statusRefreshTimer) clearInterval(statusRefreshTimer);
    statusRefreshTimer = setInterval(() => {
      if (state.device) loadData({ quiet: true, attemptClaim: false });
    }, 30000);
  } catch (error) {
    loadFailed = true;
    console.error('[DASHBOARD] Data loading failed:', error);
    if (!quiet) toast(error.message || 'Unable to load live data.');
    if (!state.device) {
      state.locations = [];
      state.events = [];
      state.eventCountTotal = null;
      state.eventCountToday = null;
      state.latestLocation = null;
      state.access = [];
    }
  } finally {
    isLoadingData = false;
    renderAll();
  }
}

function upsertNewestRecord(collection, row, limit) {
  if (!row) return collection;
  const next = [row, ...collection.filter(item => item.id !== row.id)];
  next.sort((a, b) => new Date(recordTime(b) || 0).getTime() - new Date(recordTime(a) || 0).getTime());
  return next.slice(0, limit);
}

function subscribeToDevice(deviceId) {
  if (!supabaseClient?.channel || !deviceId) return;
  if (liveChannel && liveDeviceId === deviceId) return;

  if (liveChannel) supabaseClient.removeChannel(liveChannel);
  liveDeviceId = deviceId;

  liveChannel = supabaseClient
    .channel(`dashboard-live-${deviceId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'obstacle_events',
      filter: `device_id=eq.${deviceId}`
    }, payload => {
      const alreadyKnown = state.events.some(event => event.id === payload.new.id);
      state.events = upsertNewestRecord(state.events, payload.new, 100);
      if (!alreadyKnown) {
        if (state.eventCountTotal != null) state.eventCountTotal += 1;
        if (isToday(recordTime(payload.new)) && state.eventCountToday != null) state.eventCountToday += 1;
      }
      renderAll();
      loadAlerts({ keep: true });
      toast('New obstacle detection received.');
    })
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'locations',
      filter: `device_id=eq.${deviceId}`
    }, payload => {
      state.locations = upsertNewestRecord(state.locations, payload.new, 50);
      state.latestLocation = state.locations[0] || null;
      renderAll();
      toast('Location updated.');
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'devices',
      filter: `id=eq.${deviceId}`
    }, payload => {
      state.device = payload.new;
      renderAll();
    })
    .subscribe((status, error) => {
      if (status === 'SUBSCRIBED') {
        console.info('[DASHBOARD] Realtime connected for device:', deviceId);
      } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
        console.warn('[DASHBOARD] Realtime status:', status, error?.message || 'No additional details');
      }
    });
}

function openReset() {
  $('resetEmailInput').value = $('emailInput').value.trim();
  $('resetModal').classList.remove('hidden');
  setTimeout(() => $('resetEmailInput').focus(), 50);
}

function closeReset() {
  $('resetModal').classList.add('hidden');
}

function togglePassword() {
  const input = $('passwordInput');
  const button = $('togglePassword');
  const visible = input.type === 'text';
  input.type = visible ? 'password' : 'text';
  button.setAttribute('aria-label', visible ? 'Show password' : 'Hide password');
  button.setAttribute('title', visible ? 'Show password' : 'Hide password');
  button.innerHTML = `<iconify-icon icon="${visible ? 'solar:eye-bold-duotone' : 'solar:eye-closed-bold-duotone'}"></iconify-icon>`;
}

function closeUpdatePassword() {
  if (recoveryMode) return;
  $('updatePasswordModal').classList.add('hidden');
}

function enterRecoveryMode() {
  recoveryMode = true;
  showLogin();
  $('resetModal').classList.add('hidden');
  $('updatePasswordModal').classList.remove('hidden');
  setTimeout(() => $('newPasswordInput').focus(), 80);
}

function togglePasswordField(inputId, buttonId) {
  const input = $(inputId);
  const button = $(buttonId);
  const visible = input.type === 'text';
  input.type = visible ? 'password' : 'text';
  const label = visible ? 'Show password' : 'Hide password';
  button.setAttribute('aria-label', label);
  button.setAttribute('title', label);
  button.innerHTML = `<iconify-icon icon="${visible ? 'solar:eye-bold-duotone' : 'solar:eye-closed-bold-duotone'}"></iconify-icon>`;
}

async function updatePassword() {
  const password = $('newPasswordInput').value;
  const confirmation = $('confirmPasswordInput').value;
  if (password.length < 8) {
    toast('Use at least 8 characters.');
    return;
  }
  if (password !== confirmation) {
    toast('The passwords do not match.');
    return;
  }
  const { error } = await supabaseClient.auth.updateUser({ password });
  if (error) {
    toast(error.message);
    return;
  }
  $('newPasswordInput').value = '';
  $('confirmPasswordInput').value = '';
  $('updatePasswordModal').classList.add('hidden');
  recoveryMode = false;
  await supabaseClient.auth.signOut();
  showLogin();
  toast('Password updated successfully.');
}

async function sendPasswordReset() {
  if (!supabaseClient) {
    toast('Supabase is not configured.');
    return;
  }
  const email = $('resetEmailInput').value.trim();
  if (!email) {
    toast('Enter your account email first.');
    $('resetEmailInput').focus();
    return;
  }
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: APP_REDIRECT_URL
  });
  if (error) {
    toast(error.message);
    return;
  }
  closeReset();
  toast('Password reset link sent. Check your email.');
}

async function login(event) {
  event.preventDefault();

  if (!supabaseClient) {
    toast('Supabase is not configured.');
    return;
  }

  const email = $('emailInput').value.trim();
  const password = $('passwordInput').value;

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    toast(error.message);
    return;
  }

  showApp();
  await loadData();
}

async function logout() {
  if (liveChannel && supabaseClient) supabaseClient.removeChannel(liveChannel);
  liveChannel = null;
  liveDeviceId = null;
  claimAttemptedUserId = null;
  if (statusRefreshTimer) clearInterval(statusRefreshTimer);
  statusRefreshTimer = null;
  state.device = null;
  state.events = [];
  state.eventCountTotal = null;
  state.eventCountToday = null;
  state.locations = [];
  state.latestLocation = null;
  state.access = [];
  alertView.items = [];
  alertView.total = 0;
  alertView.requestId += 1;
  if (supabaseClient) await supabaseClient.auth.signOut();
  showLogin();
}

function openFamilyAccess() {
  if (!state.device) {
    toast('No device is assigned.');
    return;
  }
  $('familyEmailInput').value = '';
  $('familyAccessModal').classList.remove('hidden');
  requestAnimationFrame(() => $('familyEmailInput').focus());
}

function closeFamilyAccess() {
  $('familyAccessModal').classList.add('hidden');
}

async function addAccess() {
  if (!state.device) {
    toast('No device is assigned.');
    return;
  }

  const email = $('familyEmailInput').value.trim();
  if (!email) {
    $('familyEmailInput').focus();
    return;
  }

  const { error } = await supabaseClient.rpc('grant_device_access', {
    p_device_id: state.device.id,
    p_email: email
  });

  if (error) {
    toast(error.message);
    return;
  }

  closeFamilyAccess();
  await loadData();
  toast('Access granted.');
}

function setSeverity(value, silent = false) {
  const option = document.querySelector(`#severityPickerMenu .custom-option[data-value="${value}"]`);
  if (!option) return;
  $('severityFilter').value = value;
  $('severityPickerLabel').textContent = option.querySelector('span').textContent;
  document.querySelectorAll('#severityPickerMenu .custom-option').forEach(item => {
    const active = item.dataset.value === value;
    item.classList.toggle('active', active);
    item.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  closeSeverityPicker();
  if (!silent) loadAlerts();
}

function setRange(value, silent = false) {
  const option = document.querySelector(`#rangePickerMenu .custom-option[data-value="${value}"]`);
  if (!option) return;
  $('rangeFilter').value = value;
  $('rangePickerLabel').textContent = option.querySelector('span').textContent;
  document.querySelectorAll('#rangePickerMenu .custom-option').forEach(item => {
    const active = item.dataset.value === value;
    item.classList.toggle('active', active);
    item.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  closeRangePicker();
  if (!silent) loadAlerts();
}

function openRangePicker() {
  closeSeverityPicker();
  $('rangePicker').classList.add('open');
  $('rangePickerTrigger').setAttribute('aria-expanded', 'true');
}

function closeRangePicker() {
  $('rangePicker').classList.remove('open');
  $('rangePickerTrigger').setAttribute('aria-expanded', 'false');
}

function openResetFilters() {
  if (!hasActiveFilters()) {
    toast('Filters are already cleared.');
    return;
  }
  $('resetFiltersModal').classList.remove('hidden');
  $('cancelResetFilters').focus();
}

function closeResetFilters() {
  $('resetFiltersModal').classList.add('hidden');
}

function confirmResetFilters() {
  $('eventSearch').value = '';
  setSeverity('all', true);
  setRange('all', true);
  closeResetFilters();
  loadAlerts();
  toast('Filters were reset.');
}

async function refreshAll() {
  if (isLoadingData) {
    toast('Already refreshing. One moment.');
    return;
  }
  const button = $('refreshBtn');
  button.disabled = true;
  button.classList.add('spinning');
  await loadData();
  button.disabled = false;
  button.classList.remove('spinning');
  if ($('appView').classList.contains('hidden')) return;
  toast(loadFailed ? 'Could not refresh. Check your connection and try again.' : 'Information refreshed.');
}

function openSeverityPicker() {
  closeRangePicker();
  $('severityPicker').classList.add('open');
  $('severityPickerTrigger').setAttribute('aria-expanded', 'true');
}

function closeSeverityPicker() {
  $('severityPicker').classList.remove('open');
  $('severityPickerTrigger').setAttribute('aria-expanded', 'false');
}

async function revokeAccess(userId) {
  if (!state.device || !userId) return;

  const { error } = await supabaseClient.rpc('revoke_device_access', {
    p_device_id: state.device.id,
    p_user_id: userId
  });

  if (error) {
    toast(error.message);
    return;
  }

  await loadData();
  toast('Access removed.');
}

function renderAll() {
  renderStats();
  renderRecent();
  renderEvents();
  renderLocations();
  renderDevices();
  renderAccess();
  refreshMaps();
  $('lastSync').textContent = `Updated ${new Date().toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit'
  })}`;
}

function applyTheme() {
  document.body.classList.toggle('dark-mode', currentTheme === 'dark');
  document.querySelectorAll('#themeControl button').forEach(button => {
    const active = button.dataset.theme === currentTheme;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function openProfile() {
  $('profileMenu').classList.remove('hidden');
}

function closeProfile() {
  $('profileMenu').classList.add('hidden');
}


function openLogout() {
  closeProfile();
  $('logoutModal').classList.remove('hidden');
}

function closeLogout() {
  $('logoutModal').classList.add('hidden');
}

async function confirmLogout() {
  closeLogout();
  await logout();
  toast('You have been signed out.');
}

function setTheme(theme) {
  currentTheme = theme;
  localStorage.setItem('ses-theme', theme);
  applyTheme();
  toast(theme === 'dark' ? 'Dark mode enabled.' : 'Light mode enabled.');
}


function bind() {
  $('loginForm').addEventListener('submit', login);
  $('togglePassword').addEventListener('click', togglePassword);
  $('forgotPasswordBtn').addEventListener('click', openReset);
  $('cancelReset').addEventListener('click', closeReset);
  $('sendReset').addEventListener('click', sendPasswordReset);
  $('toggleNewPassword').addEventListener('click', () => togglePasswordField('newPasswordInput', 'toggleNewPassword'));
  $('toggleConfirmPassword').addEventListener('click', () => togglePasswordField('confirmPasswordInput', 'toggleConfirmPassword'));
  $('saveNewPassword').addEventListener('click', updatePassword);
  $('updatePasswordModal').addEventListener('click', event => {
    if (event.target === $('updatePasswordModal') && !recoveryMode) closeUpdatePassword();
  });
  $('resetModal').addEventListener('click', event => {
    if (event.target === $('resetModal')) closeReset();
  });
  $('logoutBtn').addEventListener('click', openLogout);
  $('refreshBtn').addEventListener('click', refreshAll);
  document.querySelectorAll('.nav-item').forEach(button => {
    button.addEventListener('click', () => go(button.dataset.section));
  });
  document.querySelectorAll('[data-section-jump]').forEach(button => {
    button.addEventListener('click', () => go(button.dataset.sectionJump));
  });
  $('eventSearch').addEventListener('input', () => {
    clearTimeout(alertSearchTimer);
    alertSearchTimer = setTimeout(() => loadAlerts(), 350);
  });
  $('loadMoreBtn').addEventListener('click', () => loadAlerts({ more: true }));
  $('rangePickerTrigger').addEventListener('click', () => {
    $('rangePicker').classList.contains('open') ? closeRangePicker() : openRangePicker();
  });
  document.querySelectorAll('#rangePickerMenu .custom-option').forEach(option => {
    option.addEventListener('click', () => setRange(option.dataset.value));
  });
  document.addEventListener('click', event => {
    if (!$('rangePicker').contains(event.target)) closeRangePicker();
  });
  $('cancelResetFilters').addEventListener('click', closeResetFilters);
  $('confirmResetFilters').addEventListener('click', confirmResetFilters);
  $('resetFiltersModal').addEventListener('click', event => {
    if (event.target === $('resetFiltersModal')) closeResetFilters();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    closeResetFilters();
    closeLogout();
    closeRangePicker();
  });
  $('severityPickerTrigger').addEventListener('click', () => {
    $('severityPicker').classList.contains('open') ? closeSeverityPicker() : openSeverityPicker();
  });
  document.querySelectorAll('#severityPickerMenu .custom-option').forEach(option => {
    option.addEventListener('click', () => setSeverity(option.dataset.value));
  });
  document.addEventListener('click', event => {
    if (!$('severityPicker').contains(event.target)) closeSeverityPicker();
  });
  $('severityPickerTrigger').addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openSeverityPicker();
    }
  });
  $('clearFilterBtn').addEventListener('click', openResetFilters);
  $('addAccessBtn').addEventListener('click', openFamilyAccess);
  $('closeFamilyAccess').addEventListener('click', closeFamilyAccess);
  $('cancelFamilyAccess').addEventListener('click', closeFamilyAccess);
  $('confirmFamilyAccess').addEventListener('click', addAccess);
  $('familyEmailInput').addEventListener('keydown', event => {
    if (event.key === 'Enter') addAccess();
    if (event.key === 'Escape') closeFamilyAccess();
  });
  $('familyAccessModal').addEventListener('click', event => {
    if (event.target === $('familyAccessModal')) closeFamilyAccess();
  });
  $('openMapsBtn').addEventListener('click', () => {
    const location = state.latestLocation;
    if (!location) {
      toast('No location is available yet.');
      return;
    }
    window.open(`https://www.google.com/maps?q=${location.latitude},${location.longitude}`, '_blank');
  });
  $('homeMapsBtn').addEventListener('click', () => {
    const location = state.latestLocation;
    if (!location) {
      toast('No location is available yet.');
      return;
    }
    window.open(`https://www.google.com/maps?q=${location.latitude},${location.longitude}`, '_blank');
  });
  $('showCoordinatesBtn').addEventListener('click', () => {
    $('coordinatesBox').classList.toggle('hidden');
    $('showCoordinatesBtn').textContent = $('coordinatesBox').classList.contains('hidden')
      ? 'Show exact coordinates'
      : 'Hide exact coordinates';
  });
  $('technicalToggle').addEventListener('click', () => {
    const hidden = $('technicalDetails').classList.toggle('hidden');
    $('technicalToggle').textContent = hidden ? 'Show details' : 'Hide details';
  });
  $('profileBtn').addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    openProfile();
  });
  $('installBtn')?.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    installApp();
  });
  $('profileLogoutBtn').addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    openLogout();
  });
  $('cancelLogout').addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    closeLogout();
  });
  $('confirmLogout').addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    confirmLogout();
  });
  $('logoutModal').addEventListener('click', event => {
    if (event.target === $('logoutModal')) closeLogout();
  });
  document.querySelectorAll('#themeControl button').forEach(button => {
    button.addEventListener('click', () => setTheme(button.dataset.theme));
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeProfile();
      closeLogout();
      closeReset();
      closeUpdatePassword();
    }
  });
  document.addEventListener('click', event => {
    if (!$('profileMenu').contains(event.target) && event.target !== $('profileBtn')) closeProfile();
  });
  applyTheme();
}

async function installApp() {
  if (!deferredInstallPrompt) {
    toast('Use your browser menu and choose Install app or Add to Home screen.');
    return;
  }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  $('installBtn').classList.add('hidden');
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  $('installBtn')?.classList.remove('hidden');
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  $('installBtn')?.classList.add('hidden');
  toast('Smart Eyeglasses was installed.');
});

bind();

(async () => {
  if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    $('authHint').textContent = 'Supabase configuration is required to use the live dashboard.';
    return;
  }

  supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      enterRecoveryMode();
    }
  });
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    toast(error.message);
    return;
  }

  if (recoveryMode) {
    enterRecoveryMode();
    return;
  }

  if (data.session) {
    showApp();
    await loadData();
  }
})();

