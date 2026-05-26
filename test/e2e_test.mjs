// LocalAd E2E Test – node test/e2e_test.mjs
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TS = Date.now();
const USER_EMAIL = `testuser_${TS}@example.com`;
const PUB_EMAIL  = `publisher_${TS}@example.com`;
const ADV_EMAIL  = `advertiser_${TS}@example.com`;
const PASSWORD   = 'Test1234!';
const PLZ        = '47051';

let passed = 0; let failed = 0;
const pass = (msg) => { console.log(`  OK  ${msg}`); passed++; };
const fail = (msg) => { console.log(`  FAIL ${msg}`); failed++; };
const step = (msg) => console.log(`\n-- ${msg} --`);

async function post(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
async function get(path, token) {
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
  const r = await fetch(`${BASE_URL}${path}`, { headers });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
async function registerAndLogin(email, role, extra = {}) {
  await post('/api/auth/register', { email, password: PASSWORD, role, ...extra });
  const r = await post('/api/auth/login', { email, password: PASSWORD });
  return r.data.accessToken || null;
}

// 0. Health
step('0. Health Check');
try {
  const r = await get('/health');
  r.data.status === 'ok' ? pass(`Backend OK (${BASE_URL})`) : fail(`Health: ${JSON.stringify(r.data)}`);
} catch(e) { fail(`Nicht erreichbar: ${e.message}`); process.exit(1); }

// 1. Nutzer
step('1. Nutzer-Registrierung + Login');
const userToken = await registerAndLogin(USER_EMAIL, 'user');
userToken ? pass(`Nutzer OK: ${USER_EMAIL}`) : fail('Nutzer-Token fehlgeschlagen');

// 2. Publisher
step('2. Publisher');
const pubToken = await registerAndLogin(PUB_EMAIL, 'publisher');
pubToken ? pass(`Publisher OK: ${PUB_EMAIL}`) : fail('Publisher-Token fehlgeschlagen');

if (pubToken) {
  const domR = await post('/api/publishers/register',
    { domain: 'test-publisher.getlocalad.de', verificationMethod: 'meta-tag' }, pubToken);
  domR.data.token
    ? pass(`Domain registriert, Token: ${domR.data.token.slice(0,12)}...`)
    : fail(`Domain-Reg: ${JSON.stringify(domR.data)}`);

  const meR = await get('/api/publishers/me', pubToken);
  meR.status === 200 ? pass('Publisher /me OK') : fail(`Publisher /me: ${JSON.stringify(meR.data)}`);
}

// 3. Advertiser + Anzeige
step('3. Advertiser + Anzeige');
const advToken = await registerAndLogin(ADV_EMAIL, 'advertiser',
  { companyName: 'Testbaeckerei Duisburg', postalCode: PLZ, plan: 'basic' });
advToken ? pass(`Advertiser OK: ${ADV_EMAIL}`) : fail('Advertiser-Token fehlgeschlagen');

if (advToken) {
  const today  = new Date().toISOString().split('T')[0];
  const future = new Date(Date.now() + 30*86400000).toISOString().split('T')[0];
  const adR = await post('/api/ads',
    { title: 'Frische Broetchen', imageUrl: 'https://example.de/image.jpg',
      description: 'Baeckerei Mueller - Duisburg', targetUrl: 'https://example.de',
      postalCodes: [PLZ], validFrom: today, validUntil: future }, advToken);
  const adId = adR.data.adId;
  adId ? pass(`Anzeige erstellt (${adId.slice(0,8)}...)`) : fail(`Anzeige: ${JSON.stringify(adR.data)}`);

  const listR = await get('/api/ads', advToken);
  Array.isArray(listR.data.ads) && listR.data.ads.length >= 1
    ? pass(`Anzeigen-Liste: ${listR.data.ads.length} Eintraege`)
    : fail(`Anzeigen-Liste: ${JSON.stringify(listR.data)}`);
}

// 4. Ad-Match
step('4. Ad-Match');
const matchR = await post('/api/ads/match',
  { publisherDomain: 'test-publisher.getlocalad.de', postalCode: PLZ, slotId: 'banner-top' });
if (matchR.status === 200) pass('Ad-Match: 200 OK (Anzeige ausgeliefert)');
else if (matchR.status === 204) pass('Ad-Match: 204 No Content (Publisher nicht verifiziert - erwartet)');
else fail(`Ad-Match: HTTP ${matchR.status} - ${JSON.stringify(matchR.data)}`);

// 5. Stats
step('5. Statistiken');
if (advToken) {
  const r = await get('/api/advertisers/me/stats?days=7', advToken);
  'impressions' in r.data ? pass('Advertiser-Stats OK') : fail(`Advertiser-Stats: ${JSON.stringify(r.data)}`);
}
if (pubToken) {
  const r = await get('/api/publishers/me/stats?days=7', pubToken);
  'impressions' in r.data ? pass('Publisher-Stats OK') : fail(`Publisher-Stats: ${JSON.stringify(r.data)}`);
}

// Ergebnis
console.log('\n' + '='.repeat(44));
if (failed === 0) {
  console.log(`  Alle ${passed} Tests bestanden!`);
} else {
  console.log(`  ${passed} bestanden  ${failed} fehlgeschlagen`);
}
console.log('='.repeat(44));
if (failed > 0) process.exit(1);
