#!/usr/bin/env node
// LocalAd – EasyList → MV3 declarativeNetRequest Konverter
// Ausführen: node scripts/build-rules.js
// Output:    rules/block_rules.json

import fs   from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const RULES_DIR  = path.resolve(__dirname, '..', 'rules');
const OUT_FILE   = path.join(RULES_DIR, 'block_rules.json');
const CACHE_FILE = path.join(RULES_DIR, 'easylist.cache.txt');
const EASYLIST_URL = 'https://easylist.to/easylist/easylist.txt';
const MAX_RULES  = 29000;
const RESOURCE_TYPES = ['script','image','xmlhttprequest','sub_frame','stylesheet','font','media'];

async function fetchEasyList() {
  if (fs.existsSync(CACHE_FILE)) {
    const age = Date.now() - fs.statSync(CACHE_FILE).mtimeMs;
    if (age < 86400000) {
      console.log('[build-rules] Nutze gecachte EasyList');
      return fs.readFileSync(CACHE_FILE, 'utf8');
    }
  }
  console.log('[build-rules] Lade EasyList von easylist.to...');
  try {
    const text = await new Promise((resolve, reject) => {
      const req = https.get(EASYLIST_URL, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve(data));
        res.on('error', reject);
      });
      req.on('error', reject);
      req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
    });
    fs.mkdirSync(RULES_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, text, 'utf8');
    console.log('[build-rules] EasyList geladen (' + (text.length/1024).toFixed(0) + ' KB)');
    return text;
  } catch (err) {
    console.warn('[build-rules] EasyList nicht erreichbar (' + err.message + ') -> nur manuelle Regeln');
    return null;
  }
}

function parseLine(line) {
  if (!line || line.startsWith('!') || line.startsWith('[')) return null;
  if (line.startsWith('@@')) return null;
  if (line.includes('##') || line.includes('#@#') || line.includes('#?#')) return null;
  if (!line.startsWith('||')) return null;
  const withoutPrefix = line.slice(2);
  const domainEnd = withoutPrefix.search(/[\^\/\$\*\?]/);
  if (domainEnd === -1) return null;
  const domain = withoutPrefix.slice(0, domainEnd).toLowerCase();
  if (!domain.includes('.') || domain.includes(' ') || domain.length < 4) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) return null;
  return domain;
}

function domainToRule(domain, id) {
  return {
    id,
    priority: 1,
    action: { type: 'block' },
    condition: { urlFilter: '||' + domain + '^', resourceTypes: RESOURCE_TYPES }
  };
}

function getManualRules() {
  const domains = [
    'doubleclick.net','googleadservices.com','googlesyndication.com',
    'ads.facebook.com','amazon-adsystem.com','adservice.google.com',
    'pagead2.googlesyndication.com','tpc.googlesyndication.com',
    'adnxs.com','taboola.com','outbrain.com','criteo.com',
    'rubiconproject.com','pubmatic.com','openx.net','smartadserver.com',
    'media.net','advertising.com','adsrvr.org','33across.com',
    'adform.net','appnexus.com','casalemedia.com','contextweb.com',
    'emxdgt.com','indexww.com','lijit.com','liveintent.com',
    'moatads.com','onetag.net','openx.com','quantserve.com',
    'rfihub.com','rfihub.net','scorecardresearch.com','serving-sys.com',
    'sharethrough.com','sovrn.com','spotx.tv','spotxchange.com',
    'springserve.com','teads.tv','triplelift.com','yieldmo.com'
  ];
  return domains.map((d, i) => ({
    id: i + 1,
    priority: 2,
    action: { type: 'block' },
    condition: { urlFilter: '||' + d + '^', resourceTypes: RESOURCE_TYPES }
  }));
}

async function build() {
  const manualRules   = getManualRules();
  const manualDomains = new Set(manualRules.map(r => r.condition.urlFilter.slice(2, -1)));
  let easyListRules   = [];

  const easylist = await fetchEasyList();
  if (easylist) {
    const lines = easylist.split('\n');
    console.log('[build-rules] Verarbeite ' + lines.length.toLocaleString() + ' Zeilen...');
    const domains = new Set();
    for (const line of lines) {
      const d = parseLine(line.trim());
      if (d && !manualDomains.has(d)) domains.add(d);
    }
    console.log('[build-rules] ' + domains.size.toLocaleString() + ' eindeutige EasyList-Domains');
    const sorted  = [...domains].sort();
    const limited = sorted.slice(0, MAX_RULES - manualRules.length);
    if (sorted.length > limited.length) {
      console.warn('[build-rules] ' + (sorted.length - limited.length) + ' Domains wegen MV3-Limit weggelassen');
    }
    easyListRules = limited.map((d, i) => domainToRule(d, manualRules.length + i + 1));
  }

  const finalRules = [...manualRules, ...easyListRules];
  fs.mkdirSync(RULES_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(finalRules, null, 2), 'utf8');
  const sizeKb = (fs.statSync(OUT_FILE).size / 1024).toFixed(1);
  console.log('[build-rules] OK: ' + finalRules.length.toLocaleString() + ' Regeln -> ' + OUT_FILE + ' (' + sizeKb + ' KB)');
  if (!easylist) {
    console.log('[build-rules] Hinweis: Mit Internetzugang erneut ausfuehren fuer vollstaendige EasyList.');
  }
}

build().catch(err => { console.error('[build-rules] Fehler:', err.message); process.exit(1); });
