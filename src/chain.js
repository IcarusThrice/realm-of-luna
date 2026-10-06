// Read-only chain access. Works in the browser and in Node 18+ (used by scripts/discover.mjs).
import { LCD_ENDPOINTS, NATIVE_DENOMS, BASE_DENOMS, LUNA_PRICE_URL, ERIS_HUB } from './config.js';

let preferred = 0;
const assetCache = new Map();

async function getJson(url, ms = 7000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// GET a REST path, falling through the endpoint list. Remembers the one that worked.
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

// Turn an Astroport asset_info into { key, symbol, decimals }.
export async function resolveAsset(info) {
  const key = info.native_token ? info.native_token.denom : info.token.contract_addr;
  if (assetCache.has(key)) return assetCache.get(key);
  const out = { key, symbol: key, decimals: 6 };
  try {
    if (info.token) {
      const t = await smart(key, { token_info: {} });
      out.symbol = t.symbol;
      out.decimals = t.decimals;
    } else if (NATIVE_DENOMS[key]) {
      Object.assign(out, NATIVE_DENOMS[key]);
    } else if (key.startsWith('ibc/')) {
      const hash = key.slice(4);
      let base;
      try {
        base = (await lcdGet(`/ibc/apps/transfer/v1/denom_traces/${hash}`)).denom_trace.base_denom;
      } catch (e) {
        base = (await lcdGet(`/ibc/apps/transfer/v1/denoms/${hash}`)).denom.base;
      }
      Object.assign(out, BASE_DENOMS[base] || { symbol: base, decimals: 6 });
    } else if (key.startsWith('factory/')) {
      out.symbol = key.split('/').pop();
    }
  } catch (err) {
    out.unresolved = true;
  }
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
  await Promise.all(pools.filter((p) => p.pair).map(async (p) => {
    try {
      live[p.id] = await loadPool(p.pair);
    } catch (err) {
      errors.push(`${p.name}: ${err.message}`);
    }
  }));
  return { live, errors };
}

// Exact LUNA value of one ampLUNA, from the Eris hub. Null if it cannot be read.
export async function ampLunaRate() {
  try {
    const rate = Number((await smart(ERIS_HUB, { state: {} })).exchange_rate);
    return rate > 0 ? rate : null;
  } catch (err) {
    return null;
  }
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
