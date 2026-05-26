// Navigation
document.querySelectorAll('.nav-item[data-tab]').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.nav-item').forEach(function(b) { b.classList.remove('active'); });
    document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});
document.querySelector('[data-tab="nutzer"]').addEventListener('click', function() {
  loadAdvertisers(); loadPublishers();
}, { once: true });
document.querySelector('[data-tab="anzeigen"]').addEventListener('click', function() {
  loadAds();
}, { once: true });
document.querySelector('[data-tab="alle-nutzer"]').addEventListener('click', function() {
  loadUsers();
}, { once: true });

function fmt(n) { return Number(n).toLocaleString('de-DE'); }
function pct(a, b) { if (!b || b == 0) return '0 %'; return (a / b * 100).toFixed(1) + ' %'; }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

async function loadStats() {
  var res = await api.getStats();
  var errEl = document.getElementById('stat-error');
  if (res.error) {
    document.getElementById('db-dot').classList.add('red');
    errEl.style.display = 'block';
    errEl.textContent = 'DB-Fehler: ' + res.error;
    return;
  }
  document.getElementById('db-dot').classList.remove('red');
  errEl.style.display = 'none';
  document.getElementById('stat-users').textContent   = fmt(res.users);
  document.getElementById('stat-adv').textContent     = fmt(res.advertisers);
  document.getElementById('stat-pub').textContent     = fmt(res.publishers);
  document.getElementById('stat-imp').textContent     = fmt(res.impressions);
  document.getElementById('stat-clicks').textContent  = fmt(res.clicks);
  document.getElementById('stat-revenue').textContent = res.revenue != null ? res.revenue.toFixed(2) + ' EUR' : '-';
}

async function checkHealth() {
  function setBadge(id, state) {
    var el = document.getElementById(id);
    el.textContent = state === 'ok' ? 'Online' : state === 'loading' ? '...' : 'Offline';
    el.className = 'badge ' + (state === 'ok' ? 'green' : state === 'loading' ? 'gray' : 'red');
  }
  setBadge('health-local', 'loading');
  setBadge('health-prod',  'loading');
  var r = await Promise.allSettled([
    api.healthCheck('http://localhost:3000'),
    api.healthCheck('https://grand-integrity-production-7a3c.up.railway.app'),
  ]);
  setBadge('health-local', r[0].value && r[0].value.ok ? 'ok' : 'err');
  setBadge('health-prod',  r[1].value && r[1].value.ok ? 'ok' : 'err');
}

async function loadAdvertisers() {
  var tbody = document.getElementById('adv-table-body');
  tbody.innerHTML = '<tr><td colspan="7" class="empty">Lade...</td></tr>';
  var res = await api.getAdvertisers();
  if (res.error) { tbody.innerHTML = '<tr><td colspan="7" class="empty" style="color:var(--red)">' + esc(res.error) + '</td></tr>'; return; }
  if (!res.rows.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">Keine Werbetreibenden.</td></tr>'; return; }
  var html = '';
  res.rows.forEach(function(r) {
    html += '<tr>';
    html += '<td><strong>' + esc(r.company_name) + '</strong></td>';
    html += '<td style="color:var(--muted);font-size:0.8rem">' + esc(r.email) + '</td>';
    html += '<td>' + esc(r.postal_code) + '</td>';
    html += '<td><span class="badge ' + (r.plan === 'premium' ? 'green' : 'gray') + '">' + esc(r.plan) + '</span></td>';
    html += '<td>' + fmt(r.ad_count) + '</td>';
    html += '<td><span class="badge ' + (r.is_active ? 'green' : 'red') + '">' + (r.is_active ? 'Aktiv' : 'Inaktiv') + '</span></td>';
    html += '<td><button class="btn btn-sm ' + (r.is_active ? 'btn-red' : 'btn-green') + '" onclick="toggleAdvertiser(\'' + r.id + '\',' + !r.is_active + ')">' + (r.is_active ? 'Deaktivieren' : 'Aktivieren') + '</button></td>';
    html += '</tr>';
  });
  tbody.innerHTML = html;
}

async function toggleAdvertiser(id, active) {
  var res = await api.toggleAdvertiser(id, active);
  if (res.error) { alert('Fehler: ' + res.error); return; }
  loadAdvertisers(); loadStats();
}

async function loadPublishers() {
  var tbody = document.getElementById('pub-table-body');
  tbody.innerHTML = '<tr><td colspan="6" class="empty">Lade...</td></tr>';
  var res = await api.getPublishers();
  if (res.error) { tbody.innerHTML = '<tr><td colspan="6" class="empty" style="color:var(--red)">' + esc(res.error) + '</td></tr>'; return; }
  if (!res.rows.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">Keine Publisher.</td></tr>'; return; }
  var html = '';
  res.rows.forEach(function(r) {
    html += '<tr>';
    html += '<td><strong>' + esc(r.domain) + '</strong></td>';
    html += '<td style="color:var(--muted);font-size:0.8rem">' + esc(r.email) + '</td>';
    html += '<td><span class="badge gray">' + esc(r.verification_method || '-') + '</span></td>';
    html += '<td>' + esc(r.revenue_share_pct || 70) + ' %</td>';
    html += '<td><span class="badge ' + (r.is_verified ? 'green' : 'red') + '">' + (r.is_verified ? 'Verifiziert' : 'Ausstehend') + '</span></td>';
    html += '<td><button class="btn btn-sm ' + (r.is_verified ? 'btn-red' : 'btn-green') + '" onclick="togglePublisher(\'' + r.id + '\',' + !r.is_verified + ')">' + (r.is_verified ? 'Sperren' : 'Freigeben') + '</button></td>';
    html += '</tr>';
  });
  tbody.innerHTML = html;
}

async function togglePublisher(id, verified) {
  var res = await api.togglePublisher(id, verified);
  if (res.error) { alert('Fehler: ' + res.error); return; }
  loadPublishers(); loadStats();
}

async function loadAds() {
  var tbody = document.getElementById('ads-table-body');
  tbody.innerHTML = '<tr><td colspan="8" class="empty">Lade...</td></tr>';
  var res = await api.getAds();
  if (res.error) { tbody.innerHTML = '<tr><td colspan="8" class="empty" style="color:var(--red)">' + esc(res.error) + '</td></tr>'; return; }
  if (!res.rows.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty">Keine Anzeigen.</td></tr>'; return; }
  var html = '';
  res.rows.forEach(function(r) {
    html += '<tr>';
    html += '<td><strong>' + esc(r.title) + '</strong></td>';
    html += '<td style="color:var(--muted);font-size:0.8rem">' + esc(r.company_name) + '</td>';
    html += '<td>' + esc(r.postal_code) + '</td>';
    html += '<td>' + fmt(r.impressions) + '</td>';
    html += '<td>' + fmt(r.clicks) + '</td>';
    html += '<td style="color:var(--muted)">' + pct(r.clicks, r.impressions) + '</td>';
    html += '<td><span class="badge ' + (r.is_active ? 'green' : 'red') + '">' + (r.is_active ? 'Aktiv' : 'Inaktiv') + '</span></td>';
    html += '<td><button class="btn btn-sm ' + (r.is_active ? 'btn-red' : 'btn-green') + '" onclick="toggleAd(\'' + r.id + '\',' + !r.is_active + ')">' + (r.is_active ? 'Deaktivieren' : 'Aktivieren') + '</button></td>';
    html += '</tr>';
  });
  tbody.innerHTML = html;
}

async function toggleAd(id, active) {
  var res = await api.toggleAd(id, active);
  if (res.error) { alert('Fehler: ' + res.error); return; }
  loadAds();
}

var _usersCache = [];

async function loadUsers() {
  var tbody = document.getElementById('users-table-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" class="empty">Lade...</td></tr>';
  var res = await api.getUsers();
  if (res.error) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty" style="color:var(--red)">' + esc(res.error) + '</td></tr>';
    return;
  }
  _usersCache = res.rows || [];
  renderUsers(_usersCache);
}

function renderUsers(rows) {
  var tbody = document.getElementById('users-table-body');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">Keine Nutzer gefunden.</td></tr>';
    return;
  }
  var html = '';
  rows.forEach(function(r) {
    var endDate = r.subscription_end ? new Date(r.subscription_end).toLocaleDateString('de-DE') : '-';
    var regDate = new Date(r.created_at).toLocaleDateString('de-DE');
    html += '<tr>';
    html += '<td>' + esc(r.email) + '</td>';
    html += '<td>' + esc(r.postal_code || '-') + '</td>';
    html += '<td><span class="badge ' + (r.is_subscribed ? 'green' : 'gray') + '">' + (r.is_subscribed ? 'Aktiv' : 'Kein Abo') + '</span></td>';
    html += '<td>' + endDate + '</td>';
    html += '<td style="color:var(--muted);font-size:0.8rem">' + regDate + '</td>';
    html += '</tr>';
  });
  tbody.innerHTML = html;
}

function filterUsers() {
  var q = document.getElementById('user-search').value.toLowerCase();
  if (!q) { renderUsers(_usersCache); return; }
  renderUsers(_usersCache.filter(function(r) {
    return (r.email || '').toLowerCase().includes(q) || (r.postal_code || '').includes(q);
  }));
}

function setBackendUI(running) {
  var dot   = document.getElementById('backend-dot');
  var text  = document.getElementById('backend-status-text');
  var start = document.getElementById('btn-start');
  var stop  = document.getElementById('btn-stop');
  if (running) {
    dot.classList.add('on');
    text.textContent = 'Backend laeuft';
    start.disabled = true;
    stop.disabled  = false;
  } else {
    dot.classList.remove('on');
    text.textContent = 'Backend gestoppt';
    start.disabled = false;
    stop.disabled  = true;
  }
}

async function startBackend() {
  document.getElementById('btn-start').disabled = true;
  appendLog('[SYS] Starte Backend...');
  var res = await api.startBackend();
  if (res.ok) {
    setBackendUI(true);
    setTimeout(loadStats, 2000);
  } else {
    document.getElementById('btn-start').disabled = false;
    appendLog('[ERR] ' + (res.error || 'Start fehlgeschlagen'));
  }
}

async function stopBackend() {
  var res = await api.stopBackend();
  if (res.ok) setBackendUI(false);
}

function appendLog(msg) {
  var box  = document.getElementById('log-box');
  var line = document.createElement('div');
  var isErr = msg.indexOf('[ERR]') === 0;
  var isSys = msg.indexOf('[SYS]') === 0;
  line.className = 'log-line' + (isErr ? ' log-err' : '');
  if (isSys) line.style.color = 'var(--muted)';
  var ts = new Date().toLocaleTimeString('de-DE', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
  line.textContent = '[' + ts + '] ' + msg;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

api.onBackendLog(function(msg) { appendLog(msg); });
api.onBackendStatus(function(running) { setBackendUI(running); });

(async function init() {
  var status = await api.backendRunning();
  setBackendUI(status.running);
  await Promise.all([loadStats(), checkHealth()]);
  setInterval(loadStats, 30000);
})();
