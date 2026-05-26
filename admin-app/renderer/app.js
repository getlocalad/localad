// ── Navigation ────────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n) { return Number(n).toLocaleString('de-DE'); }
function dateStr(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function escape(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ── Stats ─────────────────────────────────────────────────────────────────────
async function loadStats() {
  const res = await api.getStats();
  if (res.error) {
    document.getElementById('db-dot').classList.add('red');
    return;
  }
  document.getElementById('db-dot').classList.remove('red');
  document.getElementById('stat-users').textContent   = fmt(res.users);
  document.getElementById('stat-adv').textContent     = fmt(res.advertisers);
  document.getElementById('stat-pub').textContent     = fmt(res.publishers);
  document.getElementById('stat-imp').textContent     = fmt(res.impressions);
  document.getElementById('stat-clicks').textContent  = fmt(res.clicks);
}

// ── Health ────────────────────────────────────────────────────────────────────
async function checkHealth() {
  const setBadge = (id, state) => {
    const el = document.getElementById(id);
    el.textContent = state === 'ok' ? 'Online' : state === 'loading' ? '…' : 'Offline';
    el.className = 'badge ' + (state === 'ok' ? 'green' : state === 'loading' ? 'gray' : 'red');
  };
  setBadge('health-local', 'loading');
  setBadge('health-prod', 'loading');

  const [local, prod] = await Promise.allSettled([
    api.healthCheck('http://localhost:3000'),
    api.healthCheck('https://grand-integrity-production-7a3c.up.railway.app'),
  ]);
  setBadge('health-local', local.value?.ok ? 'ok' : 'err');
  setBadge('health-prod',  prod.value?.ok  ? 'ok' : 'err');
}

// ── Advertiser-Tabelle ────────────────────────────────────────────────────────
async function loadAdvertisers() {
  const tbody = document.getElementById('adv-table-body');
  tbody.innerHTML = '<tr><td colspan="7" class="empty">Lade…</td></tr>';
  const res = await api.getAdvertisers();
  if (res.error) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty" style="color:var(--red)">${escape(res.error)}</td></tr>`;
    return;
  }
  if (!res.rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">Keine Werbetreibenden vorhanden.</td></tr>';
    return;
  }
  tbody.innerHTML = res.rows.map(r => `
    <tr>
      <td>${escape(r.company_name)}</td>
      <td style="color:var(--muted)">${escape(r.email)}</td>
      <td>${escape(r.postal_code)}</td>
      <td><span class="badge ${r.plan === 'premium' ? 'green' : 'gray'}">${escape(r.plan)}</span></td>
      <td>${fmt(r.ad_count)}</td>
      <td><span class="badge ${r.is_active ? 'green' : 'red'}">${r.is_active ? 'Aktiv' : 'Inaktiv'}</span></td>
      <td>
        <button class="btn btn-sm ${r.is_active ? 'btn-red' : 'btn-green'}"
          onclick="toggleAdvertiser(${r.id}, ${!r.is_active})">
          ${r.is_active ? 'Deaktivieren' : 'Aktivieren'}
        </button>
      </td>
    </tr>
  `).join('');
}

async function toggleAdvertiser(id, active) {
  await api.toggleAdvertiser(id, active);
  loadAdvertisers();
}

// ── Publisher-Tabelle ─────────────────────────────────────────────────────────
async function loadPublishers() {
  const tbody = document.getElementById('pub-table-body');
  tbody.innerHTML = '<tr><td colspan="6" class="empty">Lade…</td></tr>';
  const res = await api.getPublishers();
  if (res.error) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty" style="color:var(--red)">${escape(res.error)}</td></tr>`;
    return;
  }
  if (!res.rows.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">Keine Publisher vorhanden.</td></tr>';
    return;
  }
  tbody.innerHTML = res.rows.map(r => `
    <tr>
      <td>${escape(r.domain)}</td>
      <td style="color:var(--muted)">${escape(r.email)}</td>
      <td><span class="badge gray">${escape(r.verification_method ?? '–')}</span></td>
      <td>${escape(r.revenue_share_pct ?? 70)} %</td>
      <td><span class="badge ${r.is_verified ? 'green' : 'red'}">${r.is_verified ? 'Verifiziert' : 'Ausstehend'}</span></td>
      <td>
        <button class="btn btn-sm ${r.is_verified ? 'btn-red' : 'btn-green'}"
          onclick="togglePublisher(${r.id}, ${!r.is_verified})">
          ${r.is_verified ? 'Sperren' : 'Freigeben'}
        </button>
      </td>
    </tr>
  `).join('');
}

async function togglePublisher(id, verified) {
  await api.togglePublisher(id, verified);
  loadPublishers();
}

// ── Backend-Steuerung ─────────────────────────────────────────────────────────
function setBackendUI(running) {
  const dot  = document.getElementById('backend-dot');
  const text = document.getElementById('backend-status-text');
  const start = document.getElementById('btn-start');
  const stop  = document.getElementById('btn-stop');

  if (running) {
    dot.classList.add('on');
    text.textContent = 'Backend läuft';
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
  const res = await api.startBackend();
  if (res.ok) setBackendUI(true);
  else appendLog('[ERR] ' + (res.error ?? 'Start fehlgeschlagen'));
}

async function stopBackend() {
  const res = await api.stopBackend();
  if (res.ok) setBackendUI(false);
}

function appendLog(msg) {
  const box = document.getElementById('log-box');
  const line = document.createElement('div');
  line.className = 'log-line' + (msg.startsWith('[ERR]') ? ' log-err' : '');
  line.textContent = msg;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

// Backend-Events vom Main-Prozess
api.onBackendLog(msg => appendLog(msg));
api.onBackendStatus(running => setBackendUI(running));

// ── Init ──────────────────────────────────────────────────────────────────────
(async function init() {
  // Backend-Status abfragen
  const status = await api.backendRunning();
  setBackendUI(status.running);

  // Stats + Health parallel laden
  await Promise.all([loadStats(), checkHealth()]);

  // Nutzer-Tab: beim ersten Öffnen laden
  document.querySelector('[data-tab="nutzer"]').addEventListener('click', () => {
    loadAdvertisers();
    loadPublishers();
  }, { once: true });

  // Auto-Refresh alle 30 s
  setInterval(loadStats, 30_000);
})();
