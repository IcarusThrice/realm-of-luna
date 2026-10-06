// Pure functions: chain numbers in, chart-ready systems out. No DOM, no network.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Price every token in LUNA, by token key (denom or contract address), never by symbol:
// anyone can mint a token and call it "LUNA" or "USDC".
//
// pools: [{ assets: [{ key, amount }, { key, amount }], type }]
// Prices spread outward from native LUNA. Constant-product (xyk) pools go first because
// their reserve ratio is the price; other pool types are only an approximation. Within a
// type the deepest pool goes first, so a thin skewed pool cannot set a price a deep pool
// also knows. `known` seeds exact prices (ampLUNA from the Eris hub). `pegs` are groups
// of keys valued alike (dollar stablecoins).
export function priceByKey(pools, { anchor = 'uluna', pegs = [], known = {} } = {}) {
  const prices = { ...known, [anchor]: 1 };
  const setPrice = (key, price) => {
    prices[key] = price;
    for (const group of pegs) {
      if (group.includes(key)) for (const k of group) if (!(k in prices)) prices[k] = price;
    }
  };
  for (const key of Object.keys(known)) setPrice(key, known[key]);
  const usable = (p) => p && p.assets && p.assets.length === 2 && p.assets.every((a) => a.amount > 0);
  const todo = new Set(pools.filter(usable));
  for (;;) {
    let best = null, bestVal = 0, bestRank = 9;
    for (const p of todo) {
      const priced = p.assets.filter((a) => a.key in prices);
      if (priced.length === 2) { todo.delete(p); continue; }
      if (priced.length !== 1) continue;
      const rank = p.type === 'xyk' ? 0 : 1;
      const val = priced[0].amount * prices[priced[0].key];
      if (rank < bestRank || (rank === bestRank && val > bestVal)) { best = p; bestVal = val; bestRank = rank; }
    }
    if (!best) break;
    const unknown = best.assets.find((a) => !(a.key in prices));
    setPrice(unknown.key, bestVal / unknown.amount);
    todo.delete(best);
  }
  return prices;
}

// Value of one pool in LUNA. With one side unpriced, assume the pool is balanced.
export function poolDepth(assets, prices) {
  const vals = (assets || []).map((a) => (a.key in prices ? a.amount * prices[a.key] : null));
  const known = vals.filter((v) => v != null);
  return { vals, depth: known.length === 2 ? known[0] + known[1] : known.length === 1 ? 2 * known[0] : 0 };
}

// Rank many pools by depth in LUNA, deepest first.
export function rankByDepth(pools, opts) {
  const prices = priceByKey(pools, opts);
  const ranked = pools.map((p) => ({ ...p, depth: poolDepth(p.assets, prices).depth }));
  return { prices, ranked: ranked.sort((x, y) => y.depth - x.depth) };
}

// Merge the curated pools with live reserves.
// opts.lunaUsd converts mass to dollars when known; opts.pegs and opts.known go to pricing.
export function buildSystems(pools, live = {}, opts = {}) {
  const prices = priceByKey(
    pools.filter((p) => live[p.id]).map((p) => ({ assets: live[p.id], type: p.type })),
    { pegs: opts.pegs || [], known: opts.known || {} },
  );
  const usd = opts.lunaUsd > 0;
  const unit = usd ? 'USD' : 'LUNA';

  const systems = pools.map((p) => {
    const assets = live[p.id];
    const s = { ...p, live: false, value: null, unit, amounts: null, shareA: 0.72 };
    if (!assets || assets.length !== 2) return s;
    // Match chain assets to the curated a/b order by symbol, else keep chain order.
    const first = assets.find((x) => x.symbol === p.a) || assets[0];
    const second = assets.find((x) => x !== first);
    s.a = first.symbol; s.b = second.symbol;
    s.amounts = [{ symbol: first.symbol, amount: first.amount }, { symbol: second.symbol, amount: second.amount }];
    const { vals, depth } = poolDepth([first, second], prices);
    if (!(depth > 0)) return s;
    s.live = true;
    s.value = depth * (usd ? opts.lunaUsd : 1);
    s.shareA = vals[0] != null && vals[1] != null ? clamp(vals[0] / depth, 0.2, 0.8) : 0.5;
    return s;
  });

  // Size by live mass once enough pools are live to compare; until then use sample sizes.
  // A power curve keeps a $20K pool visibly smaller than a $1M pool without vanishing.
  const liveVals = systems.filter((s) => s.live).map((s) => s.value);
  const useLive = liveVals.length >= 3;
  const top = Math.max(...liveVals);
  for (const s of systems) {
    if (useLive) s.size = s.live ? 0.42 + 0.58 * Math.pow(s.value / top, 0.3) : 0.42;
    else s.size = clamp(s.sampleSize || 0.54, 0.42, 1);
    s.tier = s.size >= 0.87 ? 'Stronghold' : s.size >= 0.6 ? 'Colony' : 'Outpost';
  }
  return systems;
}

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

// Place each system inside its sector's 120 degree wedge: polar radius, angle, height.
// Neighbours alternate between three rings so their labels have room.
const RINGS = [7, 11.2, 9.1];
export function layout(systems, sectors) {
  const bySector = {};
  for (const s of systems) (bySector[s.sector] = bySector[s.sector] || []).push(s);
  for (const key of Object.keys(bySector)) {
    const list = bySector[key];
    const from = sectors[key] ? sectors[key].from : 0;
    list.forEach((s, i) => {
      s.deg = from + 120 * (i + 0.5) / list.length;
      s.r = RINGS[i % RINGS.length];
      s.y = 1.5 + (hash(s.id) % 20) / 10;
    });
  }
  return systems;
}

// The Liquidity Alliance epoch rolls over every Sunday at 12:00 UTC.
export function nextCycle(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0));
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7));
  if (d <= now) d.setUTCDate(d.getUTCDate() + 7);
  return d;
}

export function formatCountdown(ms) {
  const mins = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatAmount(v) {
  if (v == null || !isFinite(v)) return '';
  const abs = Math.abs(v);
  if (abs >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  if (abs >= 1) return v.toFixed(2);
  return v.toPrecision(3);
}

export function formatMass(value, unit) {
  if (value == null) return '';
  return unit === 'USD' ? '$' + formatAmount(value) : formatAmount(value) + ' ' + unit;
}
