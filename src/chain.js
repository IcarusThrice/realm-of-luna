// Read-only chain access. Works in the browser and in Node 18+ (used by scripts/discover.mjs).
import { LCD_ENDPOINTS, KNOWN_ASSETS, RENAMED, LUNA_PRICE_URL, RATE_SOURCES } from './config.js';

let preferred = 0;
const assetCache = new Map();
const STORE_KEY = 'realm-of-luna:assets:v1';

// Token names and decimals never change, so remember them between visits.
function storedAssets() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (err) { return {}; }
}
function storeAsset(key, meta) {
  try {
    const all = storedAssets();
    all[key] = { symbol: meta.symbol, decimals: meta.decimals };
    localStorage.setItem(STORE_KEY, JSON.stringify(all));
  } catch (err) { /* storage unavailable: look it up again next time */ }
}

async function getJson(url, ms = 8000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { accept: 'application/json' } });
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).message || ''; } catch (err) { /* no body */ }
      const e = new Error(`${res.status} from ${new URL(url).host}${detail ? ': ' + detail : ''}`);
      e.status = res.status;
      e.detail = detail;
      throw e;
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// GET a REST path, falling through the endpoint list. Remembers the one that worked.
// A 4xx with a message is the chain's own answer (a rejected query), so it is not retried elsewhere.
export async function lcdGet(path) {
  let lastErr;
  for (let i = 0; i < LCD_ENDPOINTS.length; i++) {
    const idx = (preferred + i) % LCD_ENDPOINTS.length;
    try {
      const json = await getJson(LCD_ENDPOINTS[idx] + path);
      preferred = idx;
      return json;
    } catch (err) {
      lastErr = err;
      if (err.detail && err.status >= 400 && err.status < 500 && err.status !== 429) break;
    }
  }
  throw lastErr || new Error('No endpoint configured');
}

export function smartPath(contract, msg) {
  return `/cosmwasm/wasm/v1/contract/${contract}/smart/${encodeURIComponent(btoa(JSON.stringify(msg)))}`;
}

// CosmWasm smart query. Returns the contract's response body.
export async function smart(contract, msg) {
  const json = await lcdGet(smartPath(contract, msg));
  return json.data;
}

// Run tasks a few at a time so a public endpoint is not flooded.
export async function pooled(items, limit, fn) {
  const queue = items.slice();
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) await fn(queue.shift());
  }));
}

// Turn an Astroport asset_info into { key, symbol, decimals }.
export async function resolveAsset(info) {
  const key = info.native_token ? info.native_token.denom : info.token.contract_addr;
  if (assetCache.has(key)) return assetCache.get(key);
  const out = { key, symbol: key, decimals: 6 };
  const saved = KNOWN_ASSETS[key] || storedAssets()[key];
  if (saved) {
    Object.assign(out, saved);
  } else {
    try {
      if (info.token) {
        const t = await smart(key, { token_info: {} });
        out.symbol = t.symbol;
        out.decimals = t.decimals;
        storeAsset(key, out);
      } else if (key.startsWith('ibc/')) {
        const hash = key.slice(4);
        try {
          out.symbol = (await lcdGet(`/ibc/apps/transfer/v1/denom_traces/${hash}`)).denom_trace.base_denom;
        } catch (e) {
          out.symbol = (await lcdGet(`/ibc/apps/transfer/v1/denoms/${hash}`)).denom.base;
        }
      } else if (key.startsWith('factory/')) {
        out.symbol = key.split('/').pop();
      }
    } catch (err) {
      out.unresolved = true;
    }
  }
  if (RENAMED[key]) out.symbol = RENAMED[key];
  assetCache.set(key, out);
  return out;
}

// One Astroport pair -> [{ key, symbol, amount }], amounts in whole tokens.
export async function loadPool(pair) {
  const pool = await smart(pair, { pool: {} });
  return Promise.all(pool.assets.map(async (a) => {
    const meta = await resolveAsset(a.info);
    return { key: meta.key, symbol: meta.symbol, amount: Number(a.amount) / 10 ** meta.decimals };
  }));
}

// Load every curated pool that has a pair address. Never throws: failures are reported per pool.
export async function loadLive(pools) {
  const live = {};
  const errors = [];
  await pooled(pools.filter((p) => p.pair), 6, async (p) => {
    try {
      live[p.id] = await loadPool(p.pair);
    } catch (err) {
      errors.push(`${p.id}: ${err.message}`);
    }
  });
  return { live, errors };
}

// Exact LUNA value of each liquid-staked token, read from its own contract.
// Returns { tokenKey: rate }; a token whose contract cannot be read is simply left out.
export async function knownRates() {
  const rates = {};
  await Promise.all(RATE_SOURCES.map(async ({ token, contract }) => {
    try {
      const rate = Number((await smart(contract, { state: {} })).exchange_rate);
      if (rate > 0) rates[token] = rate;
    } catch (err) { /* fall back to the pool's reserve ratio */ }
  }));
  return rates;
}

export async function lunaUsd() {
  try {
    const json = await getJson(LUNA_PRICE_URL, 5000);
    const v = json['terra-luna-2'] && json['terra-luna-2'].usd;
    return typeof v === 'number' && v > 0 ? v : null;
  } catch (err) {
    return null;
  }
}

// Page through every pair the Astroport factory knows about.
export async function listFactoryPairs(factory, max = 2000) {
  const out = [];
  let startAfter;
  while (out.length < max) {
    const msg = { pairs: { limit: 30 } };
    if (startAfter) msg.pairs.start_after = startAfter;
    const page = (await smart(factory, msg)).pairs || [];
    out.push(...page);
    if (page.length < 30) break;
    startAfter = page[page.length - 1].asset_infos;
  }
  return out;
}

// Ask a contract which queries it accepts. CosmWasm answers an unknown query with the
// list of valid ones, so one deliberately wrong question maps the whole interface.
// Then try each query with no arguments and keep whatever comes back.
export async function probeContract(address) {
  const out = { address, queries: [], results: {} };
  let message = '';
  try {
    out.results.__unexpected = await smart(address, { realm_of_luna_probe: {} });
  } catch (err) {
    message = err.detail || err.message;
  }
  out.rejection = message.slice(0, 1500);
  const listed = message.split('expected one of')[1] || '';
  out.queries = Array.from(new Set((listed.match(/`([A-Za-z0-9_]+)`/g) || []).map((s) => s.slice(1, -1))));
  for (const name of out.queries) {
    try {
      const data = await smart(address, { [name]: {} });
      const text = JSON.stringify(data);
      out.results[name] = text.length > 6000 ? { truncated: text.slice(0, 6000) } : data;
    } catch (err) {
      out.results[name] = { error: (err.detail || err.message).slice(0, 600) };
    }
  }
  return out;
}
