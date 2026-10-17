const $=id=>document.getElementById(id);
let supabaseClient=null,deferredInstallPrompt=null,state={events:[],locations:[],device:{},latestLocation:null,map:null,miniMap:null};
const accessDemo=[{email:'family@example.com',role:'Primary caregiver',status:'Active'},{email:'relative@example.com',role:'Family member',status:'Active'}];
const demo={
  device:{id:'SMART-EYEGLASSES-01',status:'Connected',updated_at:new Date().toISOString()},
  // Demo telemetry is intentionally placed around Legazpi City, Albay.
  location:{latitude:13.1392,longitude:123.7439,accuracy:5,created_at:new Date().toISOString()},
  events:[
    {id:'1',direction:'Center',distance:1.2,severity:'High',voice_command:'Obstacle ahead. Please proceed carefully.',created_at:new Date(Date.now()-2*60000).toISOString(),latitude:13.1392,longitude:123.7439},
    {id:'2',direction:'Left',distance:1.5,severity:'Medium',voice_command:'Obstacle on the left.',created_at:new Date(Date.now()-9*60000).toISOString(),latitude:13.1390,longitude:123.7444},
    {id:'3',direction:'Right',distance:2.1,severity:'Low',voice_command:'Obstacle on the right.',created_at:new Date(Date.now()-17*60000).toISOString(),latitude:13.1387,longitude:123.7448},
    {id:'4',direction:'Center',distance:1.8,severity:'Medium',voice_command:'Please proceed carefully.',created_at:new Date(Date.now()-26*60000).toISOString(),latitude:13.1384,longitude:123.7443},
    {id:'5',direction:'Left',distance:0.9,severity:'High',voice_command:'Obstacle very close on the left.',created_at:new Date(Date.now()-38*60000).toISOString(),latitude:13.1381,longitude:123.7438},
    {id:'6',direction:'Right',distance:2.6,severity:'Low',voice_command:'Obstacle on the right.',created_at:new Date(Date.now()-51*60000).toISOString(),latitude:13.1378,longitude:123.7432}
  ]
};
const route=[
  [13.1376,123.7427],[13.1379,123.7432],[13.1381,123.7438],[13.1384,123.7443],
  [13.1387,123.7448],[13.1390,123.7444],[13.1392,123.7439]
];
demo.locations=route.slice().reverse().map((coords,i)=>({
  ...demo.location,
  latitude:coords[0],
  longitude:coords[1],
  accuracy:4+i%3,
  created_at:new Date(Date.now()-i*7*60000).toISOString()
}));
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function fmtAgo(iso){const s=Math.max(0,Math.floor((Date.now()-new Date(iso))/1000));if(s<10)return'just now';if(s<60)return`${s}s ago`;const m=Math.floor(s/60);if(m<60)return`${m} min ago`;const h=Math.floor(m/60);if(h<24)return`${h} hr ago`;return`${Math.floor(h/24)}d ago`}
function fmtDate(iso){return new Date(iso).toLocaleString('en-PH',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}
function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');clearTimeout(window._toast);window._toast=setTimeout(()=>$('toast').classList.remove('show'),2600)}
function showApp(){$('loginView').classList.add('hidden');$('appView').classList.remove('hidden');go('overview');}
function showLogin(){$('appView').classList.add('hidden');$('loginView').classList.remove('hidden')}
function go(section){document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.section===section));document.querySelectorAll('.page-section').forEach(x=>x.classList.toggle('active-section',x.id===section));const titles={overview:'Home',location:'Location',events:'Alerts',devices:'Smart Glasses',access:'Family Access'};$('pageTitle').textContent=titles[section]||'Home';if(section==='overview')setTimeout(()=>initMap(false),80);if(section==='location')setTimeout(()=>initMap(true),80)}
function severityClass(s){return String(s).toLowerCase()}
function recordTime(row){return row?.timestamp||row?.created_at||new Date().toISOString()}
function uiDirection(value){const v=String(value||'center').toLowerCase();return v==='center'?'Center':v==='left'?'Left':v==='right'?'Right':'Multiple'}
function uiSeverity(value){const v=String(value||'warning').toLowerCase();return v==='danger'?'High':v==='warning'?'Medium':v==='low'?'Low':'Medium'}
function uiDistanceMeters(row){if(row?.distance_cm!=null)return Number(row.distance_cm)/100;return Number(row?.distance??0)}

function renderRecent(){const list=state.events.slice(0,5);$('recentEvents').innerHTML=list.map(e=>{const d=uiDirection(e.direction),sev=uiSeverity(e.severity),time=recordTime(e),dist=uiDistanceMeters(e);return `<div class="event-item"><div class="event-icon"><iconify-icon icon="solar:danger-triangle-linear"></iconify-icon></div><div><b>${esc(d==='Center'?'Obstacle ahead':`Obstacle on the ${d.toLowerCase()}`)}</b><span>${dist.toFixed(1)} m · ${fmtAgo(time)}</span></div><small class="severity ${severityClass(sev)}">${sev==='High'?'More urgent':sev==='Medium'?'Moderate':'Less urgent'}</small></div>`}).join('')||'<div class="empty">No alerts recorded.</div>'}
function renderStats(){const l=state.latestLocation||demo.location;const updated=recordTime(l);$('todayEvents').textContent=state.events.length;$('alertsTotal').textContent=state.events.length;$('eventTrend').textContent=state.events[0]?`Latest alert ${fmtAgo(recordTime(state.events[0]))}`:'No alerts today';$('latestAlertText').textContent=state.events[0]?fmtAgo(recordTime(state.events[0])):'None';$('locationAgo').textContent=fmtAgo(updated);$('miniLocationTime').textContent=fmtAgo(updated);$('deviceStatus').textContent=state.device.status||'Connected';$('deviceStatusMeta').textContent=`Last update ${fmtAgo(state.device.updated_at||updated)}`;$('relativeStatus').textContent=`${state.device.status||'Connected'} · updated ${fmtAgo(state.device.updated_at||updated)}`;$('locationTime').textContent=fmtDate(updated);$('locationUpdated').textContent=fmtAgo(updated);$('locationAccuracy').textContent=`About ${l.accuracy??5} m`;$('detailLat').textContent=`${Number(l.latitude).toFixed(5)}° N`;$('detailLng').textContent=`${Number(l.longitude).toFixed(5)}° E`;$('locationDevice').textContent="Maria's glasses";$('accessDeviceName').textContent="Maria's glasses"}
function renderEvents(){const q=($('eventSearch').value||'').toLowerCase();const sev=$('severityFilter').value;const rows=state.events.filter(e=>{const u=uiSeverity(e.severity);return(sev==='all'||u===sev)&&[uiDirection(e.direction),e.voice_command||'',u].join(' ').toLowerCase().includes(q)});$('eventsTable').innerHTML=`<table class="data-table"><thead><tr><th>WHEN</th><th>ALERT</th><th>DISTANCE</th><th>URGENCY</th><th>VOICE GUIDANCE</th></tr></thead><tbody>${rows.map(e=>{const d=uiDirection(e.direction),u=uiSeverity(e.severity),dist=uiDistanceMeters(e);return `<tr><td>${esc(fmtDate(recordTime(e)))}</td><td><b>${esc(d==='Center'?'Obstacle ahead':`Obstacle on the ${d.toLowerCase()}`)}</b></td><td>${dist.toFixed(1)} m</td><td><span class="severity ${severityClass(u)}">${u==='High'?'More urgent':u==='Medium'?'Moderate':'Less urgent'}</span></td><td>${esc(e.voice_command||'Obstacle detected')}</td></tr>`}).join('')||'<tr><td colspan="5">No alerts match your search.</td></tr>'}</tbody></table>`}
function renderLocations(){$('locationHistory').innerHTML=`<table class="data-table"><thead><tr><th>WHEN</th><th>LOCATION</th><th>ACCURACY</th></tr></thead><tbody>${state.locations.slice(0,10).map(l=>`<tr><td>${esc(fmtDate(recordTime(l)))}</td><td>${Number(l.latitude).toFixed(5)}, ${Number(l.longitude).toFixed(5)}</td><td>About ${l.accuracy??5} m</td></tr>`).join('')||'<tr><td colspan="3">No location history available.</td></tr>'}</tbody></table>`}
function renderDevices(){$('deviceCards').innerHTML=`<div class="device-card"><div class="device-top"><div><div class="device-id">Maria's Smart Glasses</div><div class="device-type">Last reported ${fmtAgo(state.device.updated_at||new Date().toISOString())}</div></div><div class="device-status"><span class="status-dot"></span>${esc(state.device.status||'Connected')}</div></div><div class="device-specs"><div><span>Location</span><b>Available</b></div><div><span>Obstacle alerts</span><b>Active</b></div><div><span>Audio guidance</span><b>Connected</b></div><div><span>Update</span><b>${fmtAgo(state.device.updated_at||new Date().toISOString())}</b></div><div><span>Device ID</span><b>${esc(state.device.id||'SMART-EYEGLASSES-01')}</b></div><div><span>Area</span><b>Legazpi City, Albay</b></div></div></div>`;$('technicalConnection').textContent=state.device.status||'Connected'}
function renderAccess(){$('accessCount').textContent=accessDemo.length;$('accessTable').innerHTML=`<table class="data-table"><thead><tr><th>PERSON</th><th>ROLE</th><th>STATUS</th><th></th></tr></thead><tbody>${accessDemo.map((a,i)=>`<tr><td><b>${esc(a.email)}</b></td><td>${esc(a.role)}</td><td><span class="severity low">${esc(a.status)}</span></td><td><button class="text-btn" onclick="removeAccess(${i})">Remove</button></td></tr>`).join('')}</tbody></table>`}
window.removeAccess=i=>{accessDemo.splice(i,1);renderAccess();toast('Family member removed from this demo.');}
function initMap(main=false){
  if(!window.L)return;
  const el=main?'mainMap':'miniMap';
  const current=state.latestLocation||demo.location;
  const existing=main?state.map:state.miniMap;
  if(existing){existing.setView([current.latitude,current.longitude],16);return}
  const m=L.map(el,{zoomControl:main}).setView([current.latitude,current.longitude],16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(m);

  const history=(state.locations.length?state.locations:demo.locations).slice().reverse().map(l=>[Number(l.latitude),Number(l.longitude)]);
  if(history.length>1){
    L.polyline(history,{color:'#55b993',weight:4,opacity:.72,dashArray:main?'':'6 8'}).addTo(m);
  }

  const latest=L.circleMarker([current.latitude,current.longitude],{radius:10,color:'#0f2c24',weight:3,fillColor:'#66d1a7',fillOpacity:1}).addTo(m);
  latest.bindPopup("<b>Maria's Smart Glasses</b><br>Latest demo location · Legazpi City, Albay").openPopup();

  if(main){
    const events=state.events.length?state.events:demo.events;
    events.slice(0,6).forEach((e,i)=>{
      if(e.latitude==null||e.longitude==null)return;
      const sev=uiSeverity(e.severity), dist=uiDistanceMeters(e);
      L.circleMarker([e.latitude,e.longitude],{radius:6,color:'#562f2b',weight:2,fillColor:sev==='High'?'#e97b70':sev==='Medium'?'#e7b56d':'#6bc7a1',fillOpacity:.95})
        .addTo(m)
        .bindPopup(`<b>Obstacle detected</b><br>${esc(uiDirection(e.direction))} · ${dist.toFixed(1)} m<br><small>${fmtAgo(recordTime(e))}</small>`);
    });
  }
  if(main)state.map=m;else state.miniMap=m;
}
function refreshMaps(){const l=state.latestLocation||demo.location;if(state.map)state.map.setView([l.latitude,l.longitude],16);if(state.miniMap)state.miniMap.setView([l.latitude,l.longitude],16)}
async function loadData(){if(!supabaseClient){state.events=[...demo.events];state.locations=[...demo.locations];state.device={...demo.device};state.latestLocation=demo.location;$('connectionLabel').textContent='Demo mode';$('connectionSub').textContent='Sample data'}else{try{const {data:dev}=await supabaseClient.from('devices').select('*').order('created_at',{ascending:true}).limit(1).single();if(dev)state.device=dev;const {data:events}=await supabaseClient.from('obstacle_events').select('*').order('timestamp',{ascending:false}).limit(100);state.events=events||[];const {data:locs}=await supabaseClient.from('locations').select('*').order('timestamp',{ascending:false}).limit(50);state.locations=locs||[];state.latestLocation=state.locations[0]||demo.location;$('connectionLabel').textContent='Live data';$('connectionSub').textContent='Supabase connected';if(supabaseClient.channel){supabaseClient.channel('dashboard-live').on('postgres_changes',{event:'INSERT',schema:'public',table:'obstacle_events'},p=>{state.events.unshift(p.new);renderAll();toast('New obstacle alert received.');}).on('postgres_changes',{event:'INSERT',schema:'public',table:'locations'},p=>{state.locations.unshift(p.new);state.latestLocation=p.new;renderAll();toast('Location updated.');}).subscribe()}}catch(err){console.error(err);toast('Could not load live data. Showing demo data.');state.events=[...demo.events];state.locations=[...demo.locations];state.latestLocation=demo.location}}renderAll()}
function renderAll(){renderStats();renderRecent();renderEvents();renderLocations();renderDevices();renderAccess();refreshMaps();$('lastSync').textContent=`Updated ${new Date().toLocaleTimeString('en-PH',{hour:'numeric',minute:'2-digit'})}`}
async function login(e){e.preventDefault();if(!supabaseClient){showApp();await loadData();toast('Demo dashboard opened.');return}const {error}=await supabaseClient.auth.signInWithPassword({email:$('emailInput').value,password:$('passwordInput').value});if(error){toast(error.message);return}showApp();await loadData()}
async function logout(){if(supabaseClient)await supabaseClient.auth.signOut();showLogin()}
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();
  deferredInstallPrompt=e;
  $('installBtn')?.classList.remove('hidden');
});
window.addEventListener('appinstalled',()=>{
  deferredInstallPrompt=null;
  $('installBtn')?.classList.add('hidden');
  toast('Smart Eyeglasses was installed.');
});
async function installApp(){
  if(!deferredInstallPrompt){toast('Use your browser menu and choose Install app or Add to Home screen.');return}
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt=null;
  $('installBtn')?.classList.add('hidden');
}

function bind(){ $('loginForm').addEventListener('submit',login);$('demoBtn').addEventListener('click',async()=>{showApp();await loadData()});$('logoutBtn').addEventListener('click',logout);$('refreshBtn').addEventListener('click',async()=>{await loadData();toast('Information refreshed.')});document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>go(b.dataset.section)));document.querySelectorAll('[data-section-jump]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.sectionJump)));$('eventSearch').addEventListener('input',renderEvents);$('severityFilter').addEventListener('change',renderEvents);$('clearFilterBtn').addEventListener('click',()=>{$('eventSearch').value='';$('severityFilter').value='all';renderEvents()});$('openMapsBtn').addEventListener('click',()=>{const l=state.latestLocation||demo.location;window.open(`https://www.google.com/maps?q=${l.latitude},${l.longitude}`,'_blank')});$('homeMapsBtn').addEventListener('click',()=>{const l=state.latestLocation||demo.location;window.open(`https://www.google.com/maps?q=${l.latitude},${l.longitude}`,'_blank')});$('showCoordinatesBtn').addEventListener('click',()=>{$('coordinatesBox').classList.toggle('hidden');$('showCoordinatesBtn').textContent=$('coordinatesBox').classList.contains('hidden')?'Show exact coordinates':'Hide exact coordinates'});$('technicalToggle').addEventListener('click',()=>{const hidden=$('technicalDetails').classList.toggle('hidden');$('technicalToggle').textContent=hidden?'Show details':'Hide details'});$('addAccessBtn').addEventListener('click',()=>{const email=prompt('Enter the family member or caregiver email:');if(!email)return;accessDemo.push({email,role:'Family member',status:'Active'});renderAccess();toast('Family member added to this demo.')})}


/* =========================================================
   PROFILE, THEME + LANGUAGE PREFERENCES
   ========================================================= */
const i18n={
  en:{navHome:'Home',navLocation:'Location',navAlerts:'Alerts',navGlasses:'Smart Glasses',navFamily:'Family Access',pageHome:'Home',pageLocation:'Location',pageAlerts:'Alerts',pageGlasses:'Smart Glasses',pageFamily:'Family Access',settings:'Settings',install:'Install app',signout:'Sign out',signoutTitle:'Sign out?',signoutMessage:'Are you sure you want to sign out of the caregiver dashboard?',cancel:'Cancel',appearance:'Appearance',theme:'Theme',themeHint:'Choose how the dashboard looks.',light:'Light',dark:'Dark',language:'Language',languageHint:'English or Filipino.',english:'English',filipino:'Filipino',preferences:'PREFERENCES',note:'Language changes the caregiver-facing labels and controls. Device technical terms stay in their original names.'},
  fil:{navHome:'Home',navLocation:'Lokasyon',navAlerts:'Mga Alerto',navGlasses:'Smart Glasses',navFamily:'Access ng Pamilya',pageHome:'Home',pageLocation:'Lokasyon',pageAlerts:'Mga Alerto',pageGlasses:'Smart Glasses',pageFamily:'Access ng Pamilya',settings:'Settings',install:'I-install ang app',signout:'Mag-sign out',signoutTitle:'Mag-sign out?',signoutMessage:'Sigurado ka bang gusto mong mag-sign out sa caregiver dashboard?',cancel:'Kanselahin',appearance:'Itsura',theme:'Theme',themeHint:'Piliin kung paano ipapakita ang dashboard.',light:'Light',dark:'Dark',language:'Wika',languageHint:'English o Filipino.',english:'English',filipino:'Filipino',preferences:'MGA SETTING',note:'Binabago ng wika ang mga label at controls para sa caregiver. Hindi isinasalin ang technical terms ng device.'}
};
let currentLang=localStorage.getItem('ses-lang')||'en';
let currentTheme=localStorage.getItem('ses-theme')||'light';
function textNode(el,text){if(!el)return;const node=[...el.childNodes].find(n=>n.nodeType===3&&n.textContent.trim());if(node)node.textContent=' '+text;else el.textContent=text}
function applyTheme(){document.body.classList.toggle('dark-mode',currentTheme==='dark');document.querySelectorAll('#themeControl button').forEach(b=>b.classList.toggle('active',b.dataset.theme===currentTheme))}
function applyLanguage(){const t=i18n[currentLang];
  const nav=document.querySelectorAll('.nav-item');
  if(nav[0])textNode(nav[0],t.navHome); if(nav[1])textNode(nav[1],t.navLocation); if(nav[2])textNode(nav[2],t.navAlerts); if(nav[3])textNode(nav[3],t.navGlasses); if(nav[4])textNode(nav[4],t.navFamily);
  const titleMap={overview:t.pageHome,location:t.pageLocation,events:t.pageAlerts,devices:t.pageGlasses,access:t.pageFamily};
  const active=document.querySelector('.nav-item.active'); if(active)$('pageTitle').textContent=titleMap[active.dataset.section]||t.pageHome;
  textNode($('settingsBtn'),t.settings); textNode($('installBtn'),t.install); textNode($('profileLogoutBtn'),t.signout); textNode($('logoutTitle'),t.signoutTitle); textNode($('logoutMessage'),t.signoutMessage); textNode($('cancelLogout'),t.cancel); textNode($('confirmLogout'),t.signout);
  const labels=document.querySelectorAll('.settings-label'); if(labels[0])labels[0].textContent=t.appearance; if(labels[1])labels[1].textContent=t.language+' / Wika';
  const rows=document.querySelectorAll('.setting-row');
  if(rows[0]){rows[0].querySelector('b').textContent=t.theme;rows[0].querySelector('small').textContent=t.themeHint}
  if(rows[1]){rows[1].querySelector('b').textContent=t.language;rows[1].querySelector('small').textContent=t.languageHint}
  const th= document.querySelectorAll('#themeControl button'); if(th[0])th[0].textContent=t.light;if(th[1])th[1].textContent=t.dark;
  const lg=document.querySelectorAll('#languageControl button');if(lg[0])lg[0].textContent=t.english;if(lg[1])lg[1].textContent=t.filipino;
  const pk=document.querySelector('.settings-head .panel-kicker');if(pk)pk.textContent=t.preferences;
  $('settingsNote')?.remove();
  const note=document.querySelector('.settings-note span');if(note)note.textContent=t.note;
  document.documentElement.lang=currentLang==='fil'?'fil':'en';
  document.querySelectorAll('#languageControl button').forEach(b=>b.classList.toggle('active',b.dataset.lang===currentLang));
}
function openProfile(){ $('profileMenu').classList.remove('hidden'); }
function closeProfile(){ $('profileMenu').classList.add('hidden'); }
function openSettings(){ closeProfile(); $('settingsPanel').classList.remove('hidden'); applyTheme(); applyLanguage(); }
function closeSettings(){ $('settingsPanel').classList.add('hidden'); }
function openLogout(){ closeProfile(); applyLanguage(); $('logoutModal').classList.remove('hidden'); }
function closeLogout(){ $('logoutModal').classList.add('hidden'); }
async function confirmLogout(){ closeLogout(); if(supabaseClient) await supabaseClient.auth.signOut(); showLogin(); toast(currentLang==='fil'?'Na-sign out ka.':'You have been signed out.'); }
function setTheme(theme){currentTheme=theme;localStorage.setItem('ses-theme',theme);applyTheme();toast(theme==='dark'?'Dark mode enabled.':'Light mode enabled.')}
function setLanguage(lang){currentLang=lang;localStorage.setItem('ses-lang',lang);applyLanguage();toast(lang==='fil'?'Filipino labels enabled.':'English labels enabled.')}

/* Patch navigation so its page title follows the selected language. */
const originalGo=go;
go=function(section){originalGo(section);const t=i18n[currentLang];const titles={overview:t.pageHome,location:t.pageLocation,events:t.pageAlerts,devices:t.pageGlasses,access:t.pageFamily};$('pageTitle').textContent=titles[section]||t.pageHome};

/* Extend the existing binding without disturbing Supabase/demo behavior. */
const _bind=bind;
bind=function(){_bind();
  $('profileBtn').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openProfile()});
  $('installBtn')?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();installApp()});
  $('settingsBtn').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openSettings()});
  $('profileLogoutBtn').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openLogout()});
  $('closeSettings').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();closeSettings()});
  $('cancelLogout').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();closeLogout()});
  $('confirmLogout').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();confirmLogout()});
  $('logoutModal').addEventListener('click',e=>{if(e.target===$('logoutModal'))closeLogout()});
  document.querySelectorAll('#themeControl button').forEach(b=>b.addEventListener('click',()=>setTheme(b.dataset.theme)));
  document.querySelectorAll('#languageControl button').forEach(b=>b.addEventListener('click',()=>setLanguage(b.dataset.lang)));
  document.addEventListener('click',e=>{if(!$('profileMenu').contains(e.target)&&e.target!==$('profileBtn'))closeProfile()});
  $('settingsPanel').addEventListener('click',e=>{if(e.target===$('settingsPanel'))closeSettings()});
  applyTheme();applyLanguage();
};
(async function(){bind();if(window.supabase&&window.SUPABASE_URL&&window.SUPABASE_ANON_KEY){supabaseClient=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);const {data}=await supabaseClient.auth.getSession();if(data.session){showApp();await loadData()}}})();
