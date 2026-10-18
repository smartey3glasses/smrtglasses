const $ = id => document.getElementById(id);

const APP_REDIRECT_URL = 'https://smrtglasses.vercel.app/';
let supabaseClient = null;
let deferredInstallPrompt = null;
let liveChannel = null;
let recoveryMode = /(?:^|[#&?])type=recovery(?:&|$)/.test(window.location.hash + window.location.search);

const state = {
  events: [],
  locations: [],
  device: null,
  latestLocation: null,
  map: null,
  miniMap: null,
  access: []
};

const i18n = {
  en: {
    navHome: 'Home',
    navLocation: 'Location',
    navAlerts: 'Alerts',
    navGlasses: 'Smart Glasses',
    navFamily: 'Family Access',
    pageHome: 'Home',
    pageLocation: 'Location',
    pageAlerts: 'Alerts',
    pageGlasses: 'Smart Glasses',
    pageFamily: 'Family Access',
    settings: 'Settings',
    install: 'Install app',
    signout: 'Sign out',
    signoutTitle: 'Sign out?',
    signoutMessage: 'Are you sure you want to sign out of the caregiver dashboard?',
    cancel: 'Cancel',
    appearance: 'Appearance',
    theme: 'Theme',
    themeHint: 'Choose how the dashboard looks.',
    light: 'Light',
    dark: 'Dark',
    language: 'Language',
    languageHint: 'English or Filipino.',
    english: 'English',
    filipino: 'Filipino',
    preferences: 'PREFERENCES',
    note: 'Language changes the caregiver-facing labels and controls. Device technical terms stay in their original names.',
    forgotPassword: 'Forgot password?',
    resetTitle: 'Reset your password',
    resetMessage: "Enter your account email and we'll send you a password reset link.",
    resetEmail: 'Email',
    resetCancel: 'Cancel',
    resetSend: 'Send reset link',
    resetSent: 'Password reset link sent. Check your email.',
    resetRequired: 'Enter your account email first.',
    passwordShown: 'Hide password',
    passwordHidden: 'Show password',
    updatePasswordTitle: 'Choose a new password',
    updatePasswordMessage: 'Set a new password for your caregiver account.',
    newPassword: 'New password',
    confirmPassword: 'Confirm password',
    updatePassword: 'Update password',
    passwordUpdated: 'Password updated successfully.',
    passwordMismatch: 'The passwords do not match.',
    passwordShort: 'Use at least 8 characters.'
  },
  fil: {
    navHome: 'Home',
    navLocation: 'Lokasyon',
    navAlerts: 'Mga Alerto',
    navGlasses: 'Smart Glasses',
    navFamily: 'Access ng Pamilya',
    pageHome: 'Home',
    pageLocation: 'Lokasyon',
    pageAlerts: 'Mga Alerto',
    pageGlasses: 'Smart Glasses',
    pageFamily: 'Access ng Pamilya',
    settings: 'Settings',
    install: 'I-install ang app',
    signout: 'Mag-sign out',
    signoutTitle: 'Mag-sign out?',
    signoutMessage: 'Sigurado ka bang gusto mong mag-sign out sa caregiver dashboard?',
    cancel: 'Kanselahin',
    appearance: 'Itsura',
    theme: 'Theme',
    themeHint: 'Piliin kung paano ipapakita ang dashboard.',
    light: 'Light',
    dark: 'Dark',
    language: 'Wika',
    languageHint: 'English o Filipino.',
    english: 'English',
    filipino: 'Filipino',
    preferences: 'MGA SETTING',
    note: 'Binabago ng wika ang mga label at controls para sa caregiver. Hindi isinasalin ang technical terms ng device.',
    forgotPassword: 'Nakalimutan ang password?',
    resetTitle: 'I-reset ang password',
    resetMessage: 'Ilagay ang email ng account at padadalhan ka namin ng reset link.',
    resetEmail: 'Email',
    resetCancel: 'Kanselahin',
    resetSend: 'Magpadala ng reset link',
    resetSent: 'Naipadala ang password reset link. Tingnan ang email mo.',
    resetRequired: 'Ilagay muna ang email ng account.',
    passwordShown: 'Itago ang password',
    passwordHidden: 'Ipakita ang password',
    updatePasswordTitle: 'Gumawa ng bagong password',
    updatePasswordMessage: 'Magtakda ng bagong password para sa caregiver account mo.',
    newPassword: 'Bagong password',
    confirmPassword: 'Kumpirmahin ang password',
    updatePassword: 'I-update ang password',
    passwordUpdated: 'Matagumpay na na-update ang password.',
    passwordMismatch: 'Hindi magkapareho ang mga password.',
    passwordShort: 'Gumamit ng hindi bababa sa 8 characters.'
  }
};

let currentLang = localStorage.getItem('ses-lang') || 'en';
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
  const titles = {
    overview: i18n[currentLang].pageHome,
    location: i18n[currentLang].pageLocation,
    events: i18n[currentLang].pageAlerts,
    devices: i18n[currentLang].pageGlasses,
    access: i18n[currentLang].pageFamily
  };
  $('pageTitle').textContent = titles[section] || i18n[currentLang].pageHome;
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
  const severity = String(value || 'warning').toLowerCase();
  return severity === 'danger' ? 'High' : 'Medium';
}

function uiDistanceMeters(row) {
  return row?.distance_cm != null ? Number(row.distance_cm) / 100 : 0;
}

function effectiveStatus() {
  const latest = recordTime(state.latestLocation);
  if (!latest) return state.device?.status || 'offline';
  return Date.now() - new Date(latest).getTime() <= 120000 ? 'online' : 'offline';
}

function currentDeviceName() {
  return state.device?.device_name || 'Smart Glasses';
}

function renderRecent() {
  const list = state.events.slice(0, 5);
  $('recentEvents').innerHTML = list.map(event => {
    const direction = uiDirection(event.direction);
    const severity = uiSeverity(event.severity);
    const distance = uiDistanceMeters(event);
    return `<div class="event-item"><div class="event-icon"><iconify-icon icon="solar:danger-triangle-linear"></iconify-icon></div><div><b>${esc(direction === 'Center' ? 'Obstacle ahead' : `Obstacle on the ${direction.toLowerCase()}`)}</b><span>${distance.toFixed(1)} m · ${esc(fmtAgo(recordTime(event)))}</span></div><small class="severity ${severityClass(severity)}">${severity === 'High' ? 'More urgent' : 'Moderate'}</small></div>`;
  }).join('') || '<div class="empty">No alerts recorded.</div>';
}

function renderStats() {
  const location = state.latestLocation;
  const updated = recordTime(location);
  const status = effectiveStatus();

  $('todayEvents').textContent = state.events.length;
  $('alertsTotal').textContent = state.events.length;
  $('eventTrend').textContent = state.events[0] ? `Latest alert ${fmtAgo(recordTime(state.events[0]))}` : 'No alerts recorded';
  $('latestAlertText').textContent = state.events[0] ? fmtAgo(recordTime(state.events[0])) : 'None';
  $('miniLocationTime').textContent = fmtAgo(updated);
  $('locationAvailability').textContent = location ? 'Available' : 'Waiting';
  $('locationMeta').textContent = location ? `Updated ${fmtAgo(updated)}` : 'No telemetry received';
  $('deviceStatus').textContent = status;
  $('deviceStatusMeta').textContent = updated ? `Last update ${fmtAgo(updated)}` : 'No telemetry received';
  $('relativeStatus').textContent = updated ? `${status} · updated ${fmtAgo(updated)}` : `${status} · no telemetry`;
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

function renderEvents() {
  const query = ($('eventSearch').value || '').toLowerCase();
  const severityFilter = $('severityFilter').value;
  const rows = state.events.filter(event => {
    const severity = uiSeverity(event.severity);
    const matchesSeverity = severityFilter === 'all' || severity === severityFilter;
    const searchable = [uiDirection(event.direction), event.voice_command || '', severity].join(' ').toLowerCase();
    return matchesSeverity && searchable.includes(query);
  });

  $('eventsTable').innerHTML = `<table class="data-table"><thead><tr><th>WHEN</th><th>ALERT</th><th>DISTANCE</th><th>URGENCY</th><th>VOICE GUIDANCE</th></tr></thead><tbody>${rows.map(event => {
    const direction = uiDirection(event.direction);
    const severity = uiSeverity(event.severity);
    const distance = uiDistanceMeters(event);
    return `<tr><td>${esc(fmtDate(recordTime(event)))}</td><td><b>${esc(direction === 'Center' ? 'Obstacle ahead' : `Obstacle on the ${direction.toLowerCase()}`)}</b></td><td>${distance.toFixed(1)} m</td><td><span class="severity ${severityClass(severity)}">${severity === 'High' ? 'More urgent' : 'Moderate'}</span></td><td>${esc(event.voice_command || 'Obstacle detected')}</td></tr>`;
  }).join('') || '<tr><td colspan="5">No alerts recorded.</td></tr>'}</tbody></table>`;
}

function renderLocations() {
  $('locationHistory').innerHTML = `<table class="data-table"><thead><tr><th>WHEN</th><th>LOCATION</th></tr></thead><tbody>${state.locations.slice(0, 10).map(location => `<tr><td>${esc(fmtDate(recordTime(location)))}</td><td>${Number(location.latitude).toFixed(5)}, ${Number(location.longitude).toFixed(5)}</td></tr>`).join('') || '<tr><td colspan="2">No location history available.</td></tr>'}</tbody></table>`;
}

function renderDevices() {
  const status = effectiveStatus();
  const updated = recordTime(state.latestLocation);
  $('deviceCards').innerHTML = `<div class="device-card"><div class="device-top"><div><div class="device-id">${esc(currentDeviceName())}</div><div class="device-type">${updated ? `Last reported ${esc(fmtAgo(updated))}` : 'Waiting for telemetry'}</div></div><div class="device-status"><span class="status-dot"></span>${esc(status)}</div></div><div class="device-specs"><div><span>Location</span><b>${state.latestLocation ? 'Available' : 'Waiting'}</b></div><div><span>Obstacle alerts</span><b>${state.events.length ? 'Available' : 'None yet'}</b></div><div><span>Audio guidance</span><b>Device controlled</b></div><div><span>Update</span><b>${esc(fmtAgo(updated))}</b></div><div><span>Device ID</span><b>${esc(state.device?.id || 'Not assigned')}</b></div></div></div>`;
  $('technicalConnection').textContent = status;
}

function renderAccess() {
  $('accessCount').textContent = state.access.length;
  $('accessTable').innerHTML = `<table class="data-table"><thead><tr><th>PERSON</th><th>ROLE</th><th>STATUS</th><th></th></tr></thead><tbody>${state.access.map(access => `<tr><td><b>${esc(access.email || access.name || 'Family member')}</b></td><td>${esc(access.role || 'Family member')}</td><td><span class="severity low">Active</span></td><td><button class="text-btn access-remove" data-user-id="${esc(access.user_id)}">Remove</button></td></tr>`).join('') || '<tr><td colspan="4">No family members have access.</td></tr>'}</tbody></table>`;
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
    L.polyline(history, { color: '#55b993', weight: 4, opacity: 0.72, dashArray: main ? '' : '6 8' }).addTo(map);
  }

  const latest = L.circleMarker([location.latitude, location.longitude], {
    radius: 10,
    color: '#0f2c24',
    weight: 3,
    fillColor: '#66d1a7',
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
        color: '#562f2b',
        weight: 2,
        fillColor: severity === 'High' ? '#e97b70' : '#e7b56d',
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

async function loadData() {
  if (!supabaseClient) return;

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

    const { data: devices, error: deviceError } = await supabaseClient
      .from('devices')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1);

    if (deviceError) throw deviceError;
    const device = devices?.[0];

    if (!device) {
      state.device = null;
      state.locations = [];
      state.events = [];
      state.latestLocation = null;
      state.access = [];
      renderAll();
      toast('No Smart Glasses device is assigned to this account yet.');
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

    if (locationsResult.error) throw locationsResult.error;
    if (eventsResult.error) throw eventsResult.error;
    if (accessResult.error) throw accessResult.error;

    state.locations = locationsResult.data || [];
    state.latestLocation = state.locations[0] || null;
    const locationById = Object.fromEntries(state.locations.map(location => [location.id, location]));
    state.events = (eventsResult.data || []).map(event => {
      const location = locationById[event.location_id];
      return location ? { ...event, latitude: location.latitude, longitude: location.longitude } : event;
    });
    state.access = accessResult.data || [];

    subscribeToDevice(device.id);
  } catch (error) {
    console.error(error);
    state.device = null;
    state.locations = [];
    state.events = [];
    state.latestLocation = null;
    state.access = [];
    toast(error.message || 'Unable to load live data.');
  }

  renderAll();
}

function subscribeToDevice(deviceId) {
  if (!supabaseClient?.channel) return;

  if (liveChannel) supabaseClient.removeChannel(liveChannel);

  liveChannel = supabaseClient
    .channel(`dashboard-live-${deviceId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'obstacle_events',
      filter: `device_id=eq.${deviceId}`
    }, payload => {
      state.events.unshift(payload.new);
      loadData();
      toast('New obstacle alert received.');
    })
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'locations',
      filter: `device_id=eq.${deviceId}`
    }, payload => {
      state.locations.unshift(payload.new);
      state.locations = state.locations.slice(0, 50);
      state.latestLocation = payload.new;
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
    .subscribe();
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
  button.setAttribute('aria-label', visible ? i18n[currentLang].passwordHidden : i18n[currentLang].passwordShown);
  button.setAttribute('title', visible ? i18n[currentLang].passwordHidden : i18n[currentLang].passwordShown);
  button.innerHTML = `<iconify-icon icon="${visible ? 'solar:eye-linear' : 'solar:eye-closed-linear'}"></iconify-icon>`;
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
  const label = visible ? i18n[currentLang].passwordHidden : i18n[currentLang].passwordShown;
  button.setAttribute('aria-label', label);
  button.setAttribute('title', label);
  button.innerHTML = `<iconify-icon icon="${visible ? 'solar:eye-linear' : 'solar:eye-closed-linear'}"></iconify-icon>`;
}

async function updatePassword() {
  const password = $('newPasswordInput').value;
  const confirmation = $('confirmPasswordInput').value;
  if (password.length < 8) {
    toast(i18n[currentLang].passwordShort);
    return;
  }
  if (password !== confirmation) {
    toast(i18n[currentLang].passwordMismatch);
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
  toast(i18n[currentLang].passwordUpdated);
}

async function sendPasswordReset() {
  if (!supabaseClient) {
    toast('Supabase is not configured.');
    return;
  }
  const email = $('resetEmailInput').value.trim();
  if (!email) {
    toast(i18n[currentLang].resetRequired);
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
  toast(i18n[currentLang].resetSent);
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

function setSeverity(value) {
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
  renderEvents();
}

function openSeverityPicker() {
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

function textNode(element, text) {
  if (!element) return;
  const node = [...element.childNodes].find(item => item.nodeType === 3 && item.textContent.trim());
  if (node) node.textContent = ` ${text}`;
  else element.textContent = text;
}

function applyTheme() {
  document.body.classList.toggle('dark-mode', currentTheme === 'dark');
  document.querySelectorAll('#themeControl button').forEach(button => {
    button.classList.toggle('active', button.dataset.theme === currentTheme);
  });
}

function applyLanguage() {
  const text = i18n[currentLang];
  const nav = document.querySelectorAll('.nav-item');
  if (nav[0]) textNode(nav[0], text.navHome);
  if (nav[1]) textNode(nav[1], text.navLocation);
  if (nav[2]) textNode(nav[2], text.navAlerts);
  if (nav[3]) textNode(nav[3], text.navGlasses);
  if (nav[4]) textNode(nav[4], text.navFamily);

  const active = document.querySelector('.nav-item.active');
  if (active) {
    const titles = {
      overview: text.pageHome,
      location: text.pageLocation,
      events: text.pageAlerts,
      devices: text.pageGlasses,
      access: text.pageFamily
    };
    $('pageTitle').textContent = titles[active.dataset.section] || text.pageHome;
  }

  textNode($('settingsBtn'), text.settings);
  textNode($('installBtn'), text.install);
  textNode($('profileLogoutBtn'), text.signout);
  textNode($('logoutTitle'), text.signoutTitle);
  textNode($('logoutMessage'), text.signoutMessage);
  textNode($('cancelLogout'), text.cancel);
  textNode($('confirmLogout'), text.signout);
  textNode($('forgotPasswordBtn'), text.forgotPassword);
  textNode($('resetTitle'), text.resetTitle);
  textNode($('resetMessage'), text.resetMessage);
  textNode($('cancelReset'), text.resetCancel);
  textNode($('sendReset'), text.resetSend);
  textNode($('updatePasswordTitle'), text.updatePasswordTitle);
  textNode($('updatePasswordMessage'), text.updatePasswordMessage);
  textNode(document.querySelector('label[for="newPasswordInput"]'), text.newPassword);
  textNode(document.querySelector('label[for="confirmPasswordInput"]'), text.confirmPassword);
  textNode($('saveNewPassword'), text.updatePassword);
  const resetLabel = $('resetEmailInput')?.previousElementSibling;
  if (resetLabel) resetLabel.textContent = text.resetEmail;
  const passwordToggle = $('togglePassword');
  if (passwordToggle) {
    const visible = $('passwordInput').type === 'text';
    const label = visible ? text.passwordShown : text.passwordHidden;
    passwordToggle.setAttribute('aria-label', label);
    passwordToggle.setAttribute('title', label);
  }

  const labels = document.querySelectorAll('.settings-label');
  if (labels[0]) labels[0].textContent = text.appearance;
  if (labels[1]) labels[1].textContent = `${text.language} / Wika`;

  const rows = document.querySelectorAll('.setting-row');
  if (rows[0]) {
    rows[0].querySelector('b').textContent = text.theme;
    rows[0].querySelector('small').textContent = text.themeHint;
  }
  if (rows[1]) {
    rows[1].querySelector('b').textContent = text.language;
    rows[1].querySelector('small').textContent = text.languageHint;
  }

  const themeButtons = document.querySelectorAll('#themeControl button');
  themeButtons.forEach(button => {
    const isLight = button.dataset.theme === 'light';
    const label = isLight ? text.light : text.dark;
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.setAttribute('aria-pressed', button.dataset.theme === currentTheme ? 'true' : 'false');
  });

  const languageButtons = document.querySelectorAll('#languageControl button');
  if (languageButtons[0]) languageButtons[0].textContent = text.english;
  if (languageButtons[1]) languageButtons[1].textContent = text.filipino;

  const kicker = document.querySelector('.settings-head .panel-kicker');
  if (kicker) kicker.textContent = text.preferences;

  const note = document.querySelector('.settings-note span');
  if (note) note.textContent = text.note;

  document.documentElement.lang = currentLang === 'fil' ? 'fil' : 'en';
  languageButtons.forEach(button => {
    button.classList.toggle('active', button.dataset.lang === currentLang);
    button.setAttribute('aria-pressed', button.dataset.lang === currentLang ? 'true' : 'false');
  });
}

function openProfile() {
  $('profileMenu').classList.remove('hidden');
}

function closeProfile() {
  $('profileMenu').classList.add('hidden');
}

function openSettings() {
  closeProfile();
  $('settingsPanel').classList.remove('hidden');
  applyTheme();
  applyLanguage();
}

function closeSettings() {
  $('settingsPanel').classList.add('hidden');
}

function openLogout() {
  closeProfile();
  applyLanguage();
  $('logoutModal').classList.remove('hidden');
}

function closeLogout() {
  $('logoutModal').classList.add('hidden');
}

async function confirmLogout() {
  closeLogout();
  await logout();
  toast(currentLang === 'fil' ? 'Na-sign out ka.' : 'You have been signed out.');
}

function setTheme(theme) {
  currentTheme = theme;
  localStorage.setItem('ses-theme', theme);
  applyTheme();
  toast(theme === 'dark' ? 'Dark mode enabled.' : 'Light mode enabled.');
}

function setLanguage(language) {
  currentLang = language;
  localStorage.setItem('ses-lang', language);
  applyLanguage();
  toast(language === 'fil' ? 'Filipino labels enabled.' : 'English labels enabled.');
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
  $('logoutBtn').addEventListener('click', logout);
  $('refreshBtn').addEventListener('click', async () => {
    await loadData();
    toast('Information refreshed.');
  });
  document.querySelectorAll('.nav-item').forEach(button => {
    button.addEventListener('click', () => go(button.dataset.section));
  });
  document.querySelectorAll('[data-section-jump]').forEach(button => {
    button.addEventListener('click', () => go(button.dataset.sectionJump));
  });
  $('eventSearch').addEventListener('input', renderEvents);
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
  $('clearFilterBtn').addEventListener('click', () => {
    $('eventSearch').value = '';
    setSeverity('all');
  });
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
  $('addAccessBtn').addEventListener('click', addAccess);
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
  $('settingsBtn').addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    openSettings();
  });
  $('profileLogoutBtn').addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    openLogout();
  });
  $('closeSettings').addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    closeSettings();
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
  document.querySelectorAll('#languageControl button').forEach(button => {
    button.addEventListener('click', () => setLanguage(button.dataset.lang));
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeProfile();
      closeSettings();
      closeLogout();
      closeReset();
      closeUpdatePassword();
    }
  });
  document.addEventListener('click', event => {
    if (!$('profileMenu').contains(event.target) && event.target !== $('profileBtn')) closeProfile();
  });
  $('settingsPanel').addEventListener('click', event => {
    if (event.target === $('settingsPanel')) closeSettings();
  });
  applyTheme();
  applyLanguage();
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

