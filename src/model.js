// Pure functions: chain numbers in, chart-ready systems out. No DOM, no network.

// Price every token seen in the live pools, in one unit.
// Unit is USD when a USDC pool is present, otherwise LUNA.
export function priceTokens(live) {
  const pools = Object.values(live).filter((assets) => assets && assets.length === 2);
  const hasUsdc = pools.some((assets) => assets.some((a) => a.symbol === 'USDC'));
  const unit = hasUsdc ? 'USD' : 'LUNA';
  const prices = { [hasUsdc ? 'USDC' : 'LUNA']: 1 };
  for (let pass = 0; pass < pools.length + 1; pass++) {
    let changed = false;
    for (const [x, y] of pools) {
      if (!(x.amount > 0 && y.amount > 0)) continue;
      const px = prices[x.symbol], py = prices[y.symbol];
      if (px != null && py == null) { prices[y.symbol] = px * x.amount / y.amount; changed = true; }
      if (py != null && px == null) { prices[x.symbol] = py * y.amount / x.amount; changed = true; }
    }
    if (!changed) break;
  }
  return { unit, prices };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Merge the curated pools with live reserves.
// opts.lunaUsd converts LUNA-denominated mass to dollars when known.
export function buildSystems(pools, live = {}, opts = {}) {
  let { unit, prices } = priceTokens(live);
  let scale = 1;
  if (unit === 'LUNA' && opts.lunaUsd > 0) { scale = opts.lunaUsd; unit = 'USD'; }

  const systems = pools.map((p) => {
    const assets = live[p.id];
    const s = { ...p, live: false, value: null, unit, amounts: null, shareA: 0.72 };
    if (!assets || assets.length !== 2) return s;
    // Match chain assets to the curated a/b order by symbol, else keep chain order.
    const first = assets.find((x) => x.symbol === p.a) || assets[0];
    const second = assets.find((x) => x !== first && x.symbol === p.b) || assets.find((x) => x !== first);
    const va = prices[first.symbol] != null ? first.amount * prices[first.symbol] : null;
    const vb = prices[second.symbol] != null ? second.amount * prices[second.symbol] : null;
    s.amounts = [{ symbol: first.symbol, amount: first.amount }, { symbol: second.symbol, amount: second.amount }];
    s.a = first.symbol; s.b = second.symbol;
    if (va == null && vb == null) return s;
    const total = va != null && vb != null ? va + vb : 2 * (va != null ? va : vb);
    if (!(total > 0)) return s;
    s.live = true;
    s.value = total * scale;
    s.shareA = va != null && vb != null ? clamp(va / total, 0.2, 0.8) : 0.5;
    return s;
  });

  // Size by live mass once enough pools are live to compare; until then use sample sizes.
  const liveVals = systems.filter((s) => s.live).map((s) => Math.log10(s.value));
  const useLive = liveVals.length >= 3;
  const lo = Math.min(...liveVals), hi = Math.max(...liveVals);
  for (const s of systems) {
    if (useLive) s.size = s.live ? 0.54 + 0.46 * (hi > lo ? (Math.log10(s.value) - lo) / (hi - lo) : 0.5) : 0.54;
    else s.size = clamp(s.sampleSize || 0.54, 0.54, 1);
    s.tier = s.size >= 0.87 ? 'Stronghold' : s.size >= 0.64 ? 'Colony' : 'Outpost';
  }
  return systems;
}

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

// Place each system inside its sector's 120 degree wedge: polar radius, angle, height.
export function layout(systems, sectors) {
  const bySector = {};
  for (const s of systems) (bySector[s.sector] = bySector[s.sector] || []).push(s);
  for (const key of Object.keys(bySector)) {
    const list = bySector[key];
    const from = sectors[key] ? sectors[key].from : 0;
    list.forEach((s, i) => {
      s.deg = from + 120 * (i + 0.5) / list.length;
      s.r = i % 2 === 0 ? 7 : 10.6;
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

// Rank many pools by depth in one anchor token (default LUNA).
// Prices spread outward from the anchor through the deepest pool first, so a thin
// pool with a skewed ratio cannot set the price of a token a deep pool also holds.
export function rankByDepth(pools, anchor = 'LUNA') {
  const prices = { [anchor]: 1 };
  const side = (p, known) => p.assets.find((a) => (a.symbol in prices) === known);
  const todo = new Set(pools.filter((p) => p.assets && p.assets.length === 2 && p.assets.every((a) => a.amount > 0)));
  for (;;) {
    let best = null, bestVal = 0;
    for (const p of todo) {
      const priced = p.assets.filter((a) => a.symbol in prices);
      if (priced.length === 2) { todo.delete(p); continue; }
      if (priced.length !== 1) continue;
      const val = priced[0].amount * prices[priced[0].symbol];
      if (val > bestVal) { best = p; bestVal = val; }
    }
    if (!best) break;
    const known = side(best, true), unknown = side(best, false);
    prices[unknown.symbol] = bestVal / unknown.amount;
    todo.delete(best);
  }
  const ranked = pools.map((p) => {
    const vals = (p.assets || []).map((a) => (a.symbol in prices ? a.amount * prices[a.symbol] : null));
    const known = vals.filter((v) => v != null);
    const depth = known.length === 2 ? known[0] + known[1] : known.length === 1 ? 2 * known[0] : 0;
    return { ...p, depth };
  });
  return { prices, ranked: ranked.sort((x, y) => y.depth - x.depth) };
}
