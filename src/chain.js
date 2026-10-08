// Read-only chain access. Works in the browser and in Node 18+ (used by scripts/discover.mjs).
import { LCD_ENDPOINTS, RPC_ENDPOINTS, KNOWN_ASSETS, RENAMED, LUNA_PRICE_URL, RATE_SOURCES, ERIS_GAUGE, ERIS_STAKING, ERIS_BRIBES, ERIS_ESCROW } from './config.js';

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

// Eris names an asset { cw20: addr } or { native: denom }; Astroport uses a longer form.
const infoOf = (asset) => (asset.cw20 ? { token: { contract_addr: asset.cw20 } } : { native_token: { denom: asset.native } });

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
        let base;
        try {
          base = (await lcdGet(`/ibc/apps/transfer/v1/denom_traces/${hash}`)).denom_trace.base_denom;
        } catch (e) {
          base = (await lcdGet(`/ibc/apps/transfer/v1/denoms/${hash}`)).denom.base;
        }
        // A token minted by a contract on another chain is named by its last segment.
        out.symbol = base.startsWith('factory/') ? base.split('/').pop() : base;
        storeAsset(key, out);
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

// One pool -> { assets: [{ key, symbol, amount }], supply }. Amounts are in whole tokens;
// supply is the pool's LP tokens in issue, in the token's smallest unit.
async function readPool(pair) {
  const pool = await smart(pair, { pool: {} });
  const raw = [];
  const assets = await Promise.all(pool.assets.map(async (a, i) => {
    const meta = await resolveAsset(a.info);
    raw[i] = { info: a.info, key: meta.key, amount: Number(a.amount), decimals: meta.decimals };
    return { key: meta.key, symbol: meta.symbol, amount: Number(a.amount) / 10 ** meta.decimals };
  }));
  return { assets, supply: Number(pool.total_share), raw };
}

// One Astroport pair -> [{ key, symbol, amount }].
export async function loadPool(pair) {
  return (await readPool(pair)).assets;
}

// Load every pool that has a pair address. Never throws: failures are reported per pool.
// Returns { live: { id: assets }, supply: { id: LP tokens in issue }, raw: { id: reserves
// as the pool reports them, for asking it for a quote }, errors }.
export async function loadLive(pools) {
  const live = {};
  const supply = {};
  const raw = {};
  const errors = [];
  const missed = [];
  const read = async (p) => {
    const pool = await readPool(p.pair);
    live[p.id] = pool.assets;
    raw[p.id] = pool.raw;
    if (pool.supply > 0) supply[p.id] = pool.supply;
  };
  await pooled(pools.filter((p) => p.pair), 6, async (p) => {
    try { await read(p); } catch (err) { missed.push(p); }
  });
  // One unhurried second try for anything a busy endpoint dropped.
  for (const p of missed) {
    try { await read(p); } catch (err) { errors.push(`${p.id}: ${err.message}`); }
  }
  return { live, supply, raw, errors };
}

// --- Quotes: what each pool would actually pay ----------------------------------------------
// A pool's reserves do not give its price unless it is a plain constant-product pool, so
// ask each pool to simulate a small trade (one ten-thousandth of its first reserve).
// Returns { poolId: { from, to, rate, fee } }: one `from` buys `rate` of `to` before fees,
// and `fee` is the share of the output the pool keeps. Pools that will not quote are left out.
export async function loadQuotes(pools, raw) {
  const out = {};
  await pooled(pools.filter((p) => p.pair && raw[p.id] && raw[p.id].length === 2), 4, async (p) => {
    const [a, b] = raw[p.id];
    const offer = Math.max(1000, Math.round(a.amount / 10000));
    if (!(a.amount > 0) || !(b.amount > 0) || offer > a.amount / 50) return; // empty, or too small to quote fairly
    try {
      // BigInt prints every digit; a plain number this large would print as 2.1e+27.
      const sim = await smart(p.pair, { simulation: { offer_asset: { info: a.info, amount: BigInt(offer).toString() } } });
      // Astroport reports its cut as commission_amount; other exchanges as *_fee_amount.
      let fees = 0;
      for (const [k, v] of Object.entries(sim)) if (k === 'commission_amount' || k.endsWith('_fee_amount')) fees += Number(v) || 0;
      const got = Number(sim.return_amount) + fees;
      if (!(got > 0)) return;
      out[p.id] = { from: a.key, to: b.key, rate: (got / 10 ** b.decimals) / (offer / 10 ** a.decimals), fee: fees / got };
    } catch (err) { /* this pool keeps its reserve-ratio price */ }
  });
  return out;
}

// Prices from outside Terra, from DefiLlama's free price service, for comparison only.
// ids are CoinGecko ids. Returns { id: { price, at } } (at in ms), or {} if unreachable.
export async function loadMarket(ids) {
  if (!ids.length) return {};
  try {
    const json = await getJson('https://coins.llama.fi/prices/current/' + ids.map((id) => 'coingecko:' + id).join(','), 8000);
    const out = {};
    for (const [k, v] of Object.entries(json.coins || {})) {
      if (v && v.price > 0) out[k.replace(/^coingecko:/, '')] = { price: v.price, at: (v.timestamp || 0) * 1000 };
    }
    return out;
  } catch (err) {
    return {};
  }
}

// --- The Liquidity Alliance, read from its gauge contract ---------------------------------
// What a staked asset is never changes, so the answer is remembered between visits.
const LP_STORE = 'realm-of-luna:lp:v1';
function storedLp() {
  try { return JSON.parse(localStorage.getItem(LP_STORE)) || {}; } catch (err) { return {}; }
}

// A gauge asset is either a pool's LP token or a single token staked on its own.
// LP tokens lead back to their pool: a contract LP token names the pool as its minter,
// and a native LP denom carries the pool's address.
async function resolveGaugeAsset(asset) {
  const key = asset.cw20 || asset.native;
  const saved = storedLp()[key];
  if (saved) return saved;
  let pair = null;
  try {
    if (asset.cw20) pair = (await smart(key, { minter: {} })).minter;
    else if (key.startsWith('factory/')) pair = key.split('/')[1];
  } catch (err) { /* not a mintable contract token */ }
  let out = null;
  if (pair && /^terra1[a-z0-9]{38,}$/.test(pair)) {
    try {
      const t = (await smart(pair, { pair: {} })).pair_type;
      // Astroport describes pool types as { xyk }, { stable } or { custom: "concentrated" }.
      const astro = t && typeof t === 'object' && ('xyk' in t || 'stable' in t || 'custom' in t);
      const type = astro ? (t.custom || Object.keys(t)[0]) : /constant/i.test(JSON.stringify(t)) ? 'xyk' : 'stable';
      out = { kind: 'pair', pair, type, venue: astro ? 'Astroport' : 'SkeletonSwap' };
    } catch (err) {
      // No pair description. If it still answers as a pool, treat it as one on another exchange.
      try {
        if ((await smart(pair, { pool: {} })).assets.length === 2) out = { kind: 'pair', pair, type: null, venue: 'SkeletonSwap' };
      } catch (err2) { /* the minter is not a pool */ }
    }
  }
  if (!out) {
    const meta = await resolveAsset(infoOf(asset));
    if (meta.unresolved) return { kind: 'single', symbol: 'Unread asset', venue: 'Eris' }; // not remembered: try again next visit
    out = { kind: 'single', symbol: meta.symbol, venue: 'Eris' };
  }
  try {
    const all = storedLp();
    all[key] = out;
    localStorage.setItem(LP_STORE, JSON.stringify(all));
  } catch (err) { /* storage unavailable */ }
  return out;
}

// The live Alliance: every asset in every gauge, with its share of that gauge's votes.
// Returns { period, assets: [{ key, gauge, share, kind, pair, type, venue, symbol }] }.
export async function loadAlliance() {
  const gauges = await smart(ERIS_GAUGE, { distributions: {} });
  const flat = [];
  let period = null;
  for (const g of gauges) {
    period = g.period;
    for (const a of g.assets) flat.push({ gauge: g.gauge, share: Number(a.distribution), asset: a.asset });
  }
  const assets = [];
  await pooled(flat, 6, async (row) => {
    const info = await resolveGaugeAsset(row.asset);
    assets.push({ key: row.asset.cw20 || row.asset.native, gauge: row.gauge, share: row.share, ...info });
  });
  // Keep the gauge's own order: most votes first within each gauge.
  assets.sort((x, y) => flat.findIndex((r) => (r.asset.cw20 || r.asset.native) === x.key) - flat.findIndex((r) => (r.asset.cw20 || r.asset.native) === y.key));
  return { period, assets };
}

// How much of each Alliance asset is staked through Eris. Each gauge has its own staking
// contract; one query lists everything staked in it.
// Returns { assetKey: { raw, take, amount?, key? } }: raw is in the asset's smallest unit
// and take is the share of the stake the Alliance takes each year. A single-token stake
// also gets its token key and its amount in whole tokens.
// A gauge whose staking contract cannot be read is simply left out.
export async function loadStaked(assets) {
  const rows = {};
  await Promise.all(Object.entries(ERIS_STAKING).map(async ([gauge, contract]) => {
    try {
      for (const r of await smart(contract, { total_staked_balances: {} })) {
        rows[gauge + ' ' + (r.asset.info.cw20 || r.asset.info.native)] = { raw: Number(r.asset.amount), take: Number(r.config && r.config.yearly_take_rate) };
      }
    } catch (err) { /* this gauge stays unread */ }
  }));
  const out = {};
  await Promise.all(assets.map(async (a) => {
    const row = rows[a.gauge + ' ' + a.key];
    if (!row || !(row.raw >= 0)) return;
    const raw = row.raw;
    out[a.key] = { raw, take: row.take >= 0 ? row.take : null };
    if (a.kind !== 'single') return;
    const meta = await resolveAsset(infoOf(a.key.startsWith('terra1') ? { cw20: a.key } : { native: a.key }));
    if (meta.unresolved) return; // decimals unknown: leave the amount out, do not guess
    out[a.key].key = meta.key;
    out[a.key].amount = raw / 10 ** meta.decimals;
  }));
  return out;
}

// Voter incentives on offer, from the bribe manager.
// Returns { 'gauge assetKey': [{ key, symbol, amount }] }, amounts in whole tokens (null
// when the token's decimals could not be read), or null if the contract cannot be read.
export async function loadTribute() {
  let buckets;
  try {
    buckets = (await smart(ERIS_BRIBES, { bribes: {} })).buckets;
  } catch (err) {
    return null;
  }
  const out = {};
  await pooled(buckets || [], 4, async (b) => {
    out[b.gauge + ' ' + (b.asset.cw20 || b.asset.native)] = await Promise.all(b.assets.map(async (a) => {
      const meta = await resolveAsset(infoOf(a.info));
      return { key: meta.key, symbol: meta.unresolved ? 'unread token' : meta.symbol, amount: meta.unresolved ? null : Number(a.amount) / 10 ** meta.decimals };
    }));
  });
  return out;
}

// What the chain pays the Alliance: LUNA minted per year and each Alliance token's reward
// weight. Returns { annualProvisions, alliances } for gaugeEmission(), or null.
export async function loadEmission() {
  try {
    const [mint, all] = await Promise.all([lcdGet('/cosmos/mint/v1beta1/annual_provisions'), lcdGet('/terra/alliances')]);
    return {
      annualProvisions: Number(mint.annual_provisions) / 1e6,
      alliances: all.alliances.map((x) => ({ denom: x.denom, weight: Number(x.reward_weight), staked: Number(x.total_tokens) > 0 })),
    };
  } catch (err) {
    return null;
  }
}

// Facts about one token, read on demand and remembered for the visit.
// Returns { supply, bonded? }: supply is how much of the token exists on Terra, in whole
// tokens (for a token that arrived over IBC, how much has been brought to Terra); bonded,
// for LUNA only, is how much is staked with validators. A figure that cannot be read is null.
const tokenFacts = new Map();
export function loadTokenFacts(key) {
  if (!tokenFacts.has(key)) {
    tokenFacts.set(key, (async () => {
      const out = { supply: null };
      try {
        if (key.startsWith('terra1')) {
          const t = await smart(key, { token_info: {} });
          out.supply = Number(t.total_supply) / 10 ** t.decimals;
        } else {
          const meta = await resolveAsset({ native_token: { denom: key } });
          const s = await lcdGet('/cosmos/bank/v1beta1/supply/by_denom?denom=' + encodeURIComponent(key));
          if (!meta.unresolved) out.supply = Number(s.amount.amount) / 10 ** meta.decimals;
        }
      } catch (err) { /* leave it unread */ }
      if (key === 'uluna') {
        try { out.bonded = Number((await lcdGet('/cosmos/staking/v1beta1/pool')).pool.bonded_tokens) / 1e6; } catch (err) { out.bonded = null; }
      }
      if (out.supply == null) tokenFacts.delete(key); // try again on the next click
      return out;
    })());
  }
  return tokenFacts.get(key);
}

// The voting escrow: total voting power across every lock, and how many locks exist.
// Returns { votes, locks }, or null if it cannot be read.
export async function loadEscrow() {
  try {
    const [vamp, count] = await Promise.all([smart(ERIS_ESCROW, { total_vamp: {} }), smart(ERIS_ESCROW, { num_tokens: {} })]);
    const votes = Number(vamp.vp) / 1e6;
    return votes > 0 ? { votes, locks: count.count } : null;
  } catch (err) {
    return null;
  }
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

// --- Smart queries over RPC -------------------------------------------------------------
// The request and response are tiny protobuf messages, encoded by hand:
//   QuerySmartContractStateRequest  { 1: address (string), 2: query_data (bytes) }
//   QuerySmartContractStateResponse { 1: data (bytes) }
const varint = (n) => {
  const out = [];
  while (n > 127) { out.push((n & 127) | 128); n = Math.floor(n / 128); }
  out.push(n);
  return out;
};
export function encodeSmartQuery(address, msg) {
  const enc = new TextEncoder();
  const a = enc.encode(address), q = enc.encode(JSON.stringify(msg));
  const bytes = [0x0a, ...varint(a.length), ...a, 0x12, ...varint(q.length), ...q];
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}
export function decodeSmartResponse(base64) {
  const raw = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
  if (raw[0] !== 0x0a) throw new Error('Unexpected response encoding');
  let len = 0, shift = 1, i = 1;
  for (;;) { const b = raw[i++]; len += (b & 127) * shift; if (b < 128) break; shift *= 128; }
  return JSON.parse(new TextDecoder().decode(raw.slice(i, i + len)));
}

// Returns { data } on success or { error } carrying the contract's own rejection text.
export async function rpcSmart(address, msg) {
  const query = `/abci_query?path=%22/cosmwasm.wasm.v1.Query/SmartContractState%22&data=0x${encodeSmartQuery(address, msg)}`;
  let lastErr = 'No RPC endpoint configured';
  for (const base of RPC_ENDPOINTS) {
    try {
      const json = await getJson(base + query, 10000);
      const res = json.result && json.result.response;
      if (!res) { lastErr = `${new URL(base).host}: ${JSON.stringify(json.error || json).slice(0, 300)}`; continue; }
      if (res.code) return { error: res.log || `code ${res.code}` };
      return { data: decodeSmartResponse(res.value) };
    } catch (err) {
      lastErr = `${new URL(base).host}: ${err.message}`;
    }
  }
  return { error: lastErr, unreachable: true };
}

// Ask a contract which queries it accepts. CosmWasm answers an unknown query with the
// list of valid ones, so one deliberately wrong question maps the whole interface.
// Then try each query with no arguments and keep whatever comes back. When a query says it
// is missing a field named in `hints` (a gauge name, the current period), fill it in and
// ask again, so one run gets real answers from queries that need arguments.
export async function probeContract(address, hints = {}) {
  const out = { address, queries: [], results: {} };
  const first = await rpcSmart(address, { realm_of_luna_probe: {} });
  const message = first.error || '';
  if (first.data !== undefined) out.results.__unexpected = first.data;
  out.rejection = message.slice(0, 1500);
  const listed = message.split('expected one of')[1] || '';
  out.queries = Array.from(new Set((listed.match(/`([A-Za-z0-9_]+)`/g) || []).map((s) => s.slice(1, -1))));
  for (const name of out.queries) {
    const args = {};
    let res;
    for (let tries = 0; tries < 5; tries++) {
      res = await rpcSmart(address, { [name]: args });
      const missing = res.error && (res.error.match(/missing field `([A-Za-z0-9_]+)`/) || [])[1];
      if (!missing || !(missing in hints) || missing in args) break;
      args[missing] = hints[missing];
    }
    const asked = Object.keys(args).length ? { asked: args } : {};
    if (res.error) { out.results[name] = { ...asked, error: res.error.slice(0, 600) }; continue; }
    const text = JSON.stringify(res.data);
    out.results[name] = text.length > 6000 ? { ...asked, truncated: text.slice(0, 6000) } : Object.keys(asked).length ? { ...asked, answer: res.data } : res.data;
  }
  return out;
}
